package com.example.supermarket.dto;

public record PaymentOptionResponse(
        Long id,
        String provider,
        String channel,
        String displayName,
        String shortDescription,
        String instructionsMarkdown,
        boolean supportsStk,
        String paybillNumber,
        String tillNumber,
        String recipientPhone,
        String accountReferenceTemplate,
        boolean active,
        Integer sortOrder
) {}
