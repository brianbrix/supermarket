<?php

namespace App\Models;
use Laravel\Sanctum\HasApiTokens;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasApiTokens, HasFactory;

    protected $fillable = [
        'name','description','price','stock','unit','category_id','image_url'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function category() {
        return $this->belongsTo(Category::class);
    }

    public function images() {
        return $this->hasMany(ProductImage::class)->orderBy('position');
    }

    public function orderItems() {
        return $this->hasMany(OrderItem::class);
    }
}
