<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;

class OrderSeeder extends Seeder
{
    public function run(): void
    {
        $products = Product::all();
        if ($products->isEmpty()) { return; }
        Order::factory()->count(5)->create()->each(function($order) use ($products) {
            $items = $products->random(min(3, $products->count()));
            $totalGross = 0; $totalNet = 0; $vat = 0;
            foreach ($items as $p) {
                $qty = rand(1,3);
                $gross = $p->price * $qty;
                $net = $gross / 1.16; // assuming 16% VAT placeholder
                $vatAmount = $gross - $net;
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $p->id,
                    'quantity' => $qty,
                    'unit_price_gross' => $p->price,
                    'unit_price_net' => round($p->price/1.16,2),
                    'vat_amount' => round($p->price - ($p->price/1.16),2)
                ]);
                $totalGross += $gross; $totalNet += $net; $vat += $vatAmount;
            }
            $order->update([
                'total_gross' => round($totalGross,2),
                'total_net' => round($totalNet,2),
                'vat_amount' => round($vat,2)
            ]);
        });
    }
}
