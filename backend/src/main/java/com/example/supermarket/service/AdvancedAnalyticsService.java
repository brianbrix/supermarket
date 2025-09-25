package com.example.supermarket.service;

import com.example.supermarket.domain.Order;
import com.example.supermarket.dto.AdvancedAnalyticsResponse;
import com.example.supermarket.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class AdvancedAnalyticsService {

    private final OrderRepository orderRepository;
    public AdvancedAnalyticsService(OrderRepository orderRepository) { this.orderRepository = orderRepository; }

    public AdvancedAnalyticsResponse compute(OffsetDateTime from, OffsetDateTime to) {
        if (from == null || to == null) {
            to = OffsetDateTime.now();
            from = to.minusDays(30);
        }
        if (from.isAfter(to)) { var tmp=from; from=to; to=tmp; }

        // Previous window (same length immediately preceding)
        long days = Math.max(1, java.time.Duration.between(from, to).toDays());
        OffsetDateTime prevTo = from.minusSeconds(1);
        OffsetDateTime prevFrom = prevTo.minusDays(days).plusDays(1); // align length

        List<Order> all = orderRepository.findAll(); // TODO optimize with filtered queries
        List<Order> periodOrders = new ArrayList<>();
        List<Order> prevOrders = new ArrayList<>();
        for (Order o : all) {
            OffsetDateTime c = o.getCreatedAt();
            if (c == null) continue;
            if (!c.isBefore(from) && !c.isAfter(to)) periodOrders.add(o);
            else if (!c.isBefore(prevFrom) && !c.isAfter(prevTo)) prevOrders.add(o);
        }

        // Customer identity: prefer user.id; fallback to phone; last fallback to name+phone composite.
        java.util.function.Function<Order,String> customerKeyFn = o -> {
            if (o.getUser() != null && o.getUser().getId() != null) return "U:" + o.getUser().getId();
            if (o.getCustomerPhone() != null && !o.getCustomerPhone().isBlank()) return "P:" + o.getCustomerPhone();
            if (o.getCustomerName() != null) return "N:" + o.getCustomerName();
            return "UNKNOWN";
        };

        Map<String, Integer> ordersPerCustomer = new HashMap<>();
        long ordersFromRepeat = 0;
        for (Order o : periodOrders) {
            String k = customerKeyFn.apply(o);
            int n = ordersPerCustomer.getOrDefault(k,0)+1;
            ordersPerCustomer.put(k,n);
        }
        long repeatCustomers = ordersPerCustomer.values().stream().filter(v->v>=2).count();
        long totalCustomers = ordersPerCustomer.size();
        long firstTime = totalCustomers - repeatCustomers;
        long totalOrders = periodOrders.size();
        for (var e : ordersPerCustomer.entrySet()) if (e.getValue() >= 2) ordersFromRepeat += e.getValue();

        BigDecimal repeatRate = pct(repeatCustomers, totalCustomers);
        BigDecimal ordersFromRepeatPct = pct(ordersFromRepeat, totalOrders);

        // Retention: customers in previous window who also appear in current
        Set<String> prevCustomers = new HashSet<>();
        for (Order o : prevOrders) prevCustomers.add(customerKeyFn.apply(o));
        long previousWindowCustomers = prevCustomers.size();
        long retained = 0;
        if (previousWindowCustomers > 0) {
            for (String pk : prevCustomers) if (ordersPerCustomer.containsKey(pk)) retained++;
        }
        long churned = previousWindowCustomers - retained;
        BigDecimal retentionRate = pct(retained, previousWindowCustomers);
        BigDecimal churnRate = pct(churned, previousWindowCustomers);

        // Funnel counts (created in current period) by status
        long pending=0, processing=0, shipped=0, delivered=0, cancelled=0, refunded=0;
        for (Order o : periodOrders) {
            switch (o.getStatus()) {
                case PENDING -> pending++;
                case PROCESSING -> processing++;
                case SHIPPED -> shipped++;
                case DELIVERED -> delivered++;
                case CANCELLED -> cancelled++;
                case REFUNDED -> refunded++;
            }
        }
        BigDecimal convP2Proc = pct(processing, pending);
        BigDecimal convProc2Ship = pct(shipped, processing);
        BigDecimal convShip2Del = pct(delivered, shipped);
        BigDecimal overallConv = pct(delivered, pending);
        BigDecimal cancellationRate = pct(cancelled, pending);
        BigDecimal refundRate = pct(refunded, delivered);

        var customerMetrics = new AdvancedAnalyticsResponse.CustomerMetrics(
                totalCustomers, repeatCustomers, firstTime, repeatRate, ordersFromRepeatPct, totalOrders, ordersFromRepeat
        );
        var retentionMetrics = new AdvancedAnalyticsResponse.RetentionMetrics(
                prevFrom, prevTo, previousWindowCustomers, retained, churned, retentionRate, churnRate
        );
        var funnelMetrics = new AdvancedAnalyticsResponse.FunnelMetrics(
                pending, processing, shipped, delivered, cancelled, refunded, convP2Proc, convProc2Ship, convShip2Del, overallConv, cancellationRate, refundRate
        );
        return new AdvancedAnalyticsResponse(from, to, customerMetrics, retentionMetrics, funnelMetrics);
    }

    private BigDecimal pct(long part, long whole) {
        if (whole <= 0) return BigDecimal.ZERO;
        return new BigDecimal(part).multiply(BigDecimal.valueOf(100)).divide(new BigDecimal(whole), 2, RoundingMode.HALF_UP);
    }
}
