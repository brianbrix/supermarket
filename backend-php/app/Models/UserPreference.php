<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'theme_preference',
        'newsletter',
        'order_updates',
        'marketing',
        'addresses',
    ];

    protected $casts = [
        'newsletter' => 'boolean',
        'order_updates' => 'boolean',
        'marketing' => 'boolean',
        'addresses' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
