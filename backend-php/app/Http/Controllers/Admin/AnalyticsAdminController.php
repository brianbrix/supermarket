<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsAdminController extends Controller
{
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

        $orders = Order::whereBetween('created_at', [$from, $to])
            ->get(['id', 'total_gross', 'status', 'created_at', 'user_id', 'customer_phone']);

        $revenueStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
        $revenueOrders = $orders->filter(function ($order) use ($revenueStatuses) {
            $status = strtoupper($order->status ?? '');
            return in_array($status, $revenueStatuses, true);
        });

        $totalRevenue = (float)$revenueOrders->sum('total_gross');
        $orderCount = $orders->count();
        $completedOrderCount = $revenueOrders->count();
        $averageOrderValue = $completedOrderCount > 0 ? $totalRevenue / $completedOrderCount : 0.0;

        $identifier = function (Order $order) {
            if ($order->user_id) {
                return 'U:' . $order->user_id;
            }
            if (!empty($order->customer_phone)) {
                return 'P:' . $order->customer_phone;
            }
            return null;
        };

        $uniqueCustomers = $orders
            ->map($identifier)
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
        $cursor = $from->copy();
        while ($cursor <= $to) {
            $dayStart = $cursor->copy()->startOfDay();
            $dayEnd = $cursor->copy()->endOfDay();
            $dayOrders = $revenueOrders->filter(function ($order) use ($dayStart, $dayEnd) {
                return $order->created_at >= $dayStart && $order->created_at <= $dayEnd;
            });

            $trend[] = [
                'date' => $dayStart->toDateString(),
                'revenue' => round((float)$dayOrders->sum('total_gross'), 2),
                'orders' => $dayOrders->count(),
            ];

            $cursor->addDay();
        }

        $bestDay = collect($trend)
            ->sortByDesc('revenue')
            ->first();

        $previousFrom = $from->copy()->subDays($rangeDays);
        $previousTo = $from->copy()->subDay()->endOfDay();
        $previousRevenue = Order::whereBetween('created_at', [$previousFrom, $previousTo])
            ->whereIn('status', $revenueStatuses)
            ->sum('total_gross');

        $revenueChangePct = $previousRevenue > 0
            ? (($totalRevenue - (float)$previousRevenue) / (float)$previousRevenue) * 100
            : null;

        $topProducts = OrderItem::select('product_id', DB::raw('SUM(quantity) as quantity'), DB::raw('SUM(quantity * unit_price_gross) as gross'))
            ->whereHas('order', function ($query) use ($from, $to) {
                $query->whereBetween('created_at', [$from, $to]);
            })
            ->groupBy('product_id')
            ->orderByDesc('quantity')
            ->with('product:id,name')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->product_id,
                    'name' => optional($row->product)->name ?? 'Unnamed Product',
                    'quantity' => (int)$row->quantity,
                    'gross' => round((float)$row->gross, 2),
                ];
            });

        return response()->json([
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
                'bestDayRevenue' => isset($bestDay['revenue']) ? (float)$bestDay['revenue'] : null,
            ],
            'trend' => $trend,
            'statusBreakdown' => $statusBreakdown,
            'topProducts' => $topProducts,
        ]);
    }
}
