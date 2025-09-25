package com.example.supermarket.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

// Create order request separated for clarity; guest checkout allowed

public record CreateOrderRequest(
        @NotBlank String customerName,
        @NotBlank String customerPhone,
        @NotEmpty List<com.example.supermarket.dto.OrderItemRequest> items
) {}
