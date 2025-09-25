<?php

use App\Models\User;
use App\Enums\Role;
use App\Models\PaymentOption;
use function Pest\Laravel\postJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\putJson;

beforeEach(function(){
    $this->admin = User::factory()->create(['role'=>Role::ADMIN,'password'=>bcrypt('password')]);
});

it('lists and creates payment options', function(){
    $token = $this->admin->createToken('t')->plainTextToken;
    // seed create
    $create = postJson('/api/admin/payment-options', [
        'code'=>'TESTPAY','name'=>'Test Pay','type'=>'OTHER','active'=>true,'fee_fixed'=>1.5,'fee_percent'=>2.25
    ], ['Authorization'=>'Bearer '.$token]);
    $create->assertStatus(201)->assertJsonPath('code','TESTPAY');

    $list = getJson('/api/admin/payment-options', ['Authorization'=>'Bearer '.$token]);
    $list->assertStatus(200)->assertJson(fn($json)=> $json->whereType('', 'array')->etc());
});

it('activates and deactivates payment option', function(){
    $token = $this->admin->createToken('t')->plainTextToken;
    $opt = PaymentOption::create(['code'=>'TEMP','name'=>'Temp','type'=>'OTHER','active'=>false]);
    postJson("/api/admin/payment-options/{$opt->id}/activate", [], ['Authorization'=>'Bearer '.$token])
        ->assertStatus(200)->assertJsonPath('active', true);
    postJson("/api/admin/payment-options/{$opt->id}/deactivate", [], ['Authorization'=>'Bearer '.$token])
        ->assertStatus(200)->assertJsonPath('active', false);
});
