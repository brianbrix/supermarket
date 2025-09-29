<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Http\Resources\OrderResource;
use App\Http\Requests\UpdateOrderStatusRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class OrderAdminController extends Controller
{
    public function index(Request $request)
    {
        $sort = $request->get('sort', 'created_at');
        $direction = strtolower($request->get('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowed = ['created_at','total_gross','status','id'];
        if (!in_array($sort, $allowed, true)) { $sort = 'created_at'; }

    $query = Order::query()->with(['items.product', 'deliveryShop', 'delivery']);

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($from = $request->get('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->where('created_at', '<=', $to);
        }
        if ($minTotal = $request->get('minTotal')) {
            $query->where('total_gross', '>=', $minTotal);
        }
        if ($maxTotal = $request->get('maxTotal')) {
            $query->where('total_gross', '<=', $maxTotal);
        }
        if ($q = $request->get('q')) {
            $query->where(function($w) use ($q) {
                $w->where('customer_name','ilike',"%$q%")
                  ->orWhere('customer_phone','ilike',"%$q%")
                  ->orWhere('id',$q);
            });
        }

    $pageSize = min(100, (int)$request->get('size', 20));
    $paginator = $query->orderBy($sort, $direction)->paginate($pageSize);
    return $this->pageResponse($paginator, OrderResource::collection($paginator->items()));
    }

    public function updateStatus(UpdateOrderStatusRequest $request, Order $order)
    {
        $status = $request->validated()['status'];
        $order->status = $status;
        $order->save();
        return new OrderResource($order->fresh('items.product'));
    }

    private function pageResponse($paginator, $data)
    {
        return response()->json([
            'content' => $data,
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
            'sort' => null
        ]);
    }
}
