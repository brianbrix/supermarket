package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record OrderResponse(
        Long id,
        OffsetDateTime createdAt,
        String customerName,
        String customerPhone,
        List<OrderItemEntry> items,
        BigDecimal totalGross,
        BigDecimal totalNet,
        BigDecimal vatAmount,
        String thumbnailUrl,
        String status,
        Long userId,
        String paymentStatus,
        String paymentMethod
) {
    public record OrderItemEntry(
            Long productId,
            String productName,
            int quantity,
            BigDecimal unitPriceGross,
            BigDecimal unitPriceNet,
            BigDecimal vatAmount
    ) {}
}
