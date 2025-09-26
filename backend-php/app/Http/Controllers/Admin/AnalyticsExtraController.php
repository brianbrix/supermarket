<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AnalyticsExtraController extends Controller
{
    public function aov(Request $request)
    {
        $granularity = strtoupper($request->query('granularity','DAILY'));
        $periods = min(180,(int)$request->query('periods',30));
        $now = Carbon::now();
        $series=[];
        for($i=$periods-1;$i>=0;$i--) {
            switch ($granularity) {
                case 'MONTHLY':
                    $start=$now->copy()->startOfMonth()->subMonths($i); $end=$start->copy()->endOfMonth(); $label=$start->format('Y-m'); break;
                case 'WEEKLY':
                    $start=$now->copy()->startOfWeek(Carbon::MONDAY)->subWeeks($i); $end=$start->copy()->endOfWeek(Carbon::SUNDAY); $label=$start->toDateString(); break;
                case 'DAILY': default:
                    $start=$now->copy()->startOfDay()->subDays($i); $end=$start->copy()->endOfDay(); $label=$start->toDateString();
            }
            $row=Order::whereBetween('created_at',[$start,$end])
                ->selectRaw('COUNT(*) as orders, COALESCE(SUM(total_gross),0) as gross')->first();
            $orders=(int)$row->orders; $gross=(float)$row->gross; $aov=$orders>0?round($gross/$orders,2):0.0;
            $series[]=['period'=>$label,'orders'=>$orders,'gross'=>round($gross,2),'aov'=>$aov];
        }
        return ['granularity'=>$granularity,'series'=>$series];
    }

    public function unified(Request $request)
    {
        $from = $request->query('from'); $to=$request->query('to');
        $granularity=strtoupper($request->query('granularity','DAILY'));
        $fromDate=$from?Carbon::parse($from):Carbon::now()->subDays(29)->startOfDay();
        $toDate=$to?Carbon::parse($to):Carbon::now();
        if ($toDate->lt($fromDate)) { [$fromDate,$toDate]=[$toDate,$fromDate]; }
        $statusesRaw = $request->query('statuses', []);
        if (!is_array($statusesRaw)) {
            $statusesRaw = $statusesRaw ? explode(',', $statusesRaw) : [];
        }
        $includeRefunded = filter_var($request->query('includeRefunded'), FILTER_VALIDATE_BOOLEAN);
        $includeCancelled = filter_var($request->query('includeCancelled'), FILTER_VALIDATE_BOOLEAN);

        $allowedStatuses = ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED','FAILED','COMPLETED'];
        $aliasMap = [
            'DELIVERED' => ['DELIVERED','COMPLETED'],
            'COMPLETED' => ['COMPLETED','DELIVERED'],
        ];

        $normalizedStatuses = collect($statusesRaw)
            ->map(fn($s) => strtoupper(trim((string)$s)))
            ->filter()
            ->values();

        if ($includeCancelled) {
            $normalizedStatuses = $normalizedStatuses->merge(['CANCELLED','FAILED']);
        }
        if ($includeRefunded) {
            $normalizedStatuses = $normalizedStatuses->merge(['REFUNDED']);
        }

        $statusFilter = $normalizedStatuses
            ->flatMap(function($status) use ($aliasMap) {
                return $aliasMap[$status] ?? [$status];
            })
            ->filter(fn($status) => in_array($status, $allowedStatuses, true))
            ->unique()
            ->values()
            ->all();

        $ordersQuery = Order::whereBetween('created_at', [$fromDate, $toDate]);
        if (!empty($statusFilter)) {
            $ordersQuery->whereIn('status', $statusFilter);
        }
        $orders = $ordersQuery->orderBy('created_at')->get(['id','total_gross','created_at','status']);

        $payments=Payment::whereBetween('created_at',[$fromDate,$toDate])->get(['id','amount','status','created_at']);
        $grossRevenue=(float)$orders->sum('total_gross');
        $orderCount=$orders->count();
        $avgOrderValue=$orderCount>0?round($grossRevenue/$orderCount,2):0.0;
        $completed=$payments->whereIn('status',['SUCCESS','COMPLETED','PAID']);
        $paymentSuccessRate=$payments->count()>0?round(($completed->count()/$payments->count())*100,2):null;

        $trend=[]; $buckets=[]; $cursor=$fromDate->copy();
        while($cursor <= $toDate){
            switch ($granularity){
                case 'MONTHLY':
                    $bucketStart=$cursor->copy()->startOfMonth();
                    $bucketEnd=$cursor->copy()->endOfMonth();
                    $label=$bucketStart->format('Y-m');
                    $cursor=$cursor->copy()->addMonth();
                    break;
                case 'WEEKLY':
                    $bucketStart=$cursor->copy()->startOfWeek(Carbon::MONDAY);
                    $bucketEnd=$cursor->copy()->endOfWeek(Carbon::SUNDAY);
                    $label=$bucketStart->toDateString();
                    $cursor=$cursor->copy()->addWeek();
                    break;
                case 'DAILY':
                default:
                    $bucketStart=$cursor->copy()->startOfDay();
                    $bucketEnd=$cursor->copy()->endOfDay();
                    $label=$bucketStart->toDateString();
                    $cursor=$cursor->copy()->addDay();
            }
            if ($bucketEnd>$toDate) $bucketEnd=$toDate;
            $bucketOrders=$orders->filter(fn($o)=>$o->created_at>=$bucketStart && $o->created_at<=$bucketEnd);
            if ($bucketOrders->isEmpty()) {
                continue;
            }
            $bucketGross=(float)$bucketOrders->sum('total_gross');
            $bucketCount=$bucketOrders->count();
            $bucketAov=$bucketCount>0?round($bucketGross/$bucketCount,2):0.0;
            $trend[]=[ 'period'=>$label,'orders'=>$bucketCount,'gross'=>round($bucketGross,2),'aov'=>$bucketAov ];
            $buckets[]=[
                'start'=>$bucketStart->toIso8601String(),
                'end'=>$bucketEnd->toIso8601String(),
                'orderCount'=>$bucketCount,
                'gross'=>round($bucketGross,2),
                'aov'=>$bucketAov,
            ];
        }

        $aggregates = [
            'totalOrders' => $orderCount,
            'totalGross' => round($grossRevenue, 2),
            'overallAov' => $avgOrderValue,
            'paymentSuccessRate' => $paymentSuccessRate,
        ];

        $filters = [
            'from' => $fromDate->toIso8601String(),
            'to' => $toDate->toIso8601String(),
            'granularity' => $granularity,
            'statuses' => $statusFilter,
            'includeCancelled' => $includeCancelled,
            'includeRefunded' => $includeRefunded,
        ];

        return [
            'aggregates' => $aggregates,
            'buckets' => $buckets,
            'filters' => $filters,
            'totals' => [
                'grossRevenue'=>round($grossRevenue,2),
                'orders'=>$orderCount,
                'avgOrderValue'=>$avgOrderValue,
                'paymentSuccessRate'=>$paymentSuccessRate,
                'from'=>$fromDate->toIso8601String(),
                'to'=>$toDate->toIso8601String(),
            ],
            'trend'=>$trend,
        ];
    }

    public function advanced(Request $request)
    {
        $days = min(365, (int)$request->query('days', 60));
        $now = Carbon::now();
        $from = $now->copy()->subDays($days - 1)->startOfDay();
        $prevFrom = $from->copy()->subDays($days); // previous window start
        $prevTo = $from->copy()->subDay()->endOfDay();

        // Collect orders for current and previous windows
        $currentOrders = Order::whereBetween('created_at', [$from, $now])
            ->get(['id','customer_phone','user_id','status','total_gross','created_at']);
        $previousOrders = Order::whereBetween('created_at', [$prevFrom, $prevTo])
            ->get(['id','customer_phone','user_id','status','total_gross','created_at']);

        // Build customer identifier (user priority else phone)
        $ident = fn($o) => $o->user_id ? 'U:'.$o->user_id : 'P:'.$o->customer_phone;

        // Customer metrics (current window)
        $groupedCurrent = $currentOrders->groupBy($ident)->map->count();
        $totalCustomers = $groupedCurrent->count();
        $repeatCustomers = $groupedCurrent->filter(fn($c)=>$c>1)->count();
        $totalOrders = $currentOrders->count();
        $ordersFromRepeat = $groupedCurrent->filter(fn($c)=>$c>1)->sum();
        $repeatRatePct = $totalCustomers>0 ? ($repeatCustomers/$totalCustomers)*100 : 0;
        $ordersFromRepeatPct = $totalOrders>0 ? ($ordersFromRepeat/$totalOrders)*100 : 0;

        // Retention (how many previous customers returned in current window)
        $groupedPrev = $previousOrders->groupBy($ident)->map->count();
        $previousWindowCustomers = $groupedPrev->count();
        $retainedCustomers = 0;
        if ($previousWindowCustomers > 0) {
            $retainedCustomers = $groupedPrev->keys()->filter(fn($k)=> $groupedCurrent->has($k))->count();
        }
        $churnedCustomers = max(0, $previousWindowCustomers - $retainedCustomers);
        $retentionRatePct = $previousWindowCustomers>0 ? ($retainedCustomers/$previousWindowCustomers)*100 : 0;
        $churnRatePct = $previousWindowCustomers>0 ? ($churnedCustomers/$previousWindowCustomers)*100 : 0;

        // Funnel counts (current window)
    $statusCounts = ['PENDING'=>0,'PROCESSING'=>0,'SHIPPED'=>0,'DELIVERED'=>0,'CANCELLED'=>0,'REFUNDED'=>0,'FAILED'=>0];
        foreach ($currentOrders as $o) {
            $st = strtoupper($o->status ?? '');
            if (isset($statusCounts[$st])) { $statusCounts[$st]++; }
        }
        $pending = $statusCounts['PENDING'];
        $processing = $statusCounts['PROCESSING'];
        $shipped = $statusCounts['SHIPPED'];
        $delivered = $statusCounts['DELIVERED'];
    $cancelled = $statusCounts['CANCELLED'];
    $failed = $statusCounts['FAILED'];
        $refunded = $statusCounts['REFUNDED'];

        $pct = function($num,$den){ return $den>0 ? round(($num/$den)*100,2) : 0.0; };
        $convPendingToProcessing = $pct($processing, $pending);
        $convProcessingToShipped = $pct($shipped, $processing);
        $convShippedToDelivered = $pct($delivered, $shipped);
        $overallConversionToDelivered = $pct($delivered, $pending); // simple baseline
    $cancellationRatePct = $pct($cancelled + $failed, max(1,$pending));
        $refundRatePct = $pct($refunded, max(1,$pending));

        return response()->json([
            'from' => $from->toIso8601String(),
            'to' => $now->toIso8601String(),
            'days' => $days,
            'customers' => [
                'totalCustomers' => $totalCustomers,
                'repeatCustomers' => $repeatCustomers,
                'repeatRatePct' => round($repeatRatePct,2),
                'totalOrders' => $totalOrders,
                'ordersFromRepeat' => $ordersFromRepeat,
                'ordersFromRepeatPct' => round($ordersFromRepeatPct,2),
            ],
            'retention' => [
                'previousWindowCustomers' => $previousWindowCustomers,
                'retainedCustomers' => $retainedCustomers,
                'retentionRatePct' => round($retentionRatePct,2),
                'churnedCustomers' => $churnedCustomers,
                'churnRatePct' => round($churnRatePct,2),
            ],
            'funnel' => [
                'pending' => $pending,
                'processing' => $processing,
                'shipped' => $shipped,
                'delivered' => $delivered,
                'cancelled' => $cancelled,
                'failed' => $failed,
                'refunded' => $refunded,
                'convPendingToProcessing' => $convPendingToProcessing,
                'convProcessingToShipped' => $convProcessingToShipped,
                'convShippedToDelivered' => $convShippedToDelivered,
                'overallConversionToDelivered' => $overallConversionToDelivered,
                'cancellationRatePct' => $cancellationRatePct,
                'refundRatePct' => $refundRatePct,
            ],
        ]);
    }
}
