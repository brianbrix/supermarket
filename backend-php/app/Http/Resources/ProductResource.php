<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        $brandRelation = $this->relationLoaded('brand') ? $this->getRelation('brand') : null;
        $brandName = $brandRelation?->name;
        $brandSlug = $brandRelation?->slug;

        if (!$brandName) {
            if (is_array($this->brand)) {
                $brandName = $this->brand['name'] ?? null;
                $brandSlug = $brandSlug ?? ($this->brand['slug'] ?? null);
            } elseif (is_string($this->brand)) {
                $brandName = $this->brand;
            }
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'brand' => $brandName,
            'brandId' => $this->brand_id,
            'brandName' => $brandName,
            'brandSlug' => $brandSlug,
            'description' => $this->description,
            'price' => (float)$this->price,
            'stock' => $this->stock,
            'active' => (bool)$this->active,
            'unit' => $this->unit,
            'categoryId' => $this->category_id,
            'categoryName' => optional($this->category)->name,
            'imageUrl' => $this->image_url,
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'ratingAverage' => $this->rating_avg ? round((float)$this->rating_avg, 2) : 0.0,
            'ratingCount' => (int) ($this->rating_count ?? 0),
            'ratingLastSubmittedAt' => $this->rating_last_submitted_at?->toIso8601String(),
            'rating' => [
                'average' => $this->rating_avg ? round((float)$this->rating_avg, 2) : 0.0,
                'count' => (int) ($this->rating_count ?? 0),
                'lastSubmittedAt' => $this->rating_last_submitted_at?->toIso8601String(),
            ],
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->map(fn ($tag) => [
                'id' => $tag->id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'description' => $tag->description,
            ])->all(), []),
            'tagSlugs' => $this->whenLoaded('tags', fn () => $this->tags->pluck('slug')->all(), []),
        ];
    }
}
