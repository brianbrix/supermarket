<?php

namespace App\Models;
use Laravel\Sanctum\HasApiTokens;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductImage extends Model
{
    use HasApiTokens, HasFactory;

    protected $fillable = ['product_id','url','position'];

    public function product() {
        return $this->belongsTo(Product::class);
    }
}
