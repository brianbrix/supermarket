package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record UnifiedAnalyticsResponse(
        OffsetDateTime from,
        OffsetDateTime to,
        String granularity,
        List<Bucket> buckets,
        Aggregates aggregates,
        List<String> includedStatuses,
        boolean includeRefunded,
        boolean includeCancelled
) {
    public record Bucket(
            OffsetDateTime start,
            OffsetDateTime end,
            long orderCount,
            BigDecimal gross,
            BigDecimal aov
    ) {}

    public record Aggregates(
            long totalOrders,
            BigDecimal totalGross,
            BigDecimal overallAov
    ) {}
}
