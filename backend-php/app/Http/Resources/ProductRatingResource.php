<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ProductRatingResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'productId' => $this->product_id,
            'userId' => $this->user_id,
            'orderItemId' => $this->order_item_id,
            'rating' => (int) $this->rating,
            'title' => $this->title,
            'comment' => $this->comment,
            'customerName' => $this->customer_name,
            'isVerified' => (bool) $this->is_verified,
            'isFlagged' => (bool) $this->is_flagged,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'user' => $this->whenLoaded('user', function () {
                return [
                    'id' => $this->user?->id,
                    'name' => $this->user?->name,
                    'email' => $this->user?->email,
                ];
            }),
        ];
    }
}
