<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryShop extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'phone',
        'email',
        'is_active',
        'address_line1',
        'address_line2',
        'city',
        'region',
        'postal_code',
        'lat',
        'lng',
        'service_radius_km',
        'opening_hours',
        'delivery_window_minutes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'lat' => 'float',
        'lng' => 'float',
        'service_radius_km' => 'float',
        'opening_hours' => 'array',
        'delivery_window_minutes' => 'integer',
    ];

    public function orders()
    {
        return $this->hasMany(Order::class, 'delivery_shop_id');
    }

    public function deliveries()
    {
        return $this->hasMany(Delivery::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function hasCoordinates(): bool
    {
        return is_numeric($this->lat) && is_numeric($this->lng);
    }
}
