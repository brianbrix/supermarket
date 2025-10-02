<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builders\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $type
 * @property string $title
 * @property string|null $message
 * @property string $severity
 * @property string|null $context_type
 * @property int|null $context_id
 * @property array|null $data
 * @property Carbon|null $read_at
 * @property Carbon $created_at
 */
class AdminNotification extends Model
{
    use HasFactory;

    protected $table = 'admin_notifications';

    protected $fillable = [
        'type',
        'title',
        'message',
        'severity',
        'context_type',
        'context_id',
        'data',
        'dedupe_key',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }

    public function scopeType(Builder $query, ?string $type): Builder
    {
        if (!$type) {
            return $query;
        }

        return $query->where('type', $type);
    }

    public function markAsRead(): void
    {
        if ($this->read_at) {
            return;
        }
        $this->forceFill(['read_at' => now()])->save();
    }

    public function markAsUnread(): void
    {
        if (!$this->read_at) {
            return;
        }
        $this->forceFill(['read_at' => null])->save();
    }
}
