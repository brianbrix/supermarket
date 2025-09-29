<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HomepageLayoutResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $publishedBy = $this->whenLoaded('publishedBy');

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'status' => $this->status,
            'version' => $this->version,
            'isActive' => (bool) $this->is_active,
            'layout' => $this->layout ?? [],
            'meta' => $this->meta ?? [],
            'publishedAt' => $this->published_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'publishedBy' => $publishedBy ? [
                'id' => $publishedBy->id,
                'name' => $publishedBy->name,
                'email' => $publishedBy->email,
            ] : null,
        ];
    }
}
