<?php

use App\Models\User;
use App\Enums\Role;
use App\Models\Product;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;
use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;

beforeEach(function(){
    $this->admin = User::factory()->create(['role'=>Role::ADMIN,'password'=>bcrypt('password')]);
});

it('creates updates and deletes a product', function(){
    $token = $this->admin->createToken('t')->plainTextToken;
    $create = postJson('/api/admin/products', [
        'name'=>'Test Product','price'=>123.45,'stock'=>10
    ], ['Authorization'=>'Bearer '.$token]);
    $create->assertStatus(201);
    $id = $create->json('id');

    $update = putJson("/api/admin/products/$id", ['stock'=>5], ['Authorization'=>'Bearer '.$token]);
    $update->assertStatus(200)->assertJsonPath('stock',5);

    $list = getJson('/api/admin/products', ['Authorization'=>'Bearer '.$token]);
    $list->assertStatus(200)->assertJsonStructure(['content','page']);

    $delete = deleteJson("/api/admin/products/$id", [], ['Authorization'=>'Bearer '.$token]);
    $delete->assertStatus(200)->assertJsonPath('deleted', true);
});
