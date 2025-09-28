<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CouponAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = Coupon::query();
        if ($search = $request->query('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%$search%")
                    ->orWhere('name', 'like', "%$search%")
                    ->orWhere('description', 'like', "%$search%")
                    ->orWhere('code', 'like', "%" . mb_strtoupper($search) . "%");
            });
        }

        if (null !== ($active = $request->query('active'))) {
            if ($active === 'true' || $active === '1' || $active === 1 || $active === true) {
                $query->where('is_active', true);
            } elseif ($active === 'false' || $active === '0' || $active === 0 || $active === false) {
                $query->where('is_active', false);
            }
        }

        if ($startsFrom = $request->query('startsFrom')) {
            $query->where(function ($q) use ($startsFrom) {
                $q->whereNull('starts_at')->orWhere('starts_at', '>=', $startsFrom);
            });
        }
        if ($endsTo = $request->query('endsTo')) {
            $query->where(function ($q) use ($endsTo) {
                $q->whereNull('ends_at')->orWhere('ends_at', '<=', $endsTo);
            });
        }

        $sort = $request->query('sort', 'created_at');
        $direction = strtolower($request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSort = ['id', 'code', 'name', 'discount_value', 'created_at', 'starts_at', 'ends_at', 'times_redeemed'];
        if (!in_array($sort, $allowedSort, true)) {
            $sort = 'created_at';
        }
        $query->orderBy($sort, $direction);

        $size = (int) $request->query('size', 20);
        $page = (int) $request->query('page', 0);
        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);

        $items = array_map(function (Coupon $coupon) {
            return $this->transformCoupon($coupon);
        }, $paginator->items());

        return response()->json([
            'content' => $items,
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $coupon = Coupon::create($data);
        return response()->json($this->transformCoupon($coupon), 201);
    }

    public function update(Request $request, Coupon $coupon)
    {
        $data = $this->validatePayload($request, $coupon->id);
        $coupon->update($data);
        return response()->json($this->transformCoupon($coupon->fresh()));
    }

    public function destroy(Coupon $coupon)
    {
        $coupon->delete();
        return response()->json(['deleted' => true]);
    }

    public function activate(Coupon $coupon)
    {
        $coupon->update(['is_active' => true]);
        return response()->json($this->transformCoupon($coupon->fresh()));
    }

    public function deactivate(Coupon $coupon)
    {
        $coupon->update(['is_active' => false]);
        return response()->json($this->transformCoupon($coupon->fresh()));
    }

    protected function validatePayload(Request $request, ?int $couponId = null): array
    {
        $rules = [
            'code' => ['required', 'string', 'max:64', Rule::unique('coupons', 'code')->ignore($couponId)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'discount_type' => ['required', Rule::in(['PERCENT', 'FIXED'])],
            'discount_value' => ['required', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:0'],
            'usage_limit_per_user' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ];
        $data = $request->validate($rules);
        $data['min_order_amount'] = $data['min_order_amount'] ?? 0;
        if ($data['discount_type'] === 'PERCENT' && $data['discount_value'] > 100) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'discount_value' => 'Percentage discount cannot exceed 100%.',
            ]);
        }
        return $data;
    }

    protected function transformCoupon(Coupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'name' => $coupon->name,
            'description' => $coupon->description,
            'discountType' => $coupon->discount_type,
            'discountValue' => (float) $coupon->discount_value,
            'maxDiscountAmount' => $coupon->max_discount_amount !== null ? (float) $coupon->max_discount_amount : null,
            'minOrderAmount' => (float) $coupon->min_order_amount,
            'usageLimit' => $coupon->usage_limit,
            'usageLimitPerUser' => $coupon->usage_limit_per_user,
            'timesRedeemed' => $coupon->times_redeemed,
            'isActive' => (bool) $coupon->is_active,
            'startsAt' => optional($coupon->starts_at)->toIso8601String(),
            'endsAt' => optional($coupon->ends_at)->toIso8601String(),
            'createdAt' => optional($coupon->created_at)->toIso8601String(),
            'updatedAt' => optional($coupon->updated_at)->toIso8601String(),
        ];
    }
}
