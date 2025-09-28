<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class UserAdminResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'email' => $this->email,
            'firstName' => $this->first_name,
            'lastName' => $this->last_name,
            'role' => $this->role?->value ?? $this->role,
            'active' => (bool)$this->active,
            'ordersCount' => $this->orders_count ?? ($this->relationLoaded('orders') ? $this->orders->count() : null),
            'lastLogin' => $this->last_login?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
