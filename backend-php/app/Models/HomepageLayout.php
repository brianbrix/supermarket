<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomepageLayout extends Model
{
    use HasFactory;

    protected $fillable = [
        'slug',
        'version',
        'title',
        'status',
        'is_active',
        'layout',
        'meta',
        'published_at',
        'published_by',
    ];

    protected $casts = [
        'layout' => 'array',
        'meta' => 'array',
        'is_active' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function scopeActive(Builder $query, string $slug = 'home'): Builder
    {
        return $query->where('slug', $slug)->where('is_active', true);
    }
}
