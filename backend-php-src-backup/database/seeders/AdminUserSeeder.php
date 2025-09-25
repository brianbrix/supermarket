<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        if (!User::where('username','admin')->exists()) {
            User::create([
                'username' => 'admin',
                'email' => 'admin@example.com',
                'password' => Hash::make('ChangeMe123!'),
                'first_name' => 'System',
                'last_name' => 'Admin',
                'role' => 'ADMIN',
                'active' => true
            ]);
        }
    }
}
