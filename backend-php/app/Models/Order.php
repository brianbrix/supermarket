<?php

namespace App\Models;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Laravel\Sanctum\HasApiTokens;

class Order extends Model
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'customer_name','customer_phone','status','total_gross','total_net','vat_amount','user_id','thumbnail_url'
    ];

    protected $appends = ['payment_status','payment_method'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

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
}
