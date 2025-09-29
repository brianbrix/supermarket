<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

use App\Http\Resources\DeliveryShopResource;

class DeliveryResource extends JsonResource
{
    public function toArray($request): array
    {
        $history = $this->history;
        if (is_string($history)) {
            $decoded = json_decode($history, true);
            $history = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }
        $history = is_array($history) ? array_values($history) : [];

        $order = $this->whenLoaded('order');

        return [
            'id' => $this->id,
            'orderId' => $this->order_id,
            'status' => $this->status,
            'driverName' => $this->driver_name,
            'driverPhone' => $this->driver_phone,
            'eta' => $this->eta?->toIso8601String(),
            'history' => $history,
            'internalNotes' => $this->internal_notes,
            'shop' => DeliveryShopResource::make($this->whenLoaded('shop')),
            'order' => $order ? [
                'id' => $order->id,
                'orderNumber' => $order->order_number,
                'customerName' => $order->customer_name,
                'customerPhone' => $order->customer_phone,
                'deliveryType' => $order->delivery_type,
                'deliveryStatus' => $order->delivery_status,
                'deliveryRequestedAt' => optional($order->delivery_requested_at)->toIso8601String(),
                'deliveryDispatchedAt' => optional($order->delivery_dispatched_at)->toIso8601String(),
                'deliveryCompletedAt' => optional($order->delivery_completed_at)->toIso8601String(),
                'deliveryAddress' => [
                    'line1' => $order->delivery_address_line1,
                    'line2' => $order->delivery_address_line2,
                    'city' => $order->delivery_city,
                    'region' => $order->delivery_region,
                    'postalCode' => $order->delivery_postal_code,
                    'lat' => $order->delivery_lat,
                    'lng' => $order->delivery_lng,
                ],
                'deliveryContact' => [
                    'phone' => $order->delivery_contact_phone,
                    'email' => $order->delivery_contact_email,
                    'notes' => $order->delivery_notes,
                ],
                'deliveryDistanceKm' => $order->delivery_distance_km !== null ? (float) $order->delivery_distance_km : null,
                'deliveryCost' => $order->delivery_cost !== null ? (float) $order->delivery_cost : null,
                'totalGross' => $order->total_gross !== null ? (float) $order->total_gross : null,
                'totalNet' => $order->total_net !== null ? (float) $order->total_net : null,
                'vatAmount' => $order->vat_amount !== null ? (float) $order->vat_amount : null,
                'couponCode' => $order->coupon_code,
            ] : null,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
