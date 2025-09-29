<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class ProductRating extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'product_id',
        'user_id',
        'order_item_id',
        'rating',
        'title',
        'comment',
        'customer_name',
        'is_verified',
        'is_flagged',
        'metadata',
    ];

    protected $casts = [
        'rating' => 'integer',
        'is_verified' => 'boolean',
        'is_flagged' => 'boolean',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        $refresh = function (self $rating): void {
            $rating->refreshProductAggregates();
        };

        static::created($refresh);
        static::updated($refresh);
        static::deleted($refresh);
        static::forceDeleted($refresh);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function refreshProductAggregates(): void
    {
        if (!$this->product_id) {
            return;
        }

        $productId = $this->product_id;

        $stats = static::query()
            ->where('product_id', $productId)
            ->selectRaw('COUNT(*) as aggregate_count, COALESCE(SUM(rating), 0) as aggregate_sum, MAX(created_at) as aggregate_last_date')
            ->first();

        $count = (int) ($stats->aggregate_count ?? 0);
        $sum = (int) ($stats->aggregate_sum ?? 0);
        $avg = $count > 0 ? round($sum / $count, 2) : 0;
        $last = $stats?->aggregate_last_date;

        DB::table('products')
            ->where('id', $productId)
            ->update([
                'rating_count' => $count,
                'rating_sum' => $sum,
                'rating_avg' => $avg,
                'rating_last_submitted_at' => $last,
            ]);
    }
}
