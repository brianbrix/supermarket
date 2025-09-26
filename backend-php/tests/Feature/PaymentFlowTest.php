<?php

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\PaymentOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function() {
    // Minimal user & order setup
    $this->user = User::factory()->create();
    $this->order = Order::factory()->create([
        'user_id' => $this->user->id,
        'total_gross' => 1500,
        'total_net' => 1293.10,
        'vat_amount' => 206.90,
        'status' => 'PENDING'
    ]);
    // Payment option with supports STK semantics via meta
    $this->option = PaymentOption::create([
        'code' => 'MPESA_PAYBILL',
        'name' => 'M-Pesa PayBill',
        'provider' => 'MPESA',
        'type' => 'MOBILE',
        'active' => true,
        'fee_fixed' => 0,
        'fee_percent' => 0,
        'meta' => ['channel' => 'MPESA_PAYBILL']
    ]);
});

it('initiates mobile money payment (STK simulation)', function() {
    $resp = $this->postJson('/api/payments/mobile-money/initiate', [
        'order_id' => $this->order->id,
        'provider' => 'MPESA',
        'channel' => 'MPESA_STK_PUSH',
        'phone_number' => '254700000001'
    ]);
    $resp->assertStatus(200)
        ->assertJsonPath('data.status','INITIATED')
        ->assertJsonStructure(['data'=>['externalRequestId']]);
});

it('initiates manual payment and reconciles to success', function() {
    $init = $this->postJson('/api/payments/manual/initiate', [
        'order_id' => $this->order->id,
        'payment_option_id' => $this->option->id,
        'phone_number' => '254711222333',
        'account_reference' => 'INV123'
    ]);
    $init->assertStatus(200);
    $paymentId = $init->json('data.id');
    // Reconcile (simulate provider settlement)
    $rec = $this->postJson('/api/payments/manual/reconcile', [
        'payment_id' => $paymentId,
        'provider' => 'MPESA',
        'phone_number' => '254711222333',
        'amount' => 1500
    ]);
    $rec->assertStatus(200)->assertJsonPath('data.status','SUCCESS');
});

it('creates cash on delivery payment as pending', function () {
    $this->actingAs($this->user);

    $resp = $this->postJson('/api/payments', [
        'order_id' => $this->order->id,
        'method' => 'CASH_ON_DELIVERY'
    ]);

    $resp->assertStatus(200)
        ->assertJsonPath('data.status', PaymentStatus::PENDING->value)
        ->assertJsonPath('data.method', 'CASH_ON_DELIVERY');
});

it('handles mpesa callback to success', function() {
    // initiate first
    $init = $this->postJson('/api/payments/mobile-money/initiate', [
        'order_id' => $this->order->id,
        'provider' => 'MPESA',
        'channel' => 'MPESA_STK_PUSH',
        'phone_number' => '254700000002'
    ])->assertStatus(200);
    $externalReq = $init->json('data.externalRequestId');
    // callback payload
    $payload = [
        'checkoutRequestID' => $externalReq,
        'resultCode' => 0,
        'resultDesc' => 'Success',
        'callbackMetadata' => [
            'item' => [
                ['name'=>'MpesaReceiptNumber','value'=>'RCP123ABC'],
            ]
        ]
    ];
    $this->postJson('/api/payments/mpesa/callback', $payload)->assertStatus(200);
    $this->getJson('/api/payments/order/'.$this->order->id)
        ->assertStatus(200)
        ->assertJsonPath('data.status','SUCCESS')
        ->assertJsonPath('data.externalTransactionId','RCP123ABC');
});

it('handles airtel callback to success', function() {
    $init = $this->postJson('/api/payments/mobile-money/initiate', [
        'order_id' => $this->order->id,
        'provider' => 'AIRTEL',
        'channel' => 'AIRTEL_STK_PUSH',
        'phone_number' => '254700000010'
    ])->assertStatus(200);
    $externalReq = $init->json('data.externalRequestId');
    $payload = [
        'statusCode' => 'SUCCESS',
        'statusMessage' => 'OK',
        'transactionId' => 'ATX123456',
        'msisdn' => '254700000010',
        'amount' => 1500,
        'originalRequestId' => $externalReq
    ];
    $this->postJson('/api/payments/airtel/callback', $payload)->assertStatus(200);
    $this->getJson('/api/payments/order/'.$this->order->id)
        ->assertStatus(200)
        ->assertJsonPath('data.status','SUCCESS')
        ->assertJsonPath('data.externalTransactionId','ATX123456');
});

it('marks mpesa callback failure', function() {
    $init = $this->postJson('/api/payments/mobile-money/initiate', [
        'order_id' => $this->order->id,
        'provider' => 'MPESA',
        'channel' => 'MPESA_STK_PUSH'
    ])->assertStatus(200);
    $externalReq = $init->json('data.externalRequestId');
    $payload = [
        'checkoutRequestID' => $externalReq,
        'resultCode' => 1032,
        'resultDesc' => 'Cancelled by user'
    ];
    $this->postJson('/api/payments/mpesa/callback', $payload)->assertStatus(200);
    $this->getJson('/api/payments/order/'.$this->order->id)
        ->assertStatus(200)
        ->assertJsonPath('data.status','FAILED');
});

it('marks airtel callback failure', function() {
    $init = $this->postJson('/api/payments/mobile-money/initiate', [
        'order_id' => $this->order->id,
        'provider' => 'AIRTEL',
        'channel' => 'AIRTEL_STK_PUSH'
    ])->assertStatus(200);
    $externalReq = $init->json('data.externalRequestId');
    $payload = [
        'statusCode' => 'FAILED',
        'statusMessage' => 'Insufficient funds',
        'transactionId' => 'ATXFAIL1',
        'originalRequestId' => $externalReq
    ];
    $this->postJson('/api/payments/airtel/callback', $payload)->assertStatus(200);
    $this->getJson('/api/payments/order/'.$this->order->id)
        ->assertStatus(200)
        ->assertJsonPath('data.status','FAILED');
});

it('admin confirm endpoint overrides to success', function() {
    $init = $this->postJson('/api/payments/mobile-money/initiate', [
        'order_id' => $this->order->id,
        'provider' => 'MPESA',
        'channel' => 'MPESA_STK_PUSH'
    ])->assertStatus(200);
    $paymentId = $init->json('data.id');
    // Simulate admin by bypassing auth for test (route accessible under /api/admin/payments/{payment}/confirm in reality)
    $this->postJson('/api/admin/payments/'.$paymentId.'/confirm', [
        'external_transaction_id' => 'OVERRIDE123'
    ])->assertStatus(200)->assertJsonPath('data.status','SUCCESS');
});
