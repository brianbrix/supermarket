<?php

namespace Database\Seeders;

use App\Models\DeliveryShop;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DeliveryShopSeeder extends Seeder
{
    public function run(): void
    {
        if (DeliveryShop::query()->exists()) {
            return;
        }

        $shops = [
            [
                'name' => 'CBD Fulfilment Centre',
                'description' => 'Central dispatch hub',
                'phone' => '+254700000001',
                'email' => 'cbd@supermarket.test',
                'address_line1' => 'Kimathi Street',
                'city' => 'Nairobi',
                'region' => 'Nairobi County',
                'lat' => -1.28333,
                'lng' => 36.81667,
                'service_radius_km' => 12,
            ],
            [
                'name' => 'Westlands Store',
                'description' => 'Covers Westlands and Parklands',
                'phone' => '+254700000002',
                'email' => 'westlands@supermarket.test',
                'address_line1' => 'Ring Road Parklands',
                'city' => 'Nairobi',
                'region' => 'Nairobi County',
                'lat' => -1.26342,
                'lng' => 36.8110,
                'service_radius_km' => 10,
            ],
        ];

        foreach ($shops as $shop) {
            DeliveryShop::create([
                'name' => $shop['name'],
                'slug' => Str::slug($shop['name']),
                'description' => $shop['description'] ?? null,
                'phone' => $shop['phone'] ?? null,
                'email' => $shop['email'] ?? null,
                'address_line1' => $shop['address_line1'] ?? null,
                'address_line2' => $shop['address_line2'] ?? null,
                'city' => $shop['city'] ?? null,
                'region' => $shop['region'] ?? null,
                'postal_code' => $shop['postal_code'] ?? null,
                'lat' => $shop['lat'] ?? null,
                'lng' => $shop['lng'] ?? null,
                'service_radius_km' => $shop['service_radius_km'] ?? null,
                'opening_hours' => $shop['opening_hours'] ?? null,
                'delivery_window_minutes' => $shop['delivery_window_minutes'] ?? null,
                'is_active' => true,
            ]);
        }
    }
}
