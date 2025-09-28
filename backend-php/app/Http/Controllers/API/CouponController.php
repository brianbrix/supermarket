<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\CouponService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CouponController extends Controller
{
    public function preview(Request $request, CouponService $couponService)
    {
        $data = $request->validate([
            'code' => 'required|string|max:64',
            'cartTotal' => 'nullable|numeric|min:0',
            'customerPhone' => 'nullable|string|max:32',
        ]);
        $cartTotal = $data['cartTotal'] ?? 0;
        [$coupon, $discount] = $couponService->validateForCart(
            $data['code'],
            (float)$cartTotal,
            $request->user('sanctum') ?? Auth::user(),
            $data['customerPhone'] ?? null
        );

        return response()->json([
            'coupon' => [
                'id' => $coupon->id,
                'code' => $coupon->code,
                'name' => $coupon->name,
                'description' => $coupon->description,
                'discountType' => $coupon->discount_type,
                'discountValue' => (float)$coupon->discount_value,
                'maxDiscountAmount' => $coupon->max_discount_amount !== null ? (float)$coupon->max_discount_amount : null,
                'minOrderAmount' => (float)$coupon->min_order_amount,
                'startsAt' => optional($coupon->starts_at)->toIso8601String(),
                'endsAt' => optional($coupon->ends_at)->toIso8601String(),
                'usageLimit' => $coupon->usage_limit,
                'usageLimitPerUser' => $coupon->usage_limit_per_user,
                'timesRedeemed' => $coupon->times_redeemed,
                'isActive' => $coupon->isCurrentlyActive(),
            ],
            'discountAmount' => $discount,
            'totalAfterDiscount' => max(0, round($cartTotal - $discount, 2)),
        ]);
    }
}
