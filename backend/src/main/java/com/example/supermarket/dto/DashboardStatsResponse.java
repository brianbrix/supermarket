package com.example.supermarket.dto;

import java.math.BigDecimal;

public record DashboardStatsResponse(
        long totalOrders,
        BigDecimal totalRevenue,
        long totalProducts,
        long totalAdmins,
        long pendingOrders,
        long processingOrders,
        long shippedOrders,
        long deliveredOrders,
        long cancelledOrders,
        long refundedOrders
) {}
