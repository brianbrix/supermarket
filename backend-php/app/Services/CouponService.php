<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CouponService
{
    public function validateForCart(string $code, float $cartTotal, ?User $user = null, ?string $customerPhone = null): array
    {
        $coupon = Coupon::query()->whereRaw('UPPER(code) = ?', [mb_strtoupper(trim($code))])->first();
        if (!$coupon) {
            throw ValidationException::withMessages(['code' => 'Coupon not found.']);
        }
        $this->assertCouponIsRedeemable($coupon, $cartTotal, $user, $customerPhone);
        $discount = $this->calculateDiscount($coupon, $cartTotal);
        return [$coupon, $discount];
    }

    public function assertCouponIsRedeemable(Coupon $coupon, float $cartTotal, ?User $user = null, ?string $customerPhone = null): void
    {
        $now = Carbon::now();
        if (!$coupon->is_active) {
            throw ValidationException::withMessages(['code' => 'Coupon is inactive.']);
        }
        if ($coupon->starts_at && $now->lt($coupon->starts_at)) {
            throw ValidationException::withMessages(['code' => 'Coupon is not yet active.']);
        }
        if ($coupon->ends_at && $now->gt($coupon->ends_at)) {
            throw ValidationException::withMessages(['code' => 'Coupon has expired.']);
        }
        if ($coupon->min_order_amount && $cartTotal < $coupon->min_order_amount) {
            throw ValidationException::withMessages(['code' => 'Order total does not meet the minimum amount for this coupon.']);
        }
        if ($coupon->usage_limit !== null && $coupon->times_redeemed >= $coupon->usage_limit) {
            throw ValidationException::withMessages(['code' => 'Coupon usage limit has been reached.']);
        }

        if ($coupon->usage_limit_per_user !== null) {
            $userRedemptions = CouponRedemption::query()
                ->where('coupon_id', $coupon->id)
                ->when($user?->id, fn($query) => $query->where('user_id', $user->id))
                ->when(!$user && $customerPhone, fn($query) => $query->where('customer_phone', $customerPhone))
                ->count();
            if ($userRedemptions >= $coupon->usage_limit_per_user) {
                throw ValidationException::withMessages(['code' => 'You have already used this coupon the maximum number of times.']);
            }
        }
    }

    public function calculateDiscount(Coupon $coupon, float $cartTotal): float
    {
        if ($cartTotal <= 0) {
            return 0.0;
        }
        if ($coupon->discount_type === 'PERCENT') {
            $discount = $cartTotal * ($coupon->discount_value / 100);
            if ($coupon->max_discount_amount !== null) {
                $discount = min($discount, $coupon->max_discount_amount);
            }
            return round(min($discount, $cartTotal), 2);
        }
        $discount = round($coupon->discount_value, 2);
        return min($discount, round($cartTotal, 2));
    }

    public function recordRedemption(Coupon $coupon, float $discountAmount, ?Order $order = null, ?User $user = null, ?string $customerPhone = null): void
    {
        DB::transaction(function () use ($coupon, $discountAmount, $order, $user, $customerPhone) {
            $managedCoupon = Coupon::query()->lockForUpdate()->findOrFail($coupon->id);
            $now = Carbon::now();
            CouponRedemption::create([
                'coupon_id' => $managedCoupon->id,
                'order_id' => $order?->id,
                'user_id' => $user?->id,
                'customer_phone' => $customerPhone,
                'discount_amount' => $discountAmount,
                'redeemed_at' => $now,
            ]);

            $managedCoupon->forceFill([
                'times_redeemed' => ($managedCoupon->times_redeemed ?? 0) + 1,
                'last_redeemed_at' => $now,
            ])->save();

            $coupon->setRawAttributes($managedCoupon->getAttributes(), true);
        });
    }
}
