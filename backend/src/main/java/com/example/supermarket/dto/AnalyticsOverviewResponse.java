package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AnalyticsOverviewResponse(
        DashboardStatsResponse base,
        List<LowStockProduct> lowStock,
        List<TopProduct> topSelling,
        List<RevenuePoint> revenueTrendDaily,
        List<WeeklyRevenuePoint> revenueTrendWeekly,
        List<MonthlyRevenuePoint> revenueTrendMonthly,
        Double dailyChangePct,
        Double weeklyChangePct,
        Double monthlyChangePct
) {
    public record LowStockProduct(Long id, String name, Integer stock) {}
    public record TopProduct(Long id, String name, Long quantity) {}
    public record RevenuePoint(LocalDate day, BigDecimal revenue) {}
    public record WeeklyRevenuePoint(LocalDate weekStart, BigDecimal revenue) {}
    public record MonthlyRevenuePoint(int year, int month, BigDecimal revenue) {}
}
