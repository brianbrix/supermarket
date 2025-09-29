<?php

namespace App\Models;

use App\Models\Delivery;
use App\Models\DeliveryShop;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class Order extends Model
{
    use HasApiTokens, HasFactory;

    public const STATUSES = [
        'PENDING',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
        'FAILED',
        'COMPLETED',
    ];

    public const DELIVERY_TYPES = [
        'PICKUP',
        'DELIVERY',
    ];

    public const DELIVERY_STATUSES = [
        'REQUESTED',
        'ASSIGNED',
        'EN_ROUTE',
        'DELIVERED',
        'CANCELLED',
    ];

    protected $fillable = [
        'customer_name',
        'customer_phone',
        'status',
        'total_gross',
        'discount_amount',
        'total_net',
        'vat_amount',
        'user_id',
        'coupon_id',
        'coupon_code',
        'thumbnail_url',
        'order_number',
        'delivery_type',
        'delivery_status',
        'delivery_shop_id',
        'delivery_requested_at',
        'delivery_dispatched_at',
        'delivery_completed_at',
        'delivery_address_line1',
        'delivery_address_line2',
        'delivery_city',
        'delivery_region',
        'delivery_postal_code',
        'delivery_lat',
        'delivery_lng',
        'delivery_distance_km',
        'delivery_cost',
        'delivery_contact_phone',
        'delivery_contact_email',
        'delivery_notes'
    ];

    protected $appends = ['payment_status','payment_method'];

    protected $casts = [
        'created_at' => 'datetime',
    'updated_at' => 'datetime',
    'delivery_requested_at' => 'datetime',
    'delivery_dispatched_at' => 'datetime',
    'delivery_completed_at' => 'datetime',
    'delivery_lat' => 'float',
    'delivery_lng' => 'float',
    'delivery_distance_km' => 'float',
    'delivery_cost' => 'float'
    ];

    protected static function booted(): void
    {
        static::creating(function (self $order) {
            if (empty($order->order_number)) {
                $order->order_number = static::generateOrderNumber();
            }
        });
    }

    public function items() {
        return $this->hasMany(OrderItem::class);
    }

    public function user() {
        return $this->belongsTo(User::class);
    }

    public function payments() {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment() {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    public function coupon()
    {
        return $this->belongsTo(Coupon::class);
    }

    public function deliveryShop()
    {
        return $this->belongsTo(DeliveryShop::class, 'delivery_shop_id');
    }

    public function delivery()
    {
        return $this->hasOne(Delivery::class);
    }

    public function isDelivery(): bool
    {
        return strtoupper($this->delivery_type ?? 'PICKUP') === 'DELIVERY';
    }

    protected function paymentStatus(): Attribute
    {
        return Attribute::get(fn () => $this->latestPayment?->status);
    }

    protected function paymentMethod(): Attribute
    {
        return Attribute::get(fn () => $this->latestPayment?->method);
    }

    public static function generateOrderNumber(): string
    {
        $prefix = now()->format('Ymd');
        do {
            $candidate = 'ORD-' . $prefix . '-' . strtoupper(Str::random(6));
        } while (static::where('order_number', $candidate)->exists());

        return $candidate;
    }
}
