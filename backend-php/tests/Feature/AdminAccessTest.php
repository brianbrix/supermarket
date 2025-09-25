<?php

use App\Models\User;
use App\Models\Category;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use Illuminate\Support\Facades\Hash;
use App\Enums\Role;

beforeEach(function() {
    // minimal category for potential relations (not strictly required here)
    Category::factory()->create();
});

function adminUser(): User {
    return User::factory()->create([
        'role' => Role::ADMIN,
        'password' => bcrypt('password')
    ]);
}

function normalUser(): User {
    return User::factory()->create([
        'role' => Role::USER,
        'password' => bcrypt('password')
    ]);
}

it('denies guest access to admin orders', function() {
    getJson('/api/admin/orders')->assertStatus(401); // handled by auth middleware later
});

it('forbids regular user from admin orders', function() {
    $user = normalUser();
    $token = $user->createToken('test')->plainTextToken;
    getJson('/api/admin/orders', [ 'Authorization' => 'Bearer '.$token ])
        ->assertStatus(403);
});

it('allows admin user to access admin orders', function() {
    $admin = adminUser();
    $token = $admin->createToken('test')->plainTextToken;
    getJson('/api/admin/orders', [ 'Authorization' => 'Bearer '.$token ])
        ->assertStatus(200);
});

it('restricts category mutation to admin', function() {
    $user = normalUser();
    $userToken = $user->createToken('test')->plainTextToken;

    postJson('/api/admin/categories', ['name' => 'NewCat'], [ 'Authorization' => 'Bearer '.$userToken ])
        ->assertStatus(403);

    $admin = adminUser();
    $adminToken = $admin->createToken('test')->plainTextToken;
    postJson('/api/admin/categories', ['name' => 'AdminCat'], [ 'Authorization' => 'Bearer '.$adminToken ])
        ->assertStatus(201);
});
