package com.example.supermarket.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * Manual (non-STK) mobile money initiation referencing a configured PaymentOption.
 * Creates a Payment row in INITIATED state without contacting external provider (user pays manually).
 */
public record ManualPaymentInitiationRequest(
        @NotNull Long orderId,
        @NotNull Long paymentOptionId,
        @Positive BigDecimal amount, // optional override; defaults to order total if null/invalid
        @Pattern(regexp = "^[0-9+]{6,15}$", message = "Invalid phone number") String phoneNumber,
        String accountReference,
        String narration
) {}
