<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => (float)$this->price,
            'stock' => $this->stock,
            'unit' => $this->unit,
            'categoryId' => $this->category_id,
            'categoryName' => optional($this->category)->name,
            'imageUrl' => $this->image_url,
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
