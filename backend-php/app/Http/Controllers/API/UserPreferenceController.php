<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserPreferenceController extends Controller
{
    private const KENYAN_PHONE_REGEX = '/^(?:\+?254|0)(?:7|1)\d{8}$/';
    public function show(Request $request): JsonResponse
    {
        $preferences = $this->findOrCreate($request->user()->id);

        return response()->json($this->transform($preferences));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'themePreference' => ['required', 'string', 'in:light,dark'],
            'newsletter' => ['required', 'boolean'],
            'orderUpdates' => ['required', 'boolean'],
            'marketing' => ['required', 'boolean'],
            'addresses' => ['sometimes', 'array', 'max:5'],
            'addresses.*.id' => ['required_with:addresses', 'string', 'max:191'],
            'addresses.*.label' => ['required_with:addresses', 'string', 'max:191'],
            'addresses.*.details' => ['required_with:addresses', 'string', 'max:500'],
            'addresses.*.context' => ['nullable', 'string', 'max:255'],
            'addresses.*.lat' => ['nullable', 'numeric', 'between:-90,90'],
            'addresses.*.lng' => ['nullable', 'numeric', 'between:-180,180'],
            'addresses.*.placeId' => ['nullable', 'string', 'max:191'],
            'addresses.*.contactName' => ['nullable', 'string', 'max:191'],
            'addresses.*.contactPhone' => ['nullable', 'string', 'regex:' . self::KENYAN_PHONE_REGEX],
            'addresses.*.contactEmail' => ['nullable', 'email', 'max:191'],
            'addresses.*.instructions' => ['nullable', 'string', 'max:1000'],
        ]);

        $preferences = $this->findOrCreate($request->user()->id);
        $preferences->fill([
            'theme_preference' => $data['themePreference'],
            'newsletter' => $data['newsletter'],
            'order_updates' => $data['orderUpdates'],
            'marketing' => $data['marketing'],
            'addresses' => array_key_exists('addresses', $data)
                ? $this->sanitizeAddresses($data['addresses'])
                : $preferences->addresses,
        ]);
        $preferences->save();

        return response()->json($this->transform($preferences));
    }

    private function findOrCreate(int $userId): UserPreference
    {
        return UserPreference::firstOrCreate(
            ['user_id' => $userId],
            [
                'theme_preference' => 'light',
                'newsletter' => true,
                'order_updates' => true,
                'marketing' => false,
                'addresses' => [],
            ]
        );
    }

    private function transform(UserPreference $preferences): array
    {
        return [
            'themePreference' => $preferences->theme_preference ?? 'light',
            'newsletter' => (bool) $preferences->newsletter,
            'orderUpdates' => (bool) $preferences->order_updates,
            'marketing' => (bool) $preferences->marketing,
            'addresses' => collect($preferences->addresses ?? [])
                ->map(fn ($address) => [
                    'id' => (string) ($address['id'] ?? ''),
                    'label' => (string) ($address['label'] ?? ''),
                    'details' => (string) ($address['details'] ?? ''),
                    'context' => isset($address['context']) ? (string) $address['context'] : null,
                    'lat' => $this->normalizeFloat($address['lat'] ?? null),
                    'lng' => $this->normalizeFloat($address['lng'] ?? null),
                    'placeId' => isset($address['placeId']) ? (string) $address['placeId'] : null,
                    'contactName' => isset($address['contactName']) ? (string) $address['contactName'] : null,
                    'contactPhone' => isset($address['contactPhone']) ? (string) $address['contactPhone'] : null,
                    'contactEmail' => isset($address['contactEmail']) ? (string) $address['contactEmail'] : null,
                    'instructions' => isset($address['instructions']) ? (string) $address['instructions'] : null,
                ])->filter(fn ($address) => $address['id'] !== '' && $address['details'] !== '')
                ->values()
                ->all(),
        ];
    }

    private function sanitizeAddresses(array $addresses): array
    {
        return collect($addresses)
            ->map(function ($address) {
                $details = isset($address['details']) ? trim((string) $address['details']) : null;
                $id = isset($address['id']) ? (string) $address['id'] : null;
                if (empty($id) || empty($details)) {
                    return null;
                }

                $label = isset($address['label']) ? trim((string) $address['label']) : 'Saved address';
                $context = isset($address['context']) ? trim((string) $address['context']) : null;
                $placeId = isset($address['placeId']) ? trim((string) $address['placeId']) : null;
                $lat = $this->normalizeFloat($address['lat'] ?? null);
                $lng = $this->normalizeFloat($address['lng'] ?? null);
                $contactName = isset($address['contactName']) ? trim((string) $address['contactName']) : null;
                $contactPhone = isset($address['contactPhone']) ? trim((string) $address['contactPhone']) : null;
                $contactEmail = isset($address['contactEmail']) ? trim((string) $address['contactEmail']) : null;
                $instructions = isset($address['instructions']) ? trim((string) $address['instructions']) : null;

                return array_filter([
                    'id' => $id,
                    'label' => $label !== '' ? $label : 'Saved address',
                    'details' => $details,
                    'context' => $context !== '' ? $context : null,
                    'lat' => $lat,
                    'lng' => $lng,
                    'placeId' => $placeId !== '' ? $placeId : null,
                    'contactName' => $contactName !== '' ? $contactName : null,
                    'contactPhone' => $contactPhone !== '' ? $contactPhone : null,
                    'contactEmail' => $contactEmail !== '' ? $contactEmail : null,
                    'instructions' => $instructions !== '' ? $instructions : null,
                ], fn ($value) => $value !== null);
            })
            ->filter()
            ->slice(0, 5)
            ->values()
            ->all();
    }

    private function normalizeFloat($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        if (is_string($value)) {
            $normalized = trim($value);
            if ($normalized === '') {
                return null;
            }
            return is_numeric($normalized) ? (float) $normalized : null;
        }
        return null;
    }
}
