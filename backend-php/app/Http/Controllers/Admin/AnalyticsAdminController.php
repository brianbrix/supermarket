<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsAdminController extends Controller
{
    public function overview(Request $request)
    {
        $lowStockThreshold = (int)$request->query('lowStockThreshold', 5);
        $revenueDays = (int)$request->query('revenueDays', 30);
        $now = Carbon::now();
        $from = $now->copy()->subDays($revenueDays - 1)->startOfDay();
        $fromPrev = $now->copy()->subDays(($revenueDays * 2) - 1)->startOfDay();

        // Fetch orders for both current and previous windows
        $ordersAll = Order::where('created_at', '>=', $fromPrev)->get(['id','total_gross','created_at']);
        $ordersCurrent = $ordersAll->filter(fn($o)=> $o->created_at >= $from);
        $ordersPrev = $ordersAll->filter(fn($o)=> $o->created_at < $from);

        // Daily revenue trend (current window)
        $daily = [];
        for ($d=0; $d < $revenueDays; $d++) {
            $day = $from->copy()->addDays($d)->toDateString();
            $sum = $ordersCurrent->filter(fn($o)=> $o->created_at->toDateString()===$day)->sum('total_gross');
            $daily[] = ['day'=>$day,'revenue'=>round((float)$sum,2)];
        }

        // Weekly trend (group daily into ISO weeks)
        $weeklyMap = [];
        foreach ($ordersCurrent as $o) {
            $weekStart = $o->created_at->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
            $weeklyMap[$weekStart] = ($weeklyMap[$weekStart] ?? 0) + (float)$o->total_gross;
        }
        ksort($weeklyMap);
        $weekly = collect($weeklyMap)->map(fn($v,$k)=> ['weekStart'=>$k,'revenue'=>round($v,2)])->values();

        // Monthly trend (group by year-month)
        $monthlyMap = [];
        foreach ($ordersCurrent as $o) {
            $key = $o->created_at->format('Y-m');
            $monthlyMap[$key] = ($monthlyMap[$key] ?? 0) + (float)$o->total_gross;
        }
        ksort($monthlyMap);
        $monthly = [];
        foreach ($monthlyMap as $key=>$value) {
            [$year,$month] = explode('-', $key);
            $monthly[] = ['year'=>(int)$year,'month'=>(int)$month,'revenue'=>round($value,2)];
        }

    $totalCurrent = (float)$ordersCurrent->sum('total_gross');
    $totalPrev = (float)$ordersPrev->sum('total_gross');
    $dailyChangePct = $totalPrev > 0 ? (($totalCurrent - $totalPrev)/$totalPrev)*100 : null;

    // Weekly change: compare current week (Mon..Sun) revenue vs previous week
    $weekStart = $now->copy()->startOfWeek(Carbon::MONDAY);
    $prevWeekStart = $weekStart->copy()->subWeek();
    $prevWeekEnd = $weekStart->copy()->subDay();
    $currentWeekRevenue = Order::whereBetween('created_at', [$weekStart, $now])->sum('total_gross');
    $prevWeekRevenue = Order::whereBetween('created_at', [$prevWeekStart, $prevWeekEnd])->sum('total_gross');
    $weeklyChangePct = $prevWeekRevenue > 0 ? (($currentWeekRevenue - $prevWeekRevenue)/$prevWeekRevenue)*100 : null;

    // Monthly change: month-to-date vs previous month same day span
    $monthStart = $now->copy()->startOfMonth();
    $daysElapsed = $now->diffInDays($monthStart) + 1; // inclusive days
    $prevMonthStart = $monthStart->copy()->subMonth();
    $prevMonthSpanEnd = $prevMonthStart->copy()->addDays($daysElapsed - 1)->endOfDay();
    $currentMonthToDate = Order::whereBetween('created_at', [$monthStart, $now])->sum('total_gross');
    $prevMonthSameSpan = Order::whereBetween('created_at', [$prevMonthStart, $prevMonthSpanEnd])->sum('total_gross');
    $monthlyChangePct = $prevMonthSameSpan > 0 ? (($currentMonthToDate - $prevMonthSameSpan)/$prevMonthSameSpan)*100 : null;

        // Top selling products (by quantity) in current window
        $topSelling = OrderItem::select('product_id', DB::raw('SUM(quantity) as quantity'))
            ->whereHas('order', fn($q)=> $q->where('created_at','>=',$from))
            ->groupBy('product_id')
            ->orderByDesc('quantity')
            ->with('product:id,name')
            ->limit(25)
            ->get()
            ->map(fn($row)=> [
                'id' => $row->product_id,
                'name' => optional($row->product)->name,
                'quantity' => (int)$row->quantity,
            ]);

        // Low stock products
        $lowStock = Product::where('stock','<=',$lowStockThreshold)
            ->orderBy('stock')
            ->limit(50)
            ->get(['id','name','stock']);

        $overallAov = $ordersCurrent->count() > 0 ? $totalCurrent / $ordersCurrent->count() : 0;

        // Per-channel AOV (using payments table for completed/paid statuses) fallback to orders if no payments
        $channelAov = [];
        $payments = \App\Models\Payment::whereHas('order', fn($q)=> $q->where('created_at','>=',$from))
            ->whereIn('status', ['COMPLETED','PAID','SUCCESS'])
            ->get(['channel','amount']);
        if ($payments->count() > 0) {
            $byChannel = $payments->groupBy(fn($p)=> $p->channel ?: 'UNKNOWN');
            foreach ($byChannel as $ch=>$list) {
                $sum = $list->sum('amount');
                $count = max($list->count(),1);
                $channelAov[$ch] = round($sum / $count,2);
            }
        }

        // Basket segmentation (based on total_gross in current window orders)
        $segments = [
            'small' => ['min'=>0,'max'=>999],
            'medium' => ['min'=>1000,'max'=>4999],
            'large' => ['min'=>5000,'max'=>9999],
            'xl' => ['min'=>10000,'max'=>PHP_FLOAT_MAX],
        ];
        $basketSegments = [];
        foreach ($segments as $label=>$range) {
            $count = $ordersCurrent->filter(fn($o)=> $o->total_gross >= $range['min'] && $o->total_gross <= $range['max'])->count();
            $basketSegments[$label] = $count;
        }

        // Repeat customer metrics (based on user_id if present, else phone fallback)
        $identifierCounts = Order::selectRaw("COALESCE(CASE WHEN user_id IS NOT NULL THEN CONCAT('U:',user_id) ELSE CONCAT('P:',customer_phone) END, CONCAT('P:',customer_phone)) as ident, COUNT(*) as c")
            ->where('created_at','>=',$fromPrev) // look over full 2*window to build base
            ->groupBy('ident')
            ->get();
        $repeatCustomers = $identifierCounts->where('c','>',1)->count();
        $uniqueCustomers = $identifierCounts->count();
        $repeatRate = $uniqueCustomers > 0 ? ($repeatCustomers / $uniqueCustomers) * 100 : null;

        return response()->json([
            'revenueTrendDaily' => $daily,
            'revenueTrendWeekly' => $weekly,
            'revenueTrendMonthly' => $monthly,
            'dailyChangePct' => $dailyChangePct !== null ? round($dailyChangePct,2) : null,
            'weeklyChangePct' => $weeklyChangePct !== null ? round($weeklyChangePct,2) : null,
            'monthlyChangePct' => $monthlyChangePct !== null ? round($monthlyChangePct,2) : null,
            'topSelling' => $topSelling,
            'lowStock' => $lowStock,
            'overallAov' => round($overallAov,2),
            'windowDays' => $revenueDays,
            'repeatCustomers' => $repeatCustomers,
            'uniqueCustomers' => $uniqueCustomers,
            'repeatRate' => $repeatRate !== null ? round($repeatRate,2) : null,
            'aovByChannel' => (object)$channelAov,
            'basketSegments' => $basketSegments,
        ]);
    }
}
