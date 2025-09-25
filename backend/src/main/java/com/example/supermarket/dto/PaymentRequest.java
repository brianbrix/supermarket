package com.example.supermarket.dto;

import com.example.supermarket.domain.Payment;
import jakarta.validation.constraints.NotNull;

public record PaymentRequest(
        @NotNull Long orderId,
        @NotNull Payment.PaymentMethod method,
        Payment.PaymentProvider provider,
        Payment.PaymentChannel channel
) {}
