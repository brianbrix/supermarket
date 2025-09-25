<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PaymentOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'code','name','provider','type','active','fee_fixed','fee_percent','meta'
    ];

    protected $casts = [
        'active' => 'boolean',
        'fee_fixed' => 'decimal:2',
        'fee_percent' => 'decimal:4',
        'meta' => 'array'
    ];
}
