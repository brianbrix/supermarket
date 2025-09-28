<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'value',
        'type',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'resolved_value',
    ];

    public function getValueAttribute($value)
    {
        if ($value === null) {
            return null;
        }

        $decoded = json_decode($value, true);
        return $decoded === null && json_last_error() !== JSON_ERROR_NONE ? $value : $decoded;
    }

    public function setValueAttribute($value): void
    {
        $this->attributes['value'] = json_encode($value);
    }

    public function getResolvedValueAttribute()
    {
        $value = $this->value;
        $type = $this->type;

        if ($value === null) {
            return null;
        }

        return match ($type) {
            'boolean' => (bool)$value,
            'number' => is_array($value) ? null : ((float)$value),
            'json' => $value,
            default => is_array($value) ? $value : (string)$value,
        };
    }

    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'type' => $this->type,
            'value' => $this->resolved_value,
        ];
    }
}
