<?php

namespace App\Models;

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

    protected $fillable = [
        'customer_name','customer_phone','status','total_gross','total_net','vat_amount','user_id','thumbnail_url','order_number'
    ];

    protected $appends = ['payment_status','payment_method'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
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
