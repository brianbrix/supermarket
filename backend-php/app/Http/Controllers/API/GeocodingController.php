<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\SystemSettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class GeocodingController extends Controller
{
    private const CACHE_TTL = 3600; // seconds

    public function __construct(private SystemSettingService $settings)
    {
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => 'required|string|min:3|max:120',
            'limit' => 'nullable|integer|min:1|max:10',
        ]);

        $query = trim($data['q']);
        $limit = $data['limit'] ?? 5;

        $cacheKey = sprintf('geo:search:%s:%d', md5(strtolower($query)), $limit);
        $results = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($query, $limit) {
            $provider = $this->settings->get('delivery.autocomplete.provider', 'photon');
            return match ($provider) {
                'photon' => $this->queryPhoton($query, $limit),
                default => $this->queryPhoton($query, $limit),
            };
        });

        return response()->json([
            'query' => $query,
            'results' => $results,
        ]);
    }

    private function queryPhoton(string $query, int $limit): array
    {
        try {
            $response = Http::timeout(10)
                ->baseUrl('https://photon.komoot.io')
                ->get('/api', [
                    'q' => $query,
                    'lang' => 'en',
                    'limit' => $limit,
                ]);
            if (!$response->successful()) {
                throw new \RuntimeException('Geocoding provider error.');
            }
            $json = $response->json();
        } catch (\Throwable $e) {
            report($e);
            throw ValidationException::withMessages([
                'q' => 'Geocoding service is currently unavailable. Please try again shortly.',
            ]);
        }

        $features = $json['features'] ?? [];
        $mapped = [];
        foreach ($features as $feature) {
            $properties = $feature['properties'] ?? [];
            $geometry = $feature['geometry']['coordinates'] ?? null;
            if (!is_array($geometry) || count($geometry) < 2) {
                continue;
            }
            [$lng, $lat] = $geometry;
            $label = $properties['name'] ?? $properties['label'] ?? null;
            if ($label === null) {
                $parts = array_filter([
                    $properties['name'] ?? null,
                    $properties['street'] ?? null,
                    $properties['city'] ?? null,
                    $properties['country'] ?? null,
                ]);
                $label = implode(', ', $parts);
            }
            if (!$label) {
                continue;
            }
            $mapped[] = [
                'id' => $feature['properties']['osm_id'] ?? null,
                'label' => $label,
                'latitude' => (float) $lat,
                'longitude' => (float) $lng,
                'street' => $properties['street'] ?? null,
                'houseNumber' => $properties['housenumber'] ?? null,
                'city' => $properties['city'] ?? $properties['name'] ?? null,
                'county' => $properties['county'] ?? null,
                'state' => $properties['state'] ?? null,
                'country' => $properties['country'] ?? null,
                'postcode' => $properties['postcode'] ?? null,
                'raw' => $feature,
            ];
        }

        return array_slice($mapped, 0, $limit);
    }
}
