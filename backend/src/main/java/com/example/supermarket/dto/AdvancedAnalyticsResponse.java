package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record AdvancedAnalyticsResponse(
        OffsetDateTime from,
        OffsetDateTime to,
        CustomerMetrics customers,
        RetentionMetrics retention,
        FunnelMetrics funnel
) {
    public record CustomerMetrics(
            long totalCustomers,
            long repeatCustomers,
            long firstTimeCustomers,
            BigDecimal repeatRatePct,
            BigDecimal ordersFromRepeatPct,
            long totalOrders,
            long ordersFromRepeat
    ){}
    public record RetentionMetrics(
            OffsetDateTime previousFrom,
            OffsetDateTime previousTo,
            long previousWindowCustomers,
            long retainedCustomers,
            long churnedCustomers,
            BigDecimal retentionRatePct,
            BigDecimal churnRatePct
    ){}
    public record FunnelMetrics(
            long pending,
            long processing,
            long shipped,
            long delivered,
            long cancelled,
            long refunded,
            BigDecimal convPendingToProcessing,
            BigDecimal convProcessingToShipped,
            BigDecimal convShippedToDelivered,
            BigDecimal overallConversionToDelivered,
            BigDecimal cancellationRatePct,
            BigDecimal refundRatePct
    ){}
}
