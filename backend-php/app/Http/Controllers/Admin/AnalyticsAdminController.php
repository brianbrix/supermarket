<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductRating;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsAdminController extends Controller
{
    private const CACHE_PREFIX = 'analytics:overview:';
    private const CACHE_TTL_SECONDS = 300;

    public function overview(Request $request)
    {
        $rangeDays = max(1, min(365, (int)$request->query('rangeDays', 30)));
        $fromParam = $request->query('from');
        $toParam = $request->query('to');

        $now = Carbon::now();
        $from = $fromParam ? Carbon::parse($fromParam)->startOfDay() : $now->copy()->subDays($rangeDays - 1)->startOfDay();
        $to = $toParam ? Carbon::parse($toParam)->endOfDay() : $now->copy()->endOfDay();

        if ($to->lt($from)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }
        $queryParams = $request->query();
        ksort($queryParams);

        $cacheKey = self::CACHE_PREFIX . md5(json_encode([
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rangeDays' => $rangeDays,
            'params' => $queryParams,
        ]));

        $payload = Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($from, $to, $rangeDays) {
            return $this->compileOverviewPayload($from->copy(), $to->copy(), $rangeDays);
        });

        return response()->json($payload);
    }

    private function compileOverviewPayload(Carbon $from, Carbon $to, int $rangeDays): array
    {
        $orders = Order::whereBetween('created_at', [$from->copy(), $to->copy()])
            ->get(['id', 'total_gross', 'status', 'created_at', 'user_id', 'customer_phone']);

        $revenueStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
        $revenueOrders = $orders->filter(function ($order) use ($revenueStatuses) {
            $status = strtoupper($order->status ?? '');
            return in_array($status, $revenueStatuses, true);
        });

        $totalRevenue = (float) $revenueOrders->sum('total_gross');
        $orderCount = $orders->count();
        $completedOrderCount = $revenueOrders->count();
        $averageOrderValue = $completedOrderCount > 0 ? $totalRevenue / $completedOrderCount : 0.0;

        $uniqueCustomers = $orders
            ->map(function (Order $order) {
                if ($order->user_id) {
                    return 'U:' . $order->user_id;
                }
                if (!empty($order->customer_phone)) {
                    return 'P:' . $order->customer_phone;
                }
                return null;
            })
            ->filter()
            ->unique()
            ->count();

        $statusTemplate = array_fill_keys(Order::STATUSES, 0);
        foreach ($orders as $order) {
            $status = strtoupper($order->status ?? '');
            if (array_key_exists($status, $statusTemplate)) {
                $statusTemplate[$status]++;
            } else {
                $statusTemplate[$status] = ($statusTemplate[$status] ?? 0) + 1;
            }
        }

        $statusBreakdown = collect($statusTemplate)
            ->map(function ($count, $status) {
                return [
                    'status' => $status,
                    'count' => $count,
                ];
            })
            ->values();

        $trend = [];
        for ($cursor = $from->copy(); $cursor <= $to; $cursor->addDay()) {
            $dayStart = $cursor->copy()->startOfDay();
            $dayEnd = $cursor->copy()->endOfDay();
            $dayOrders = $revenueOrders->filter(function ($order) use ($dayStart, $dayEnd) {
                return $order->created_at >= $dayStart && $order->created_at <= $dayEnd;
            });

            $trend[] = [
                'date' => $dayStart->toDateString(),
                'revenue' => round((float) $dayOrders->sum('total_gross'), 2),
                'orders' => $dayOrders->count(),
            ];
        }

        $bestDay = collect($trend)->sortByDesc('revenue')->first();

        $previousFrom = $from->copy()->subDays($rangeDays);
        $previousTo = $from->copy()->subDay()->endOfDay();
        $previousRevenue = Order::whereBetween('created_at', [$previousFrom, $previousTo])
            ->whereIn('status', $revenueStatuses)
            ->sum('total_gross');

        $revenueChangePct = $previousRevenue > 0
            ? (($totalRevenue - (float) $previousRevenue) / (float) $previousRevenue) * 100
            : null;

        $topProducts = OrderItem::select('product_id', DB::raw('SUM(quantity) as quantity'), DB::raw('SUM(quantity * unit_price_gross) as gross'))
            ->whereHas('order', function ($query) use ($from, $to) {
                $query->whereBetween('created_at', [$from->copy(), $to->copy()]);
            })
            ->groupBy('product_id')
            ->orderByDesc('quantity')
            ->with('product:id,name,rating_avg,rating_count')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->product_id,
                    'name' => optional($row->product)->name ?? 'Unnamed Product',
                    'quantity' => (int) $row->quantity,
                    'gross' => round((float) $row->gross, 2),
                    'ratingAverage' => optional($row->product)->rating_avg ? round((float) $row->product->rating_avg, 2) : null,
                    'ratingCount' => optional($row->product)->rating_count ?? 0,
                ];
            });

        return [
            'range' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'days' => $from->diffInDays($to) + 1,
            ],
            'metrics' => [
                'totalRevenue' => round($totalRevenue, 2),
                'orderCount' => $orderCount,
                'completedOrderCount' => $completedOrderCount,
                'averageOrderValue' => round($averageOrderValue, 2),
                'uniqueCustomers' => $uniqueCustomers,
                'revenueChangePct' => $revenueChangePct !== null ? round($revenueChangePct, 2) : null,
                'bestDay' => $bestDay['date'] ?? null,
                'bestDayRevenue' => isset($bestDay['revenue']) ? (float) $bestDay['revenue'] : null,
            ],
            'trend' => $trend,
            'statusBreakdown' => $statusBreakdown,
            'topProducts' => $topProducts,
            'ratings' => $this->ratingSummary(),
        ];
    }

    private function ratingSummary(): array
    {
        return Cache::remember('analytics:ratings:summary', self::CACHE_TTL_SECONDS, function () {
            $total = ProductRating::count();
            $average = $total > 0 ? round((float) ProductRating::avg('rating'), 2) : 0.0;
            $verified = $total > 0 ? ProductRating::where('is_verified', true)->count() : 0;

            $bestProducts = Product::query()
                ->where('rating_count', '>=', 5)
                ->orderByDesc('rating_avg')
                ->orderByDesc('rating_count')
                ->limit(5)
                ->get(['id', 'name', 'rating_avg', 'rating_count']);

            $lowestProducts = Product::query()
                ->where('rating_count', '>=', 5)
                ->orderBy('rating_avg')
                ->orderByDesc('rating_count')
                ->limit(5)
                ->get(['id', 'name', 'rating_avg', 'rating_count']);

            return [
                'average' => $average,
                'count' => $total,
                'verifiedShare' => $total > 0 ? round(($verified / $total) * 100, 2) : 0.0,
                'best' => $bestProducts->map(fn (Product $product) => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'ratingAverage' => round((float) $product->rating_avg, 2),
                    'ratingCount' => (int) $product->rating_count,
                ])->values(),
                'worst' => $lowestProducts->map(fn (Product $product) => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'ratingAverage' => round((float) $product->rating_avg, 2),
                    'ratingCount' => (int) $product->rating_count,
                ])->values(),
            ];
        });
    }
}
