<?php

namespace App\Services;

use App\Models\SystemSetting;

class SystemSettingService
{
    /**
     * Application-wide default settings. These are returned whenever no
     * custom value has been stored yet.
     */
    private array $defaults = [
        'currency.code' => 'KES',
        'currency.symbol' => 'KES',
        'currency.locale' => 'en-KE',
        'theme.default' => 'light',
        'store.name' => 'Supermarket',
    ];

    public function all(): array
    {
        $settings = SystemSetting::query()->get()->keyBy('key');

        $resolved = [];
        foreach ($this->defaults as $key => $default) {
            $resolved[$key] = $settings->has($key)
                ? $settings[$key]->resolved_value
                : $default;
        }

        foreach ($settings as $key => $setting) {
            if (!array_key_exists($key, $resolved)) {
                $resolved[$key] = $setting->resolved_value;
            }
        }

        return $resolved;
    }

    public function listWithMeta(): array
    {
        return SystemSetting::query()->orderBy('key')->get()->map(fn (SystemSetting $setting) => $setting->toArray())->values()->all();
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->all()[$key] ?? $default;
    }

    public function upsertMany(array $records): array
    {
        foreach ($records as $record) {
            $key = $record['key'];
            $type = $record['type'] ?? null;
            $value = $record['value'] ?? null;
            $normalizedType = $this->normalizeType($type, $value);
            $normalizedValue = $this->normalizeValue($value, $normalizedType);

            SystemSetting::updateOrCreate(
                ['key' => $key],
                [
                    'type' => $normalizedType,
                    'value' => $normalizedValue,
                ]
            );
        }

        return $this->listWithMeta();
    }

    private function normalizeType(?string $type, mixed $value): string
    {
        $allowed = ['string', 'number', 'boolean', 'json'];
        if ($type && in_array($type, $allowed, true)) {
            return $type;
        }

        if (is_bool($value)) {
            return 'boolean';
        }
        if (is_numeric($value)) {
            return 'number';
        }
        if (is_array($value) || is_object($value)) {
            return 'json';
        }
        return 'string';
    }

    private function normalizeValue(mixed $value, string $type): mixed
    {
        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false,
            'number' => is_numeric($value) ? $value + 0 : 0,
            'json' => is_string($value) ? $this->decodeJson($value) : $value,
            default => is_scalar($value) ? (string)$value : $value,
        };
    }

    private function decodeJson(string $value): mixed
    {
        $decoded = json_decode($value, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }
}
