<?php

use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createAdminWithToken(): array
{
    $admin = User::factory()->create([
        'role' => Role::ADMIN,
        'password' => bcrypt('secret123'),
    ]);
    $token = $admin->createToken('test')->plainTextToken;
    return [$admin, $token];
}

it('allows admin to update cash on delivery payment status', function () {
    [$admin, $token] = createAdminWithToken();

    $order = Order::factory()->create([
        'user_id' => $admin->id,
        'status' => 'PENDING',
        'total_gross' => 1800,
        'total_net' => 1551.72,
        'vat_amount' => 248.28,
    ]);

    $payment = Payment::create([
        'order_id' => $order->id,
        'user_id' => $admin->id,
        'amount' => $order->total_gross,
        'currency' => 'KES',
        'method' => 'CASH_ON_DELIVERY',
        'channel' => null,
        'status' => PaymentStatus::PENDING->value,
        'provider' => null,
    ]);

    $response = $this->withHeaders([
        'Authorization' => 'Bearer ' . $token,
    ])->putJson('/api/admin/payments/' . $payment->id . '/status', [
        'status' => PaymentStatus::SUCCESS->value,
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.status', PaymentStatus::SUCCESS->value)
        ->assertJsonPath('data.method', 'CASH_ON_DELIVERY');

    expect($payment->fresh()->status)->toBe(PaymentStatus::SUCCESS->value);
    expect($order->fresh()->status)->toBe('PROCESSING');
});

it('rejects updates for non cash payments', function () {
    [$admin, $token] = createAdminWithToken();

    $order = Order::factory()->create([
        'status' => 'PENDING',
        'total_gross' => 2500,
        'total_net' => 2155.17,
        'vat_amount' => 344.83,
    ]);

    $payment = Payment::create([
        'order_id' => $order->id,
        'user_id' => $admin->id,
        'amount' => $order->total_gross,
        'currency' => 'KES',
        'method' => 'MOBILE_MONEY',
        'channel' => 'MPESA_STK_PUSH',
        'status' => PaymentStatus::INITIATED->value,
        'provider' => 'MPESA',
    ]);

    $this->withHeaders([
        'Authorization' => 'Bearer ' . $token,
    ])->putJson('/api/admin/payments/' . $payment->id . '/status', [
        'status' => PaymentStatus::SUCCESS->value,
    ])->assertStatus(422);
});

it('validates provided status value', function () {
    [$admin, $token] = createAdminWithToken();

    $order = Order::factory()->create([
        'status' => 'PENDING',
        'total_gross' => 800,
        'total_net' => 689.66,
        'vat_amount' => 110.34,
    ]);

    $payment = Payment::create([
        'order_id' => $order->id,
        'user_id' => $admin->id,
        'amount' => $order->total_gross,
        'currency' => 'KES',
        'method' => 'CASH_ON_DELIVERY',
        'status' => PaymentStatus::PENDING->value,
    ]);

    $this->withHeaders([
        'Authorization' => 'Bearer ' . $token,
    ])->putJson('/api/admin/payments/' . $payment->id . '/status', [
        'status' => 'PAID',
    ])->assertStatus(422);
});
