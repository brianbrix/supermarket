<?php

namespace Database\Seeders;

use App\Models\Coupon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class CouponSeeder extends Seeder
{
    public function run(): void
    {
        if (Coupon::count() > 0) {
            return;
        }

        Coupon::create([
            'code' => 'WELCOME10',
            'name' => 'Welcome 10% off',
            'description' => 'Save 10% on your first order over 1000.',
            'discount_type' => 'PERCENT',
            'discount_value' => 10,
            'max_discount_amount' => 2000,
            'min_order_amount' => 1000,
            'usage_limit' => 500,
            'usage_limit_per_user' => 1,
            'starts_at' => Carbon::now()->subDay(),
            'ends_at' => Carbon::now()->addMonths(6),
        ]);

        Coupon::create([
            'code' => 'FREESHIP',
            'name' => 'Free Shipping Voucher',
            'description' => 'Flat KES 300 off to cover delivery fees.',
            'discount_type' => 'FIXED',
            'discount_value' => 300,
            'min_order_amount' => 0,
            'usage_limit' => null,
            'usage_limit_per_user' => 5,
            'is_active' => true,
        ]);
    }
}
