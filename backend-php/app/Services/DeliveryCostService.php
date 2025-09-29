<?php

namespace App\Services;

use App\Models\DeliveryShop;
use InvalidArgumentException;

class DeliveryCostService
{
    public function __construct(private SystemSettingService $settings)
    {
    }

    public function calculate(DeliveryShop $shop, float $destinationLat, float $destinationLng, float $cartTotal): array
    {
        if (!$shop->hasCoordinates()) {
            throw new InvalidArgumentException('Selected shop is missing geolocation coordinates.');
        }

        $distanceKm = $this->distanceKm($shop->lat, $shop->lng, $destinationLat, $destinationLng);
        $config = $this->config();
        $baseFee = $config['base_fee'];
        $perKm = $config['per_km_fee'];
        $freeAbove = $config['free_above'];
        $minFee = $config['min_fee'];
        $roundStep = max(1, $config['rounding_step']);
        $maxRatio = $config['max_fee_ratio'];
        $maxAbsolute = $config['max_fee_absolute'];
        $lowOrderThreshold = $config['low_order_subsidy_threshold'];
        $lowOrderFactor = $config['low_order_subsidy_factor'];
        $capToCartTotal = $config['cap_to_cart_total'];

        $distanceComponent = $baseFee + ($distanceKm * $perKm);
        $costBeforeSubsidy = $distanceComponent;
        $cartTotal = max(0, $cartTotal);

        if ($freeAbove > 0 && $cartTotal >= $freeAbove) {
            return [
                'shop' => $shop,
                'distanceKm' => round($distanceKm, 2),
                'cost' => 0.0,
                'breakdown' => [
                    'baseFee' => $baseFee,
                    'perKmFee' => $perKm,
                    'distanceComponent' => round($distanceComponent, 2),
                    'cartSubsidyFactor' => 0,
                    'weightedCost' => 0,
                    'calculatedBeforeThreshold' => round($distanceComponent, 2),
                    'freeAbove' => $freeAbove,
                    'minFee' => $minFee,
                    'roundingStep' => $roundStep,
                    'maxFeeRatio' => $maxRatio,
                    'maxFeeAbsolute' => $maxAbsolute,
                    'lowOrderSubsidyThreshold' => $lowOrderThreshold,
                    'lowOrderSubsidyFactor' => $lowOrderFactor,
                    'capToCartTotal' => $capToCartTotal,
                    'effectiveUpperBound' => 0,
                    'effectiveMinFee' => 0,
                    'finalBeforeRounding' => 0,
                ],
            ];
        }

        $subsidyApplied = 1.0;
        if ($lowOrderThreshold > 0 && $cartTotal < $lowOrderThreshold) {
            $clampedFactor = max(0.1, min(1.0, $lowOrderFactor));
            $progress = max(0.0, min(1.0, $cartTotal / $lowOrderThreshold));
            $subsidyApplied = $clampedFactor + ($progress * (1.0 - $clampedFactor));
            $distanceComponent *= $subsidyApplied;
        }

        $maxByRatio = null;
        if ($maxRatio > 0 && $cartTotal > 0) {
            $maxByRatio = $cartTotal * $maxRatio;
        }

        $maxByAbsolute = null;
        if ($maxAbsolute > 0) {
            $maxByAbsolute = $maxAbsolute;
        }

        $effectiveUpperBound = INF;
        if ($maxByRatio !== null) {
            $effectiveUpperBound = min($effectiveUpperBound, $maxByRatio);
        }
        if ($maxByAbsolute !== null) {
            $effectiveUpperBound = min($effectiveUpperBound, $maxByAbsolute);
        }
        if ($capToCartTotal && $cartTotal > 0) {
            $effectiveUpperBound = min($effectiveUpperBound, $cartTotal);
        }

        $costWithCaps = min($distanceComponent, $effectiveUpperBound);

        $effectiveMinFee = $minFee;
        if ($maxByRatio !== null) {
            $effectiveMinFee = min($effectiveMinFee, $maxByRatio);
        }
        if ($maxByAbsolute !== null) {
            $effectiveMinFee = min($effectiveMinFee, $maxByAbsolute);
        }
        if ($capToCartTotal && $cartTotal > 0) {
            $effectiveMinFee = min($effectiveMinFee, $cartTotal);
        }

        $costBeforeRounding = max($effectiveMinFee, $costWithCaps);
        $roundedCost = $this->roundToStep($costBeforeRounding, $roundStep);

        if ($roundedCost > $costWithCaps) {
            $roundedCost = $costWithCaps;
        }
        if ($roundedCost < $effectiveMinFee) {
            $roundedCost = $effectiveMinFee;
        }

        $finalCost = round($roundedCost, 2);

        return [
            'shop' => $shop,
            'distanceKm' => round($distanceKm, 2),
            'cost' => $finalCost,
            'breakdown' => [
                'baseFee' => $baseFee,
                'perKmFee' => $perKm,
                'distanceComponent' => round($costBeforeSubsidy, 2),
                'cartSubsidyFactor' => round($subsidyApplied, 3),
                'weightedCost' => round($distanceComponent, 2),
                'calculatedBeforeThreshold' => round($costBeforeSubsidy, 2),
                'freeAbove' => $freeAbove,
                'minFee' => $minFee,
                'roundingStep' => $roundStep,
                'maxFeeRatio' => $maxRatio,
                'maxFeeAbsolute' => $maxAbsolute,
                'lowOrderSubsidyThreshold' => $lowOrderThreshold,
                'lowOrderSubsidyFactor' => $lowOrderFactor,
                'capToCartTotal' => $capToCartTotal,
                'effectiveUpperBound' => is_finite($effectiveUpperBound) ? round($effectiveUpperBound, 2) : null,
                'effectiveMinFee' => round($effectiveMinFee, 2),
                'finalBeforeRounding' => round($costBeforeRounding, 2),
            ],
        ];
    }

