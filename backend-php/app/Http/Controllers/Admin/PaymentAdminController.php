<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;
use App\Http\Resources\PaymentResource;
use App\Services\PaymentService;
use App\Enums\PaymentStatus;
use Illuminate\Validation\Rule;

class PaymentAdminController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    public function index(Request $request)
    {
        $sort = $request->get('sort', 'created_at');
        $direction = strtolower($request->get('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowed = ['created_at','amount','status','id'];
        if (!in_array($sort, $allowed, true)) { $sort = 'created_at'; }

        $query = Payment::query();
        if ($status = $request->get('status')) { $query->where('status', $status); }
        if ($method = $request->get('method')) { $query->where('method', $method); }
        if ($channel = $request->get('channel')) { $query->where('channel', $channel); }
        if ($provider = $request->get('provider')) { $query->where('provider', $provider); }
        if ($from = $request->get('from')) { $query->where('created_at', '>=', $from); }
        if ($to = $request->get('to')) { $query->where('created_at', '<=', $to); }
        if ($q = $request->get('q')) {
            $query->where(function($w) use ($q) {
                $w->where('provider_ref','ilike',"%$q%")
                  ->orWhere('external_request_id','ilike',"%$q%")
                  ->orWhere('external_transaction_id','ilike',"%$q%")
                  ->orWhere('phone_number','ilike',"%$q%")
                  ->orWhere('id',$q);
            });
        }

        $pageSize = min(100, (int)$request->get('size', 20));
        $paginator = $query->orderBy($sort, $direction)->paginate($pageSize);
        $data = PaymentResource::collection($paginator->items());
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

    public function updateStatus(Request $request, Payment $payment)
    {
        $data = $request->validate([
            'status' => ['required','string', Rule::in([
                PaymentStatus::INITIATED->value,
                PaymentStatus::PENDING->value,
                PaymentStatus::SUCCESS->value,
                PaymentStatus::FAILED->value,
                PaymentStatus::REFUNDED->value,
            ])]
        ]);
        $updated = $this->payments->updateCashOnDeliveryStatus($payment, $data['status'], optional($request->user())->id);
        return new PaymentResource($updated);
    }
}
