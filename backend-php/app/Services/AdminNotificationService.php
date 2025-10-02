<?php

namespace App\Services;

use App\Models\AdminNotification;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductRating;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class AdminNotificationService
{
    public function __construct(private SystemSettingService $settings)
    {
    }

    public function notify(array $payload, ?string $dedupeKey = null): AdminNotification
    {
        $attributes = array_merge([
            'type' => 'generic',
            'title' => 'Notification',
            'message' => null,
            'severity' => 'info',
            'context_type' => null,
            'context_id' => null,
            'data' => null,
        ], $payload);

        if ($dedupeKey) {
            $notification = AdminNotification::query()->where('dedupe_key', $dedupeKey)->first();
            if ($notification) {
                $notification->fill($attributes);
                $notification->read_at = null;
                $notification->save();
                return $notification;
            }
        }

        $notification = new AdminNotification($attributes);
        $notification->dedupe_key = $dedupeKey;
        $notification->save();

        return $notification;
    }

    public function notifyNewOrder(Order $order): AdminNotification
    {
        $order->loadMissing(['items.product']);
        $title = sprintf('New order #%s received', $order->order_number ?? $order->id);
        $message = sprintf('Order total %s for %s item(s).',
            number_format((float)$order->total_gross, 2),
            $order->items->sum('quantity')
        );

        return $this->notify([
            'type' => 'order.new',
            'title' => $title,
            'message' => $message,
            'severity' => 'info',
            'context_type' => 'order',
            'context_id' => $order->id,
            'data' => [
                'orderId' => $order->id,
                'orderNumber' => $order->order_number,
                'totalGross' => (float) $order->total_gross,
                'status' => $order->status,
            ],
        ]);
    }

    public function notifyHighValueOrder(Order $order): void
    {
        $threshold = (float) ($this->settings->get('orders.high_value_threshold', 25000));
        if ($threshold <= 0) {
            return;
        }

        if ((float) $order->total_gross < $threshold) {
            return;
        }

        $dedupeKey = sprintf('order.high-value:%d:%s', $order->id, (string) $order->order_number);

        $this->notify([
            'type' => 'order.high_value',
            'title' => 'High value order pending review',
            'message' => sprintf('Order #%s totals %s and may need manual review.', $order->order_number ?? $order->id, number_format((float) $order->total_gross, 2)),
            'severity' => 'warning',
            'context_type' => 'order',
            'context_id' => $order->id,
            'data' => [
                'orderId' => $order->id,
                'orderNumber' => $order->order_number,
                'totalGross' => (float) $order->total_gross,
            ],
        ], $dedupeKey);
    }

    public function notifyDeliveryRequest(Order $order): void
    {
        if (strtoupper($order->delivery_type ?? '') !== 'DELIVERY') {
            return;
        }

        $dedupeKey = sprintf('delivery.request:%d', $order->id);

        $this->notify([
            'type' => 'delivery.requested',
            'title' => 'Delivery requested',
            'message' => sprintf('Order #%s requires delivery assignment.', $order->order_number ?? $order->id),
            'severity' => 'info',
            'context_type' => 'order',
            'context_id' => $order->id,
            'data' => [
                'orderId' => $order->id,
                'orderNumber' => $order->order_number,
                'deliveryStatus' => $order->delivery_status,
            ],
        ], $dedupeKey);
    }

    public function notifyLowStock(Product $product): void
    {
        if ($product->stock === null) {
            return;
        }
        $threshold = $product->low_stock_threshold;
        if ($threshold === null) {
            $threshold = (int) $this->settings->get('inventory.low_stock_threshold', 5);
        }
        $threshold = (int) $threshold;

        if ($threshold > 0 && $product->stock <= $threshold) {
            $key = sprintf('inventory.low:%d', $product->id);

            $this->notify([
                'type' => 'inventory.low_stock',
                'title' => 'Product nearing depletion',
                'message' => sprintf('%s stock is down to %d units.', $product->name, $product->stock),
                'severity' => $product->stock <= 0 ? 'danger' : 'warning',
                'context_type' => 'product',
                'context_id' => $product->id,
                'data' => [
                    'productId' => $product->id,
                    'productName' => $product->name,
                    'stock' => $product->stock,
                    'lowStockThreshold' => $threshold,
                ],
            ], $key);
        }

        if ($product->stock <= 0) {
            $outKey = sprintf('inventory.out:%d', $product->id);
            $this->notify([
                'type' => 'inventory.out_of_stock',
                'title' => 'Product out of stock',
                'message' => sprintf('%s is now out of stock.', $product->name),
                'severity' => 'danger',
                'context_type' => 'product',
                'context_id' => $product->id,
                'data' => [
                    'productId' => $product->id,
                    'productName' => $product->name,
                    'stock' => $product->stock,
                    'lowStockThreshold' => $threshold > 0 ? $threshold : null,
                ],
            ], $outKey);
        }
    }

    public function notifyNewRating(ProductRating $rating): void
    {
        $product = $rating->relationLoaded('product') ? $rating->product : $rating->product()->first();
    $title = sprintf('New rating on %s', $product?->name ?? 'a product');
    $snippet = $rating->comment ? Str::of($rating->comment)->limit(80) : null;
    $message = sprintf('Rated %d★%s', $rating->rating, $snippet ? ' – "' . $snippet . '"' : '');

        $this->notify([
            'type' => 'rating.new',
            'title' => $title,
            'message' => $message,
            'severity' => 'info',
            'context_type' => 'product',
            'context_id' => $rating->product_id,
            'data' => [
                'ratingId' => $rating->id,
                'productId' => $rating->product_id,
                'rating' => $rating->rating,
                'title' => $rating->title,
                'comment' => $rating->comment,
                'customerName' => $rating->customer_name,
                'isVerified' => (bool) $rating->is_verified,
            ],
        ]);
    }

    public function syncDelayedOrders(): void
    {
        $hours = max(1, (int) ($this->settings->get('orders.delay_alert_hours', 6)));
        $threshold = Carbon::now()->subHours($hours);

        $orders = Order::query()
            ->whereIn('status', ['PENDING', 'PROCESSING'])
            ->where('created_at', '<=', $threshold)
            ->with('latestPayment')
            ->get();

        foreach ($orders as $order) {
            $latestPayment = $order->latestPayment;
            if (!$latestPayment || !in_array($latestPayment->status, ['PAID', 'CAPTURED', 'SETTLED'], true)) {
                continue;
            }

            $key = sprintf('order.delay:%d', $order->id);
            $this->notify([
                'type' => 'order.delay',
                'title' => 'Order awaiting fulfillment',
                'message' => sprintf('Order #%s has been waiting for shipping for over %d hours.', $order->order_number ?? $order->id, $hours),
                'severity' => 'warning',
                'context_type' => 'order',
                'context_id' => $order->id,
                'data' => [
                    'orderId' => $order->id,
                    'orderNumber' => $order->order_number,
                    'status' => $order->status,
                    'paymentStatus' => $latestPayment->status,
                    'ageHours' => $order->created_at?->diffInHours(now()),
                ],
            ], $key);
        }
    }

    public function list(array $filters = [], int $page = 1, int $size = 20): LengthAwarePaginator
    {
        $size = max(1, min(100, $size));

        /** @var Builder $query */
        $query = AdminNotification::query()->latest('created_at');

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (!empty($filters['severity'])) {
            $query->where('severity', $filters['severity']);
        }

        if (array_key_exists('unread', $filters)) {
            if (filter_var($filters['unread'], FILTER_VALIDATE_BOOLEAN)) {
                $query->whereNull('read_at');
            } else {
                $query->whereNotNull('read_at');
            }
        }

        if (!empty($filters['search'])) {
            $query->where(function (Builder $builder) use ($filters) {
                $builder->where('title', 'ilike', '%' . addcslashes($filters['search'], '%_') . '%')
                    ->orWhere('message', 'ilike', '%' . addcslashes($filters['search'], '%_') . '%');
            });
        }

        return $query->paginate($size, ['*'], 'page', $page);
    }

    public function markAllRead(): int
    {
        return AdminNotification::query()->whereNull('read_at')->update(['read_at' => now()]);
    }

    public function markRead(AdminNotification $notification, bool $read = true): void
    {
        if ($read) {
            $notification->markAsRead();
        } else {
            $notification->markAsUnread();
        }
    }
}
