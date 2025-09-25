package com.example.supermarket.dto;

import com.example.supermarket.domain.Payment;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * Request to initiate a mobile money payment (e.g. M-Pesa STK Push, PayBill, Till, Airtel push).
 * orderId is used to bind the payment; amount can be overridden (e.g. partial payment) but defaults to order total.
 */
public record MobileMoneyInitiationRequest(
        @NotNull Long orderId,
        @NotNull Payment.PaymentProvider provider,
        @NotNull Payment.PaymentChannel channel,
        @NotNull Payment.PaymentMethod method,
        @NotNull @Positive BigDecimal amount,
        @NotNull @Pattern(regexp = "^[0-9+]{6,15}$", message = "Invalid phone number") String phoneNumber,
        String accountReference, // For PayBill / Till (e.g. order number or customer ref)
        String narration, // Statement / description line
        Boolean supportsStk // optional hint: treat as STK if provider+channel combination can automate
) {}
