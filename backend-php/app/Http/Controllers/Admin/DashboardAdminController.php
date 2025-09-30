<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardAdminController extends Controller
{
    private const STATS_CACHE_KEY = 'dashboard:stats';
    private const STATS_CACHE_TTL_SECONDS = 60;
    private const RECENT_CACHE_PREFIX = 'dashboard:recent:';

    public function stats()
    {
        $payload = Cache::remember(self::STATS_CACHE_KEY, self::STATS_CACHE_TTL_SECONDS, function () {
            $totalOrders = Order::count();
            $totalRevenue = (float) Order::sum('total_gross');
            $pendingOrders = Order::where('status', 'PENDING')->count();
            $processingOrders = Order::where('status', 'PROCESSING')->count();
            $completedOrders = Order::where('status', 'COMPLETED')->count();
            $cancelledOrders = Order::where('status', 'CANCELLED')->count();
            $deliveredOrders = Order::where('status', 'DELIVERED')->count();
            $refundedOrders = Order::where('status', 'REFUNDED')->count();
            $failedOrders = Order::where('status', 'FAILED')->count();

            $shippedOrders = Order::where('status', 'SHIPPED')->count();

            $totalProducts = Product::count();
            $totalAdmins = User::where('role', 'ADMIN')->count();
            $averageOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

            return [
                'totalOrders' => $totalOrders,
                'totalRevenue' => round($totalRevenue, 2),
                'averageOrderValue' => round($averageOrderValue, 2),
                'pendingOrders' => $pendingOrders,
                'processingOrders' => $processingOrders,
                'completedOrders' => $completedOrders,
                'cancelledOrders' => $cancelledOrders,
                'deliveredOrders' => $deliveredOrders,
                'refundedOrders' => $refundedOrders,
                'failedOrders' => $failedOrders,
                'shippedOrders' => $shippedOrders,
                'totalProducts' => $totalProducts,
                'totalAdmins' => $totalAdmins,
            ];
        });

        return response()->json($payload);
    }

    public function recentOrders(Request $request)
    {
        $limit = (int) $request->query('limit', 10);
        $cacheKey = self::RECENT_CACHE_PREFIX . max(1, $limit);

        $orders = Cache::remember($cacheKey, self::STATS_CACHE_TTL_SECONDS, function () use ($limit) {
            return Order::withCount('items')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(function ($o) {
                    return [
                        'id' => $o->id,
                        'orderNumber' => $o->order_number,
                        'customerName' => $o->customer_name,
                        'status' => $o->status,
                        'totalGross' => (float) $o->total_gross,
                        'totalNet' => (float) $o->total_net,
                        'vatAmount' => (float) $o->vat_amount,
                        'itemsCount' => $o->items_count,
                        'createdAt' => $o->created_at ? $o->created_at->toIso8601String() : null,
                        'total' => (float) $o->total_gross,
                    ];
                })
                ->values()
                ->all();
        });

        return response()->json($orders);
    }
}
