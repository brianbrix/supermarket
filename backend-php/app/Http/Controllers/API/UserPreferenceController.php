<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserPreferenceController extends Controller
{
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
                ])->filter(fn ($address) => $address['id'] !== '' && $address['details'] !== '')
                ->values()
                ->all(),
        ];
    }

    private function sanitizeAddresses(array $addresses): array
    {
        return collect($addresses)
            ->map(function ($address) {
                return [
                    'id' => isset($address['id']) ? (string) $address['id'] : null,
                    'label' => isset($address['label']) ? trim((string) $address['label']) : null,
                    'details' => isset($address['details']) ? trim((string) $address['details']) : null,
                ];
            })
            ->filter(fn ($address) => !empty($address['id']) && !empty($address['details']))
            ->slice(0, 5)
            ->values()
            ->all();
    }
}
