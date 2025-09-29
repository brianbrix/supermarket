<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliveryShopResource;
use App\Models\DeliveryShop;
use App\Services\DeliveryCostService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DeliveryController extends Controller
{
    public function shops(Request $request, DeliveryCostService $costService): JsonResponse
    {
        $request->validate([
            'includeInactive' => 'sometimes|boolean',
            'lat' => 'sometimes|numeric|between:-90,90',
            'lng' => 'sometimes|numeric|between:-180,180',
        ]);

        $query = DeliveryShop::query();
        if (!$request->boolean('includeInactive')) {
            $query->active();
        }
        $shops = $query->orderBy('name')->get();

        $lat = $request->input('lat');
        $lng = $request->input('lng');
        if ($lat !== null && $lng !== null) {
            $lat = (float) $lat;
            $lng = (float) $lng;
            $shops = $shops->map(function (DeliveryShop $shop) use ($lat, $lng) {
                if ($shop->hasCoordinates()) {
                    $distance = $this->distanceKm($shop->lat, $shop->lng, $lat, $lng);
                    $shop->setAttribute('distance_km', $distance);
                } else {
                    $shop->setAttribute('distance_km', null);
                }
                return $shop;
            })->sortBy(fn ($shop) => $shop->distance_km ?? INF)->values();
        }

        return response()->json([
            'content' => collect($shops)->map(fn ($shop) => (new DeliveryShopResource($shop))->toArray($request))->all(),
        ]);
    }

    public function quote(Request $request, DeliveryCostService $costService): JsonResponse
    {
        $data = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
            'cartTotal' => 'required|numeric|min:0',
            'shopId' => 'nullable|integer|exists:delivery_shops,id',
        ]);

        $lat = (float) $data['lat'];
        $lng = (float) $data['lng'];
        $cartTotal = (float) $data['cartTotal'];
        $config = $costService->config();
        $shop = null;

        if (!empty($data['shopId'])) {
            $shop = DeliveryShop::query()->find($data['shopId']);
            if (!$shop) {
                return $this->prepareQuoteResponse(
                    $request,
                    null,
                    null,
                    $config,
                    false,
                    'shop_not_found',
                    'Selected shop could not be found.'
                );
            }
            if (!$shop->is_active) {
                return $this->prepareQuoteResponse(
                    $request,
                    $shop,
                    null,
                    $config,
                    false,
                    'shop_inactive',
                    'Selected shop is currently unavailable for delivery.'
                );
            }
        } else {
            $shop = $costService->findNearestShop($lat, $lng, $config['default_radius'] ?? null);
            if (!$shop) {
                $suggestedShop = $costService->findNearestShop($lat, $lng, null);
                return $this->prepareQuoteResponse(
                    $request,
                    $suggestedShop,
                    null,
                    $config,
                    false,
                    'no_shop',
                    'No delivery shop is available for your location yet.'
                );
            }
        }

        if (!$shop->hasCoordinates()) {
            return $this->prepareQuoteResponse(
                $request,
                $shop,
                null,
                $config,
                false,
                'missing_coordinates',
                'Selected shop is missing coordinates. Please contact support.'
            );
        }

        $quote = $costService->calculate($shop, $lat, $lng, $cartTotal);
        $maxRadius = $shop->service_radius_km ?? ($config['default_radius'] ?? null);
        if ($maxRadius > 0 && $quote['distanceKm'] > $maxRadius) {
            return $this->prepareQuoteResponse(
                $request,
                $shop,
                $quote,
                $config,
                false,
                'outside_radius',
                'Delivery address is outside the service radius for the selected shop.'
            );
        }

        return $this->prepareQuoteResponse(
            $request,
            $shop,
            $quote,
            $config,
            true
        );
    }

    private function prepareQuoteResponse(
        Request $request,
        ?DeliveryShop $shop,
        ?array $quote,
        array $config,
        bool $available,
        ?string $reason = null,
        ?string $message = null
    ): JsonResponse {
        $shopPayload = $shop ? (new DeliveryShopResource($shop))->toArray($request) : null;
        $distance = $quote['distanceKm'] ?? ($shopPayload['distanceKm'] ?? $shopPayload['distance_km'] ?? null);

        if ($shopPayload !== null && $distance !== null) {
            $shopPayload['distanceKm'] = $distance;
        }

        return response()->json([
            'available' => $available,
            'reason' => $reason,
            'message' => $message,
            'shop' => $shopPayload,
            'cost' => $available ? ($quote['cost'] ?? null) : null,
            'distanceKm' => $distance,
            'config' => [
                'freeAbove' => $quote['breakdown']['freeAbove'] ?? $config['free_above'] ?? null,
                'baseFee' => $quote['breakdown']['baseFee'] ?? $config['base_fee'] ?? null,
                'perKmFee' => $quote['breakdown']['perKmFee'] ?? $config['per_km_fee'] ?? null,
                'minFee' => $quote['breakdown']['minFee'] ?? $config['min_fee'] ?? null,
                'roundingStep' => $quote['breakdown']['roundingStep'] ?? $config['rounding_step'] ?? null,
                'defaultRadius' => $config['default_radius'] ?? null,
                'maxFeeRatio' => $quote['breakdown']['maxFeeRatio'] ?? $config['max_fee_ratio'] ?? null,
                'maxFeeAbsolute' => $quote['breakdown']['maxFeeAbsolute'] ?? $config['max_fee_absolute'] ?? null,
                'lowOrderSubsidyThreshold' => $quote['breakdown']['lowOrderSubsidyThreshold'] ?? $config['low_order_subsidy_threshold'] ?? null,
                'lowOrderSubsidyFactor' => $quote['breakdown']['lowOrderSubsidyFactor'] ?? $config['low_order_subsidy_factor'] ?? null,
                'capToCartTotal' => $quote['breakdown']['capToCartTotal'] ?? $config['cap_to_cart_total'] ?? null,
            ],
            'breakdown' => $quote['breakdown'] ?? null,
        ]);
    }

    private function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371; // km
        $latFrom = deg2rad($lat1);
        $lngFrom = deg2rad($lng1);
        $latTo = deg2rad($lat2);
        $lngTo = deg2rad($lng2);

        $latDelta = $latTo - $latFrom;
        $lngDelta = $lngTo - $lngFrom;

        $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) + cos($latFrom) * cos($latTo) * pow(sin($lngDelta / 2), 2)));
        return $earthRadius * $angle;
    }
}
