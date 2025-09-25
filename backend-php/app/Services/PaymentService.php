<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentOption;
use App\Enums\PaymentStatus;
use App\Enums\PaymentProvider;
use App\Enums\PaymentChannel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentService
{
    /**
     * Create or fetch an existing payment for an order (idempotent by order_id).
     */
    public function createOrFetch(int $orderId, ?int $userId, ?string $method = null): Payment
    {
        $order = Order::findOrFail($orderId);
        $existing = Payment::where('order_id', $orderId)->first();
        if ($existing) { return $existing; }
        return Payment::create([
            'order_id' => $orderId,
            'user_id' => $userId,
            'amount' => $order->total_gross,
            'currency' => 'KES',
            'method' => $method ?? 'MOBILE_MONEY',
            'status' => PaymentStatus::INITIATED->value,
            'provider_ref' => 'SIM-'.now()->timestamp,
        ]);
    }

    /**
     * Initiate a mobile money (possibly STK) payment. Mimics Java logic by:
     *  - Reusing existing INITIATED payment for same order+channel.
     *  - Storing generated external_request_id.
     *  - Simulating STK password build for MPESA channels.
     */
    public function initiateMobileMoney(array $data, ?int $userId): Payment
    {
        $order = Order::findOrFail($data['order_id']);
        $channel = $data['channel'] ?? null;
        $provider = $data['provider'] ?? null; // MPESA | AIRTEL
        $phone = $data['phone_number'] ?? null;
        $supportsStk = (bool)($data['supports_stk'] ?? false);

        $existing = Payment::where('order_id',$order->id)
            ->where('channel',$channel)
            ->where('status',PaymentStatus::INITIATED->value)
            ->first();
        if ($existing) { return $existing; }

        $payment = new Payment();
        $payment->order_id = $order->id;
        $payment->user_id = $userId;
        $payment->amount = $data['amount'] ?? $order->total_gross;
        $payment->currency = 'KES';
        $payment->method = $data['method'] ?? 'MOBILE_MONEY';
        $payment->provider = $provider;
        $payment->channel = $channel;
        $payment->phone_number = $phone;
    $payment->status = PaymentStatus::INITIATED->value;

        // Simulated STK enrichment
    if ($provider === PaymentProvider::MPESA->value && ($channel === PaymentChannel::MPESA_STK_PUSH->value || in_array($channel, [PaymentChannel::MPESA_PAYBILL->value,PaymentChannel::MPESA_TILL->value]) && $supportsStk)) {
            $timestamp = now()->format('YmdHis');
            $password = base64_encode('SHORTCODE'.'PASSKEY'.$timestamp);
            $payment->external_request_id = 'STK-REQ-'.now()->timestamp;
            $payment->raw_request_payload = json_encode(['simulated'=>true,'password'=>$password,'timestamp'=>$timestamp]);
    } elseif ($provider === PaymentProvider::AIRTEL->value && ($channel === PaymentChannel::AIRTEL_STK_PUSH->value || ($channel === PaymentChannel::AIRTEL_COLLECTION->value && $supportsStk))) {
            $payment->external_request_id = 'STK-REQ-'.now()->timestamp;
            $payment->raw_request_payload = json_encode(['simulated'=>true,'airtel'=>true]);
        } else {
            $payment->external_request_id = strtoupper($provider ?? 'GEN').'-REQ-'.now()->timestamp;
        }
        $payment->save();
        return $payment;
    }

    /**
     * Initiate manual mobile money referencing a configured PaymentOption.
     */
    public function initiateManual(array $data, ?int $userId): Payment
    {
        $order = Order::findOrFail($data['order_id']);
        $option = PaymentOption::findOrFail($data['payment_option_id']);
        if (!$option->active) {
            abort(422,'Payment option inactive');
        }
        $existing = Payment::where('order_id',$order->id)
            ->where('channel',$option->meta['channel'] ?? $option->code)
            ->where('status',PaymentStatus::INITIATED->value)
            ->first();
        if ($existing) { return $existing; }
        $channel = $option->meta['channel'] ?? $option->code;
        $payment = Payment::create([
            'order_id' => $order->id,
            'user_id' => $userId,
            'amount' => $data['amount'] ?? $order->total_gross,
            'currency' => 'KES',
            'method' => 'MOBILE_MONEY',
            'provider' => $option->provider,
            'channel' => $channel,
            'phone_number' => $data['phone_number'] ?? null,
            'status' => PaymentStatus::INITIATED->value,
            'provider_ref' => $this->composeProviderRef($data),
        ]);
        return $payment;
    }

    private function composeProviderRef(array $data): ?string
    {
        $parts = [];
        if (!empty($data['account_reference'])) $parts[] = 'REF:'.$data['account_reference'];
        if (!empty($data['narration'])) $parts[] = 'NAR:'.$data['narration'];
        return count($parts) ? implode(' | ',$parts) : null;
    }

    /**
     * Handle MPESA STK callback (raw JSON + parsed array). Idempotent based on external ids.
     */
    public function handleMpesaCallback(array $payload, string $raw): void
    {
        $checkoutId = $payload['checkoutRequestID'] ?? $payload['CheckoutRequestID'] ?? null;
        $payment = null;
        if ($checkoutId) {
            $payment = Payment::where('external_request_id',$checkoutId)->first();
        }
        // Try receipt fallback inside CallbackMetadata.Item[] => name == MpesaReceiptNumber
        if (!$payment && isset($payload['callbackMetadata']['item'])) {
            foreach ($payload['callbackMetadata']['item'] as $item) {
                if (($item['name'] ?? '') === 'MpesaReceiptNumber') {
                    $payment = Payment::where('external_transaction_id',$item['value'])->first();
                    break;
                }
            }
        }
        if (!$payment) { return; }
    if (in_array($payment->status,[PaymentStatus::SUCCESS->value,PaymentStatus::FAILED->value])) { return; }
        $payment->raw_callback_payload = $raw;
        $resultCode = $payload['resultCode'] ?? $payload['ResultCode'] ?? -1;
        if ((int)$resultCode === 0) {
            $payment->status = PaymentStatus::SUCCESS->value;
            if (isset($payload['callbackMetadata']['item'])) {
                foreach ($payload['callbackMetadata']['item'] as $item) {
                    if (($item['name'] ?? '') === 'MpesaReceiptNumber' && !empty($item['value'])) {
                        $payment->external_transaction_id = $item['value'];
                    }
                }
            }
            $this->progressOrder($payment);
        } else {
            $payment->status = PaymentStatus::FAILED->value;
        }
        $payment->save();
    }

    /**
     * Handle Airtel callback.
     */
    public function handleAirtelCallback(array $payload, string $raw): void
    {
        $originalId = $payload['originalRequestId'] ?? null;
        $transactionId = $payload['transactionId'] ?? null;
        $payment = null;
        if ($originalId) { $payment = Payment::where('external_request_id',$originalId)->first(); }
        if (!$payment && $transactionId) { $payment = Payment::where('external_transaction_id',$transactionId)->first(); }
        if (!$payment) { return; }
    if (in_array($payment->status,[PaymentStatus::SUCCESS->value,PaymentStatus::FAILED->value])) { return; }
        $payment->raw_callback_payload = $raw;
        $statusCode = $payload['statusCode'] ?? null;
        $success = $statusCode && (strtoupper($statusCode) === 'SUCCESS' || $statusCode === '000');
    $payment->status = $success ? PaymentStatus::SUCCESS->value : PaymentStatus::FAILED->value;
        if ($transactionId) { $payment->external_transaction_id = $transactionId; }
        if (!empty($payload['msisdn'])) { $payment->phone_number = $payload['msisdn']; }
        if ($success) { $this->progressOrder($payment); }
        $payment->save();
    }

    /**
     * Manual reconciliation (simulated) similar to Java.
     */
    public function reconcileManual(array $data): Payment
    {
        $payment = null;
        if (!empty($data['payment_id'])) {
            $payment = Payment::findOrFail($data['payment_id']);
        } elseif (!empty($data['order_id'])) {
            $payment = Payment::where('order_id',$data['order_id'])->firstOrFail();
        } else {
            abort(422,'payment_id or order_id required');
        }
    if ($payment->status !== PaymentStatus::INITIATED->value) { return $payment; }
        if (!empty($data['provider']) && $payment->provider !== $data['provider']) {
            abort(422,'Provider mismatch');
        }
        $phoneOk = empty($data['phone_number']) || empty($payment->phone_number) || str_ends_with($payment->phone_number, substr($data['phone_number'],-6));
        $amountOk = empty($data['amount']) || (float)$payment->amount == (float)$data['amount'];
        if ($phoneOk && $amountOk) {
            $payment->status = PaymentStatus::SUCCESS->value;
            if (!$payment->external_transaction_id) {
                $payment->external_transaction_id = 'MANUAL-'.now()->timestamp;
            }
            $this->progressOrder($payment);
            $payment->save();
        }
        return $payment;
    }

    protected function progressOrder(Payment $payment): void
    {
        $order = $payment->order; // relation lazy loaded if not loaded
        if ($order && $order->status === 'PENDING' && $payment->status === PaymentStatus::SUCCESS->value) {
            $order->status = 'PROCESSING';
            $order->save();
        }
    }
}
