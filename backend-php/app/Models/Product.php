<?php

namespace App\Models;
use Laravel\Sanctum\HasApiTokens;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** @property float $rating_avg */
/** @property int $rating_count */

class Product extends Model
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'name','brand','brand_id','description','price','stock','unit','category_id','image_url','active'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'rating_avg' => 'float',
        'rating_sum' => 'integer',
        'rating_count' => 'integer',
        'rating_last_submitted_at' => 'datetime',
        'active' => 'boolean',
    ];

    protected $attributes = [
        'active' => true,
    ];

    /**
     * Scope to only active (not archived) products.
     */
    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    public function category() {
        return $this->belongsTo(Category::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function images() {
        return $this->hasMany(ProductImage::class)->orderBy('position');
    }

    public function orderItems() {
        return $this->hasMany(OrderItem::class);
    }

    public function ratings()
    {
        return $this->hasMany(ProductRating::class);
    }

    public function tags()
    {
        return $this->belongsToMany(ProductTag::class)->withTimestamps();
    }
}
