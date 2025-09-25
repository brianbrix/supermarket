package com.example.supermarket.service;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.User;
import com.example.supermarket.dto.DashboardStatsResponse;
import com.example.supermarket.dto.AnalyticsOverviewResponse;
import com.example.supermarket.dto.OrderResponse;
import com.example.supermarket.repository.OrderRepository;
import com.example.supermarket.repository.ProductRepository;
import com.example.supermarket.repository.UserRepository;
import com.example.supermarket.mapper.OrderMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.util.ArrayList;

import java.util.List;

@Service
public class DashboardService {
    @Autowired private OrderRepository orderRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrderMapper orderMapper;

    private DashboardStatsResponse cachedStats;
    private Instant cachedStatsAt;
    private static final Duration STATS_TTL = Duration.ofSeconds(30);

    public synchronized DashboardStatsResponse getStats() {
        if (cachedStats != null && cachedStatsAt != null && Instant.now().isBefore(cachedStatsAt.plus(STATS_TTL))) {
            return cachedStats;
        }
        long totalOrders = orderRepository.count();
        var totalRevenue = orderRepository.sumTotalGross();
        long totalProducts = productRepository.count();
        long totalAdmins = userRepository.countByActiveTrueAndRoleNot(User.Role.CUSTOMER); // active non-customer users
    long pending = orderRepository.countByStatus(Order.OrderStatus.PENDING);
    long processing = orderRepository.countByStatus(Order.OrderStatus.PROCESSING);
    long shipped = orderRepository.countByStatus(Order.OrderStatus.SHIPPED);
    long delivered = orderRepository.countByStatus(Order.OrderStatus.DELIVERED);
    long cancelled = orderRepository.countByStatus(Order.OrderStatus.CANCELLED);
    long refunded = orderRepository.countByStatus(Order.OrderStatus.REFUNDED);
    cachedStats = new DashboardStatsResponse(
        totalOrders,
        totalRevenue,
        totalProducts,
        totalAdmins,
        pending,
        processing,
        shipped,
        delivered,
        cancelled,
        refunded
    );
        cachedStatsAt = Instant.now();
        return cachedStats;
    }

    public List<OrderResponse> getRecentOrders(int limit) {
        return orderRepository
                .findAll(PageRequest.of(0, Math.max(1, limit), Sort.by("createdAt").descending()))
                .getContent()
                .stream()
                .map(orderMapper::toResponse)
                .toList();
    }

    public AnalyticsOverviewResponse getAnalyticsOverview(int lowStockThreshold, int revenueDays) {
        var base = getStats();
        var lowStock = productRepository.findTop10ByStockLessThanEqualOrderByStockAsc(lowStockThreshold)
                .stream()
                .map(p -> new AnalyticsOverviewResponse.LowStockProduct(p.getId(), p.getName(), p.getStock()))
                .toList();

        var top = orderRepository.topSellingProducts().stream()
                .map(arr -> new AnalyticsOverviewResponse.TopProduct(
                        (Long) arr[0],
                        (String) arr[1],
                        ((Number) arr[2]).longValue()
                ))
                .toList();

        var cutoff = OffsetDateTime.now().minusDays(revenueDays);
        var revRaw = orderRepository.revenueTrendSince(cutoff);
        List<AnalyticsOverviewResponse.RevenuePoint> daily = new ArrayList<>();
        for (Object[] row : revRaw) {
            int y = ((Number) row[0]).intValue();
            int m = ((Number) row[1]).intValue();
            int d = ((Number) row[2]).intValue();
            var value = (java.math.BigDecimal) row[3];
            daily.add(new AnalyticsOverviewResponse.RevenuePoint(LocalDate.of(y, m, d), value));
        }

        // Weekly aggregation (week starts Monday)
        var weeklyMap = new java.util.LinkedHashMap<LocalDate, java.math.BigDecimal>();
        for (var p : daily) {
            LocalDate weekStart = p.day();
            while (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
                weekStart = weekStart.minusDays(1);
            }
            weeklyMap.merge(weekStart, p.revenue(), java.math.BigDecimal::add);
        }
        List<AnalyticsOverviewResponse.WeeklyRevenuePoint> weekly = weeklyMap.entrySet().stream()
                .map(e -> new AnalyticsOverviewResponse.WeeklyRevenuePoint(e.getKey(), e.getValue()))
                .toList();

        // Monthly aggregation
        var monthlyMap = new java.util.LinkedHashMap<String, java.math.BigDecimal>();
        for (var p : daily) {
            String key = p.day().getYear()+"-"+p.day().getMonthValue();
            monthlyMap.merge(key, p.revenue(), java.math.BigDecimal::add);
        }
        List<AnalyticsOverviewResponse.MonthlyRevenuePoint> monthly = new ArrayList<>();
        for (var e : monthlyMap.entrySet()) {
            String[] parts = e.getKey().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            monthly.add(new AnalyticsOverviewResponse.MonthlyRevenuePoint(year, month, e.getValue()));
        }

        // Percentage changes (last point vs previous point). If insufficient data -> null.
        Double dailyChange = calcPctChange(daily.stream().map(AnalyticsOverviewResponse.RevenuePoint::revenue).toList());
        Double weeklyChange = calcPctChange(weekly.stream().map(AnalyticsOverviewResponse.WeeklyRevenuePoint::revenue).toList());
        Double monthlyChange = calcPctChange(monthly.stream().map(AnalyticsOverviewResponse.MonthlyRevenuePoint::revenue).toList());

        return new AnalyticsOverviewResponse(base, lowStock, top, daily, weekly, monthly, dailyChange, weeklyChange, monthlyChange);
    }

    private Double calcPctChange(List<java.math.BigDecimal> values) {
        if (values.size() < 2) return null;
        var last = values.get(values.size()-1);
        var prev = values.get(values.size()-2);
        if (prev.compareTo(java.math.BigDecimal.ZERO) == 0) return null;
        return last.subtract(prev)
                .divide(prev, java.math.MathContext.DECIMAL64)
                .multiply(new java.math.BigDecimal("100"))
                .doubleValue();
    }
}
