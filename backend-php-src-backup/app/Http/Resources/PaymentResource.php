<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'orderId' => $this->order_id,
            'userId' => $this->user_id,
            'amount' => (float)$this->amount,
            'currency' => $this->currency,
            'method' => $this->method,
            'channel' => $this->channel,
            'status' => $this->status,
            'provider' => $this->provider,
            'providerRef' => $this->provider_ref,
            'externalRequestId' => $this->external_request_id,
            'externalTransactionId' => $this->external_transaction_id,
            'phoneNumber' => $this->phone_number,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
