<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'createdAt' => $this->created_at?->toIso8601String(),
            'customerName' => $this->customer_name,
            'customerPhone' => $this->customer_phone,
            'status' => $this->status,
            'totalGross' => (float)$this->total_gross,
            'totalNet' => (float)$this->total_net,
            'vatAmount' => (float)$this->vat_amount,
            'thumbnailUrl' => $this->thumbnail_url,
            'items' => OrderItemResource::collection($this->whenLoaded('items'))
        ];
    }
}