    public function findNearestShop(float $lat, float $lng, ?float $maxRadiusKm = null): ?DeliveryShop
    {
        $shops = DeliveryShop::query()->active()->whereNotNull('lat')->whereNotNull('lng')->get();
        if ($shops->isEmpty()) {
            return null;
        }

        $withDistance = $shops->map(function (DeliveryShop $shop) use ($lat, $lng) {
            $distance = $this->distanceKm($shop->lat, $shop->lng, $lat, $lng);
            $shop->setAttribute('distance_km', $distance);
            return $shop;
        })->sortBy('distance_km')->values();

        if ($maxRadiusKm !== null) {
            $withDistance = $withDistance->filter(fn (DeliveryShop $shop) => $shop->distance_km <= $maxRadiusKm)->values();
        }

        return $withDistance->first();
    }

    public function config(): array
    {
        return [
            'base_fee' => (float)($this->settings->get('delivery.base_fee', 150)),
            'per_km_fee' => (float)($this->settings->get('delivery.per_km_fee', 35)),
            'free_above' => (float)($this->settings->get('delivery.free_above', 5000)),
            'min_fee' => (float)($this->settings->get('delivery.min_fee', 120)),
            'rounding_step' => (float)($this->settings->get('delivery.rounding.step', 10)),
            'default_radius' => (float)($this->settings->get('delivery.default_radius_km', 15)),
            'max_fee_ratio' => (float)($this->settings->get('delivery.max_fee_ratio', 0.6)),
            'max_fee_absolute' => (float)($this->settings->get('delivery.max_fee_absolute', 800)),
            'low_order_subsidy_threshold' => (float)($this->settings->get('delivery.low_order_subsidy_threshold', 2000)),
            'low_order_subsidy_factor' => (float)($this->settings->get('delivery.low_order_subsidy_factor', 0.65)),
            'cap_to_cart_total' => (bool)($this->settings->get('delivery.cap_to_cart_total', true)),
        ];
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

    private function roundToStep(float $value, float $step): float
    {
        if ($value <= 0) {
            return 0.0;
        }

        return ceil($value / $step) * $step;
    }
}
