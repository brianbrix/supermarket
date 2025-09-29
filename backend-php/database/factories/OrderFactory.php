<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Order;

class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'customer_name' => $this->faker->name(),
            'customer_phone' => $this->faker->phoneNumber(),
            'status' => $this->faker->randomElement(Order::STATUSES),
            'total_gross' => 0,
            'total_net' => 0,
            'vat_amount' => 0,
            'thumbnail_url' => $this->faker->imageUrl(300,200,'business', true),
            'delivery_type' => 'PICKUP',
        ];
    }
}
