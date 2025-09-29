<?php

namespace App\Models;
use Laravel\Sanctum\HasApiTokens;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class Category extends Model
{
    use HasApiTokens ,HasFactory;

    protected $fillable = ['name','description','parent_id','slug','path','depth'];

    protected $appends = ['full_name'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function products() {
        return $this->hasMany(Product::class);
    }

    public function brands()
    {
        return $this->belongsToMany(Brand::class)->withTimestamps();
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('name');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('depth')->orderBy('name');
    }

    public function getFullNameAttribute(): string
    {
        $segments = [];
        $current = $this;
        $guard = 0;
        while ($current && $guard < 10_000) {
            array_unshift($segments, $current->name);
            $current = $current->parent;
            $guard++;
        }
        return implode(' > ', $segments);
    }

    protected static function booted(): void
    {
        static::creating(function (self $category) {
            $category->ensureHierarchyAttributes();
        });

        static::updating(function (self $category) {
            if ($category->isDirty('name') || $category->isDirty('parent_id')) {
                $category->ensureHierarchyAttributes();
            }
        });

        static::saved(function (self $category) {
            if ($category->wasChanged(['slug', 'parent_id', 'path', 'depth'])) {
                $category->refreshDescendantHierarchy();
            }
        });
    }

    protected function ensureHierarchyAttributes(): void
    {
        $parentId = $this->parent_id ?: null;
        $this->slug = static::generateUniqueSlug($this->name, $parentId, $this->id);
        $parent = $parentId ? static::find($parentId) : null;
        $this->depth = $parent ? ($parent->depth + 1) : 0;
        $this->path = $parent ? ($parent->path ? $parent->path . '/' . $this->slug : $this->slug) : $this->slug;
    }

    protected static function generateUniqueSlug(string $name, ?int $parentId, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 1;
        while (static::query()
                ->when($ignoreId, fn($q) => $q->where('id', '!=', $ignoreId))
                ->where('parent_id', $parentId)
                ->where('slug', $slug)
                ->exists()) {
            $slug = $base . '-' . $suffix;
            $suffix++;
        }
        return $slug;
    }

    public function refreshDescendantHierarchy(): void
    {
        $this->loadMissing('children');
        foreach ($this->children as $child) {
            $child->depth = $this->depth + 1;
            $child->path = $this->path ? $this->path . '/' . $child->slug : $child->slug;
            $child->save();
        }
    }

    public function descendantIds(): array
    {
        if (!$this->path) {
            return [];
        }
        return static::query()
            ->where('path', 'like', $this->path . '/%')
            ->pluck('id')
            ->all();
    }
}
