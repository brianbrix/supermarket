<?php

namespace Database\Seeders;

use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductRating;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AdminNotificationSeeder extends Seeder
{
    public function run(): void
    {
        if (AdminNotification::query()->exists()) {
            return;
        }

        $now = Carbon::now();

        $assortedCrate = Product::query()->inRandomOrder()->first();
        if (!$assortedCrate) {
            $assortedCrate = Product::factory()->create([
                'name' => 'Assorted Pantry Crate',
                'brand' => 'Everyday Pantry',
                'price' => 3290,
                'stock' => 45,
                'unit' => 'crate',
            ]);
        }

        $lowStockProduct = Product::factory()->create([
            'name' => 'Sunrise Mango Crate',
            'brand' => 'Tropical Fields',
            'price' => 1899,
            'stock' => 3,
            'low_stock_threshold' => 8,
            'unit' => 'crate',
        ]);

        $outOfStockProduct = Product::factory()->create([
            'name' => 'Weekend Brunch Bundle',
            'brand' => 'Brunch Co.',
            'price' => 3490,
            'stock' => 0,
            'low_stock_threshold' => 5,
            'unit' => 'bundle',
        ]);

        $corporateBulkProduct = Product::factory()->create([
            'name' => 'Corporate Snack Crate',
            'brand' => 'Office Pantry',
            'price' => 4200,
            'stock' => 80,
            'low_stock_threshold' => 12,
            'unit' => 'crate',
        ]);

        $recentOrder = Order::factory()->create([
            'customer_name' => 'Jacinta Mwangi',
            'customer_phone' => '+254 700 100 200',
            'status' => 'PENDING',
            'delivery_type' => 'PICKUP',
        ]);

        $recentOrderTotals = $this->attachItems($recentOrder, [
            [$assortedCrate, 2],
            [$lowStockProduct, 1],
        ]);
        $recentOrder->update($recentOrderTotals);

        $highValueOrder = Order::factory()->create([
            'customer_name' => 'Mara Corporate Catering',
            'customer_phone' => '+254 722 888 111',
            'status' => 'PROCESSING',
            'delivery_type' => 'DELIVERY',
            'delivery_status' => 'REQUESTED',
            'delivery_requested_at' => Carbon::now()->subHours(4),
        ]);

        $highValueTotals = $this->attachItems($highValueOrder, [
            [$corporateBulkProduct, 12],
        ]);
        $highValueOrder->update($highValueTotals);

        $rating = ProductRating::create([
            'product_id' => $lowStockProduct->id,
            'rating' => 5,
            'title' => 'Spectacular mangoes',
            'comment' => 'Sweet, ripe, and arrived perfectly chilled. Definitely reordering.',
            'customer_name' => 'Yara Otieno',
            'is_verified' => true,
            'metadata' => [
                'headline' => 'customer_review',
            ],
        ]);

        $notifications = [
            [
                'type' => 'order.new',
                'title' => sprintf('New order #%s received', $recentOrder->order_number),
                'message' => sprintf('Order total KSh %s for %d item(s).',
                    number_format((float) $recentOrder->total_gross, 2),
                    $recentOrder->items()->sum('quantity')
                ),
                'severity' => 'info',
                'context_type' => 'order',
                'context_id' => $recentOrder->id,
                'data' => [
                    'orderId' => $recentOrder->id,
                    'orderNumber' => $recentOrder->order_number,
                    'totalGross' => (float) $recentOrder->total_gross,
                    'status' => $recentOrder->status,
                ],
                'dedupe_key' => sprintf('seed:order.new:%d', $recentOrder->id),
                'created_at' => $now->copy()->subMinutes(50),
            ],
            [
                'type' => 'order.high_value',
                'title' => 'High value order pending review',
                'message' => sprintf('Order #%s totals KSh %s and may need manual review.',
                    $highValueOrder->order_number,
                    number_format((float) $highValueOrder->total_gross, 2)
                ),
                'severity' => 'warning',
                'context_type' => 'order',
                'context_id' => $highValueOrder->id,
                'data' => [
                    'orderId' => $highValueOrder->id,
                    'orderNumber' => $highValueOrder->order_number,
                    'totalGross' => (float) $highValueOrder->total_gross,
                ],
                'dedupe_key' => sprintf('seed:order.high-value:%d', $highValueOrder->id),
                'created_at' => $now->copy()->subMinutes(40),
            ],
            [
                'type' => 'delivery.requested',
                'title' => 'Delivery requested',
                'message' => sprintf('Order #%s requires delivery assignment.', $highValueOrder->order_number),
                'severity' => 'info',
                'context_type' => 'order',
                'context_id' => $highValueOrder->id,
                'data' => [
                    'orderId' => $highValueOrder->id,
                    'orderNumber' => $highValueOrder->order_number,
                    'deliveryStatus' => $highValueOrder->delivery_status,
                ],
                'dedupe_key' => sprintf('seed:delivery.request:%d', $highValueOrder->id),
                'created_at' => $now->copy()->subMinutes(32),
            ],
            [
                'type' => 'inventory.low_stock',
                'title' => 'Product nearing depletion',
                'message' => sprintf('%s stock is down to %d units.', $lowStockProduct->name, $lowStockProduct->stock),
                'severity' => $lowStockProduct->stock <= 0 ? 'danger' : 'warning',
                'context_type' => 'product',
                'context_id' => $lowStockProduct->id,
                'data' => [
                    'productId' => $lowStockProduct->id,
                    'productName' => $lowStockProduct->name,
                    'stock' => $lowStockProduct->stock,
                    'lowStockThreshold' => $lowStockProduct->low_stock_threshold,
                ],
                'dedupe_key' => sprintf('seed:inventory.low:%d', $lowStockProduct->id),
                'created_at' => $now->copy()->subMinutes(28),
                'read_at' => $now->copy()->subMinutes(6),
            ],
            [
                'type' => 'inventory.out_of_stock',
                'title' => 'Product out of stock',
                'message' => sprintf('%s is now out of stock.', $outOfStockProduct->name),
                'severity' => 'danger',
                'context_type' => 'product',
                'context_id' => $outOfStockProduct->id,
                'data' => [
                    'productId' => $outOfStockProduct->id,
                    'productName' => $outOfStockProduct->name,
                    'stock' => $outOfStockProduct->stock,
                    'lowStockThreshold' => $outOfStockProduct->low_stock_threshold,
                ],
                'dedupe_key' => sprintf('seed:inventory.out:%d', $outOfStockProduct->id),
                'created_at' => $now->copy()->subMinutes(20),
            ],
            [
                'type' => 'rating.new',
                'title' => sprintf('New rating on %s', $lowStockProduct->name),
                'message' => sprintf('Rated %d★ – "%s"', $rating->rating, 'Sweet, ripe, and arrived perfectly chilled.'),
                'severity' => 'info',
                'context_type' => 'product',
                'context_id' => $lowStockProduct->id,
                'data' => [
                    'ratingId' => $rating->id,
                    'productId' => $lowStockProduct->id,
                    'rating' => $rating->rating,
                    'title' => $rating->title,
                    'comment' => $rating->comment,
                    'customerName' => $rating->customer_name,
                    'isVerified' => (bool) $rating->is_verified,
                ],
                'created_at' => $now->copy()->subMinutes(12),
            ],
            [
                'type' => 'order.delay',
                'title' => 'Order awaiting fulfillment',
                'message' => sprintf('Order #%s has been waiting for shipping for over %d hours.', $highValueOrder->order_number, 6),
                'severity' => 'warning',
                'context_type' => 'order',
                'context_id' => $highValueOrder->id,
                'data' => [
                    'orderId' => $highValueOrder->id,
                    'orderNumber' => $highValueOrder->order_number,
                    'status' => $highValueOrder->status,
                    'paymentStatus' => null,
                    'ageHours' => 6,
                ],
                'dedupe_key' => sprintf('seed:order.delay:%d', $highValueOrder->id),
                'created_at' => $now->copy()->subMinutes(8),
                'read_at' => $now->copy()->subMinutes(2),
            ],
        ];

        foreach ($notifications as $payload) {
            $createdAt = $payload['created_at'] ?? $now;
            $readAt = $payload['read_at'] ?? null;
            unset($payload['created_at'], $payload['read_at']);

            $notification = new AdminNotification($payload);
            $notification->created_at = $createdAt;
            $notification->updated_at = $createdAt;
            if ($readAt) {
                $notification->read_at = $readAt;
            }
            $notification->save();
        }
    }

    private function attachItems(Order $order, array $items): array
    {
        $totalGross = 0;
        $totalNet = 0;
        $vatAmount = 0;

        foreach ($items as [$product, $quantity]) {
            $unitGross = (float) $product->price;
            $gross = $unitGross * $quantity;
            $net = round($unitGross / 1.16, 2);
            $lineNet = round($net * $quantity, 2);
            $lineVat = round($gross - $lineNet, 2);

            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'quantity' => $quantity,
                'unit_price_gross' => $unitGross,
                'unit_price_net' => $net,
                'vat_amount' => round($unitGross - $net, 2),
            ]);

            $totalGross += $gross;
            $totalNet += $lineNet;
            $vatAmount += $lineVat;
        }

        return [
            'total_gross' => round($totalGross, 2),
            'total_net' => round($totalNet, 2),
            'vat_amount' => round($vatAmount, 2),
        ];
    }
}
