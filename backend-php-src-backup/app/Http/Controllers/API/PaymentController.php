<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PaymentController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    // Generic create or fetch (idempotent by order)
    public function create(Request $request)
    {
        $data = $request->validate([
            'order_id' => 'required|integer|exists:orders,id',
            'method' => 'nullable|string|max:32'
        ]);
        $payment = $this->payments->createOrFetch($data['order_id'], Auth::id(), $data['method'] ?? null);
        return new PaymentResource($payment);
    }

    // Automated (STK / provider) initiation
    public function initiateMobileMoney(Request $request)
    {
        $data = $request->validate([
            'order_id' => 'required|integer|exists:orders,id',
            'provider' => 'required|string|in:MPESA,AIRTEL',
            'channel' => 'required|string|max:64',
            'phone_number' => 'nullable|string|max:32',
            'amount' => 'nullable|numeric|min:0',
            'method' => 'nullable|string|max:32',
            'supports_stk' => 'nullable|boolean'
        ]);
        $payment = $this->payments->initiateMobileMoney($data, Auth::id());
        return new PaymentResource($payment);
    }

    // Manual mobile money referencing PaymentOption
    public function initiateManual(Request $request)
    {
        $data = $request->validate([
            'order_id' => 'required|integer|exists:orders,id',
            'payment_option_id' => 'required|integer|exists:payment_options,id',
            'amount' => 'nullable|numeric|min:0',
            'phone_number' => 'nullable|string|max:32',
            'account_reference' => 'nullable|string|max:64',
            'narration' => 'nullable|string|max:128'
        ]);
        $payment = $this->payments->initiateManual($data, Auth::id());
        return new PaymentResource($payment);
    }

    public function reconcileManual(Request $request)
    {
        $data = $request->validate([
            'payment_id' => 'nullable|integer|exists:payments,id',
            'order_id' => 'nullable|integer|exists:orders,id',
            'provider' => 'nullable|string|in:MPESA,AIRTEL',
            'phone_number' => 'nullable|string|max:32',
            'amount' => 'nullable|numeric|min:0'
        ]);
        if (empty($data['payment_id']) && empty($data['order_id'])) {
            return response()->json(['error'=>'payment_id or order_id required'],422);
        }
        $payment = $this->payments->reconcileManual($data);
        return new PaymentResource($payment);
    }

    public function getByOrder(int $orderId)
    {
        $payment = Payment::where('order_id',$orderId)->firstOrFail();
        return new PaymentResource($payment);
    }

    // Webhook: MPESA STK callback
    public function mpesaCallback(Request $request)
    {
        $raw = $request->getContent();
        $json = json_decode($raw,true);
        if (is_array($json)) {
            $this->payments->handleMpesaCallback($json,$raw);
        }
        return response()->json(['status'=>'ok']);
    }

    // Webhook: Airtel Money callback
    public function airtelCallback(Request $request)
    {
        $raw = $request->getContent();
        $json = json_decode($raw,true);
        if (is_array($json)) {
            $this->payments->handleAirtelCallback($json,$raw);
        }
        return response()->json(['status'=>'ok']);
    }

    // Admin explicit confirmation override (e.g. after offline verification)
    public function confirm(Payment $payment, Request $request)
    {
        $request->validate([
            'external_transaction_id' => 'nullable|string|max:128',
            'force' => 'nullable|boolean'
        ]);
        if (!in_array($payment->status, ['INITIATED','PENDING'])) {
            return new PaymentResource($payment); // already terminal
        }
        $payment->status = 'SUCCESS';
        if ($request->filled('external_transaction_id')) {
            $payment->external_transaction_id = $request->input('external_transaction_id');
        } elseif (!$payment->external_transaction_id) {
            $payment->external_transaction_id = 'ADMINCONFIRM-'.now()->timestamp;
        }
        // Progress order if appropriate
        if ($payment->order && $payment->order->status === 'PENDING') {
            $payment->order->status = 'PROCESSING';
            $payment->order->save();
        }
        $payment->save();
        return new PaymentResource($payment);
    }
}
