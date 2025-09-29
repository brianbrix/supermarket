<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

use App\Http\Resources\DeliveryShopResource;
use App\Http\Resources\DeliveryResource;

class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'orderNumber' => $this->order_number,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'customerName' => $this->customer_name,
            'customerPhone' => $this->customer_phone,
            'status' => $this->status,
            'deliveryType' => $this->delivery_type,
            'deliveryStatus' => $this->delivery_status,
            'deliveryRequestedAt' => $this->delivery_requested_at?->toIso8601String(),
            'deliveryDispatchedAt' => $this->delivery_dispatched_at?->toIso8601String(),
            'deliveryCompletedAt' => $this->delivery_completed_at?->toIso8601String(),
            'deliveryAddress' => [
                'line1' => $this->delivery_address_line1,
                'line2' => $this->delivery_address_line2,
                'city' => $this->delivery_city,
                'region' => $this->delivery_region,
                'postalCode' => $this->delivery_postal_code,
                'lat' => $this->delivery_lat,
                'lng' => $this->delivery_lng,
            ],
            'deliveryContact' => [
                'phone' => $this->delivery_contact_phone,
                'email' => $this->delivery_contact_email,
                'notes' => $this->delivery_notes,
            ],
            'deliveryCost' => $this->delivery_cost !== null ? (float)$this->delivery_cost : null,
            'deliveryDistanceKm' => $this->delivery_distance_km !== null ? (float)$this->delivery_distance_km : null,
            'deliveryShop' => new DeliveryShopResource($this->whenLoaded('deliveryShop')),
            'deliveryRecord' => new DeliveryResource($this->whenLoaded('delivery')),
            'totalGross' => (float)$this->total_gross,
            'totalNet' => (float)$this->total_net,
            'vatAmount' => (float)$this->vat_amount,
            'thumbnailUrl' => $this->thumbnail_url,
            'items' => OrderItemResource::collection($this->whenLoaded('items'))
        ];
    }
}
