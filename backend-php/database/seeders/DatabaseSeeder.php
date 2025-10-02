<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            AdminUserSeeder::class,
            BrandSeeder::class,
            PaymentOptionSeeder::class,
            CouponSeeder::class,
            ProductSeeder::class,
            ProductTagSeeder::class,
            DeliveryShopSeeder::class,
            HomepageLayoutSeeder::class,
            OrderSeeder::class,
            AdminNotificationSeeder::class,
        ]);
    }
}
