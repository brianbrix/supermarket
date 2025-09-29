<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Delivery extends Model
{
    use HasFactory;

    public const STATUSES = [
        'REQUESTED',
        'ASSIGNED',
        'EN_ROUTE',
        'DELIVERED',
        'CANCELLED',
    ];

    protected $fillable = [
        'order_id',
        'delivery_shop_id',
        'status',
        'driver_name',
        'driver_phone',
        'eta',
        'history',
        'internal_notes',
    ];

    protected $casts = [
        'eta' => 'datetime',
        'history' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function shop()
    {
        return $this->belongsTo(DeliveryShop::class, 'delivery_shop_id');
    }
}
