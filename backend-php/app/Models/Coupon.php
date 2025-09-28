<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'description',
        'discount_type',
        'discount_value',
        'max_discount_amount',
        'min_order_amount',
        'usage_limit',
        'usage_limit_per_user',
        'times_redeemed',
        'is_active',
        'starts_at',
        'ends_at',
        'last_redeemed_at'
    ];

    protected $casts = [
        'discount_value' => 'float',
        'max_discount_amount' => 'float',
        'min_order_amount' => 'float',
        'usage_limit' => 'integer',
        'usage_limit_per_user' => 'integer',
        'times_redeemed' => 'integer',
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'last_redeemed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $coupon) {
            if ($coupon->code) {
                $coupon->code = Str::upper(trim($coupon->code));
            }
        });
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    public function orders(): BelongsToMany
    {
        return $this->belongsToMany(Order::class, 'coupon_redemptions');
    }

    public function isCurrentlyActive(): bool
    {
        $now = Carbon::now();
        if (!$this->is_active) {
            return false;
        }
        if ($this->starts_at && $now->lt($this->starts_at)) {
            return false;
        }
        if ($this->ends_at && $now->gt($this->ends_at)) {
            return false;
        }
        if ($this->usage_limit !== null && $this->times_redeemed >= $this->usage_limit) {
            return false;
        }
        return true;
    }
}
