<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;

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
        'support.email' => 'hello@supermarket.co.ke',
        'support.phone' => '',
        'support.whatsapp' => '254700000000',
        'delivery.base_fee' => 150,
        'delivery.per_km_fee' => 35,
        'delivery.free_above' => 5000,
        'delivery.min_fee' => 120,
        'delivery.rounding.step' => 10,
        'delivery.default_radius_km' => 15,
        'delivery.max_fee_ratio' => 0.6,
        'delivery.max_fee_absolute' => 800,
        'delivery.low_order_subsidy_threshold' => 2000,
        'delivery.low_order_subsidy_factor' => 0.65,
        'delivery.cap_to_cart_total' => true,
        'delivery.autocomplete.provider' => 'photon',
        'inventory.low_stock_threshold' => 5,
        'orders.delay_alert_hours' => 6,
        'orders.high_value_threshold' => 25000,
        'delivery.content' => [
            'baseFee' => 150,
            'freeDeliveryThreshold' => 2500,
            'coverageZones' => [
                [
                    'key' => 'kilimani-yaya',
                    'name' => 'Kilimani & Yaya',
                    'eta' => '1-2 hours',
                    'notes' => 'Morning and evening slots available daily.',
                ],
                [
                    'key' => 'lavington-kileleshwa',
                    'name' => 'Lavington & Kileleshwa',
                    'eta' => '2-3 hours',
                    'notes' => 'Same-day deliveries with insulated transport.',
                ],
                [
                    'key' => 'karen',
                    'name' => 'Karen',
                    'eta' => 'Same day',
                    'notes' => 'Order by 2pm for same-day drop-off; chilled items stay cold.',
                ],
                [
                    'key' => 'westlands-parklands',
                    'name' => 'Westlands & Parklands',
                    'eta' => '2-4 hours',
                    'notes' => 'Evening window popular—book early to secure a slot.',
                ],
            ],
            'windows' => [
                [
                    'key' => 'early-bird',
                    'label' => 'Early bird',
                    'timeLabel' => '07:00 – 10:00',
                    'startTime' => '07:00',
                    'endTime' => '10:00',
                    'cutoffTime' => '05:00',
                    'details' => 'Perfect for restaurants and families prepping breakfast.',
                ],
                [
                    'key' => 'midday-refresh',
                    'label' => 'Midday refresh',
                    'timeLabel' => '11:00 – 14:00',
                    'startTime' => '11:00',
                    'endTime' => '14:00',
                    'cutoffTime' => '09:00',
                    'details' => 'Restock pantry staples before school pick-ups.',
                ],
                [
                    'key' => 'evening-drop',
                    'label' => 'Evening drop',
                    'timeLabel' => '17:00 – 21:00',
                    'startTime' => '17:00',
                    'endTime' => '21:00',
                    'cutoffTime' => '15:00',
                    'details' => 'Arrives right before dinner with chilled liners intact.',
                ],
                [
                    'key' => 'next-day-express',
                    'label' => 'Next-day express',
                    'timeLabel' => 'Order by midnight',
                    'startTime' => null,
                    'endTime' => null,
                    'cutoffTime' => '23:59',
                    'details' => 'Priority packing and dispatch first thing the next morning.',
                ],
            ],
            'highlights' => [
                [
                    'icon' => 'truck',
                    'title' => 'Same-day coverage',
                    'description' => 'We run multiple city loops every day so fresh groceries reach you the same day you order.',
                ],
                [
                    'icon' => 'snow',
                    'title' => 'Cold chain on board',
                    'description' => 'Chilled proteins and dairy ride in insulated liners with temperature monitors for a safe hand-off.',
                ],
                [
                    'icon' => 'clock-history',
                    'title' => 'Live slot tracking',
                    'description' => 'Pick a slot that fits your schedule and follow the courier ETA via WhatsApp updates.',
                ],
                [
                    'icon' => 'shield-check',
                    'title' => 'Verified riders',
                    'description' => 'Our riders are background-checked, uniformed, and trained in food handling best practices.',
                ],
            ],
            'processSteps' => [
                [
                    'step' => '01',
                    'headline' => 'Build your basket',
                    'copy' => 'Shop from seasonal produce, pantry staples, and specialty goods curated by our sourcing team.',
                ],
                [
                    'step' => '02',
                    'headline' => 'Pick your window',
                    'copy' => 'Choose a delivery slot that works for you. We confirm availability instantly and hold cold items in reserve.',
                ],
                [
                    'step' => '03',
                    'headline' => 'Track to doorstep',
                    'copy' => 'Receive status pings when your rider leaves the hub, arrives at security, and completes hand-off.',
                ],
            ],
            'packaging' => [
                [
                    'title' => 'Sustainable liners',
                    'body' => 'Produce travels in reusable crates. Proteins and dairy sit in insulated liners returned on your next order.',
                ],
                [
                    'title' => 'Temperature checks',
                    'body' => 'Every cooler is scanned before departure. We reject anything outside the safe temperature range.',
                ],
                [
                    'title' => 'Fragile handling',
                    'body' => 'Eggs, glass jars, and bakery treats get separate compartments with "This side up" indicators.',
                ],
            ],
            'faqs' => [
                [
                    'question' => 'What is the standard delivery fee?',
                    'answer' => 'City deliveries start at 150 KES. Orders above 2500 KES ship free on the next available slot.',
                ],
                [
                    'question' => 'Can I change my slot after checkout?',
                    'answer' => 'Yes—tap the tracking link or message us up to two hours before your window to reschedule at no extra cost.',
                ],
                [
                    'question' => 'Do you support bulk/office deliveries?',
                    'answer' => 'Absolutely. Use a midday or next-day window and mark the order as business so we can coordinate offloading.',
                ],
                [
                    'question' => 'What happens if an item is missing?',
                    'answer' => 'Flag it with your rider or via WhatsApp within 24 hours. We refund instantly or fast-track a replacement on the next loop.',
                ],
            ],
        ],
    ];

    private const CACHE_KEY_ALL = 'system-settings:all';

    public function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY_ALL, function () {
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
        });
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

        $this->flushCache();

        return $this->listWithMeta();
    }

    public function flushCache(): void
    {
        Cache::forget(self::CACHE_KEY_ALL);
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
