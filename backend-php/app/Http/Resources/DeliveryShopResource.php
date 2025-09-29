<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryShopResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'phone' => $this->phone,
            'email' => $this->email,
            'isActive' => (bool)$this->is_active,
            'addressLine1' => $this->address_line1,
            'addressLine2' => $this->address_line2,
            'city' => $this->city,
            'region' => $this->region,
            'postalCode' => $this->postal_code,
            'lat' => $this->lat,
            'lng' => $this->lng,
            'serviceRadiusKm' => $this->service_radius_km,
            'openingHours' => $this->opening_hours,
            'deliveryWindowMinutes' => $this->delivery_window_minutes,
            'distanceKm' => property_exists($this, 'distance_km') ? round($this->distance_km, 2) : null,
        ];
    }
}
