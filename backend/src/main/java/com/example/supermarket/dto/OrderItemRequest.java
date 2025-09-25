package com.example.supermarket.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Simple line-item for order creation */
public record OrderItemRequest(
        @NotNull Long productId,
        @Min(1) int quantity
) {}
