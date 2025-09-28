<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;

class DashboardAdminController extends Controller
{
    public function stats()
    {
        $totalOrders = Order::count();
        $totalRevenue = (float) Order::sum('total_gross');
        $pendingOrders = Order::where('status','PENDING')->count();
        $processingOrders = Order::where('status','PROCESSING')->count();
        $completedOrders = Order::where('status','COMPLETED')->count();
        $cancelledOrders = Order::where('status','CANCELLED')->count();
        $deliveredOrders = Order::where('status','DELIVERED')->count();
        $refundedOrders = Order::where('status','REFUNDED')->count();
        $failedOrders = Order::where('status','FAILED')->count();

        // Frontend originally had SHIPPED; return zero for compatibility
        $shippedOrders = Order::where('status','SHIPPED')->count(); // will be 0 unless status added later

        $totalProducts = Product::count();
        $totalAdmins = User::where('role','ADMIN')->count();
        $averageOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        return response()->json([
            'totalOrders' => $totalOrders,
            'totalRevenue' => round($totalRevenue,2),
            'averageOrderValue' => round($averageOrderValue,2),
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
        ]);
    }

    public function recentOrders(Request $request)
    {
        $limit = (int) $request->query('limit', 10);
        $orders = Order::withCount('items')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function($o){
                return [
                    'id' => $o->id,
                    'orderNumber' => $o->order_number,
                    'customerName' => $o->customer_name,
                    'status' => $o->status,
                    'totalGross' => (float)$o->total_gross,
                    'totalNet' => (float)$o->total_net,
                    'vatAmount' => (float)$o->vat_amount,
                    'itemsCount' => $o->items_count,
                    'createdAt' => $o->created_at? $o->created_at->toIso8601String(): null,
                    // legacy compatibility fields
                    'total' => (float)$o->total_gross,
                ];
            });
        return response()->json($orders);
    }
}
