<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'productId' => $this->product_id,
            'quantity' => $this->quantity,
            'unitPriceGross' => (float)$this->unit_price_gross,
            'unitPriceNet' => (float)$this->unit_price_net,
            'vatAmount' => (float)$this->vat_amount,
            'product' => new ProductResource($this->whenLoaded('product'))
        ];
    }
}
