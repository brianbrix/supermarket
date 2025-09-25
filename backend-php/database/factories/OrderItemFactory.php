<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Order;

class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    public function definition(): array
    {
        $unitGross = $this->faker->randomFloat(2, 1, 100);
        $unitNet = round($unitGross / 1.16, 2);
        return [
            'order_id' => Order::factory(),
            'product_id' => Product::factory(),
            'quantity' => $this->faker->numberBetween(1,5),
            'unit_price_gross' => $unitGross,
            'unit_price_net' => $unitNet,
            'vat_amount' => round($unitGross - $unitNet, 2)
        ];
    }
}
