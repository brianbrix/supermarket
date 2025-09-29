<?php

namespace App\Console\Commands;

use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Services\PaymentService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ExpireStalePayments extends Command
{
    protected $signature = 'payments:expire-stale {--dry-run : Only report stale payments without updating them}';

    protected $description = 'Mark INITIATED payments that are older than the timeout window as failed';

    private const TIMEOUT_MINUTES = 3;

    public function __construct(private readonly PaymentService $paymentService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $cutoff = Carbon::now()->subMinutes(self::TIMEOUT_MINUTES);

        $query = Payment::query()
            ->where('status', PaymentStatus::INITIATED->value)
            ->where('updated_at', '<=', $cutoff);

        $count = (clone $query)->count();

        if ($count === 0) {
            $this->info('No stale payments found.');
            return Command::SUCCESS;
        }

        $this->info(sprintf('Found %d stale payment(s) older than %s.', $count, $cutoff->toDateTimeString()));

        if ($this->option('dry-run')) {
            (clone $query)
                ->orderBy('id')
                ->each(function (Payment $payment) {
                $this->line(sprintf('- Payment #%d for order #%d (updated %s)', $payment->id, $payment->order_id, optional($payment->updated_at)->toDateTimeString()));
                });
            $this->warn('Dry run complete. No changes were applied.');
            return Command::SUCCESS;
        }

        $query->orderBy('id')->chunkById(100, function ($payments) use ($cutoff) {
            foreach ($payments as $payment) {
                $context = [
                    'payment_id' => $payment->id,
                    'order_id' => $payment->order_id,
                    'previous_status' => $payment->status,
                    'updated_at' => optional($payment->updated_at)->toIso8601String(),
                    'cutoff' => $cutoff->toIso8601String(),
                ];

                $newerExists = Payment::query()
                    ->where('order_id', $payment->order_id)
                    ->where('id', '>', $payment->id)
                    ->exists();

                if ($newerExists) {
                    if ($payment->status !== PaymentStatus::FAILED->value) {
                        $payment->status = PaymentStatus::FAILED->value;
                        $payment->save();
                    }
                    Log::info('Marked stale payment as failed without failing order (newer payment found).', $context);
                    $this->line(sprintf('Payment #%d marked failed (newer attempt exists).', $payment->id));
                    continue;
                }

                $result = $this->paymentService->markOrderPaymentFailed(
                    $payment->order_id,
                    'STALE_PAYMENT_TIMEOUT',
                    $context
                );

                if (!$result) {
                    if ($payment->status !== PaymentStatus::FAILED->value) {
                        $payment->status = PaymentStatus::FAILED->value;
                        $payment->save();
                    }
                    Log::warning('Stale payment marked failed, but order missing.', $context);
                    $this->line(sprintf('Payment #%d marked failed (order missing).', $payment->id));
                    continue;
                }

                Log::warning('Stale payment timed out and marked failed.', $context);
                $this->line(sprintf('Payment #%d marked failed and order #%d failed.', $payment->id, $payment->order_id));
            }
        });

        return Command::SUCCESS;
    }
}
