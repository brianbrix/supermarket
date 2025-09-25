package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaymentResponse(
        Long id,
        Long orderId,
        Long userId,
        BigDecimal amount,
        String status,
        String method,
        String provider,
        String channel,
        String currency,
        String phoneNumber,
        String providerRef,
        String externalRequestId,
        String externalTransactionId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
