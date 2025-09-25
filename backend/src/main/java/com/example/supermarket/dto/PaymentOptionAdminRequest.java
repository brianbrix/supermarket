package com.example.supermarket.dto;

import com.example.supermarket.domain.Payment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PaymentOptionAdminRequest(
        @NotNull Payment.PaymentProvider provider,
        @NotNull Payment.PaymentChannel channel,
        @NotBlank String displayName,
        String shortDescription,
        String instructionsMarkdown,
        String paybillNumber,
        String tillNumber,
        String businessShortCode,
        String recipientPhone,
        String accountReferenceTemplate,
        boolean supportsStk,
        boolean active,
        Integer sortOrder,
        String metadataJson
) {}
