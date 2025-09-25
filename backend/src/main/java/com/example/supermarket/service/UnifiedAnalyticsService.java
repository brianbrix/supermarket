package com.example.supermarket.service;

import com.example.supermarket.domain.Order;
import com.example.supermarket.dto.UnifiedAnalyticsResponse;
import com.example.supermarket.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class UnifiedAnalyticsService {
    private final OrderRepository orderRepository;
    public UnifiedAnalyticsService(OrderRepository orderRepository) { this.orderRepository = orderRepository; }

    public UnifiedAnalyticsResponse getUnified(OffsetDateTime from,
                                               OffsetDateTime to,
                                               String granularity,
                                               List<Order.OrderStatus> statuses,
                                               boolean includeRefunded,
                                               boolean includeCancelled) {
        if (from == null || to == null) { to = OffsetDateTime.now(); from = to.minusDays(30); }
        if (from.isAfter(to)) { var tmp = from; from = to; to = tmp; }
        Gran g = Gran.from(granularity);

        EnumSet<Order.OrderStatus> allowed = statuses == null || statuses.isEmpty() ?
                EnumSet.of(Order.OrderStatus.PENDING, Order.OrderStatus.PROCESSING, Order.OrderStatus.SHIPPED, Order.OrderStatus.DELIVERED) : EnumSet.copyOf(statuses);
        if (includeRefunded) allowed.add(Order.OrderStatus.REFUNDED);
        if (includeCancelled) allowed.add(Order.OrderStatus.CANCELLED);

        List<Order> all = orderRepository.findAll(); // TODO optimize with filtered query
        List<Order> filtered = new ArrayList<>();
        for (Order o : all) {
            if (o.getCreatedAt() == null) continue;
            if (o.getCreatedAt().isBefore(from) || o.getCreatedAt().isAfter(to)) continue;
            if (!allowed.contains(o.getStatus())) continue;
            filtered.add(o);
        }

        Map<OffsetDateTime, BucketAcc> map = new TreeMap<>();
        OffsetDateTime cursor = g.alignStart(from);
        while (!cursor.isAfter(to)) { map.put(cursor, new BucketAcc(cursor, g.add(cursor,1))); cursor = g.add(cursor,1); }

        long totalOrders = 0; BigDecimal totalGross = BigDecimal.ZERO;
        for (Order o : filtered) {
            OffsetDateTime start = g.alignStart(o.getCreatedAt());
            BucketAcc acc = map.get(start); if (acc==null) continue;
            acc.orderCount++;
            BigDecimal gross = o.getTotalGross()==null?BigDecimal.ZERO:o.getTotalGross();
            acc.gross = acc.gross.add(gross);
            totalOrders++; totalGross = totalGross.add(gross);
        }

        List<UnifiedAnalyticsResponse.Bucket> buckets = new ArrayList<>();
        for (BucketAcc acc : map.values()) {
            BigDecimal aov = acc.orderCount==0?BigDecimal.ZERO: acc.gross.divide(new BigDecimal(acc.orderCount),2, RoundingMode.HALF_UP);
            buckets.add(new UnifiedAnalyticsResponse.Bucket(acc.start, acc.end, acc.orderCount, acc.gross, aov));
        }
        BigDecimal overallAov = totalOrders==0?BigDecimal.ZERO: totalGross.divide(new BigDecimal(totalOrders),2,RoundingMode.HALF_UP);
        return new UnifiedAnalyticsResponse(from, to, g.name(), buckets,
                new UnifiedAnalyticsResponse.Aggregates(totalOrders, totalGross, overallAov),
                allowed.stream().map(Enum::name).toList(), includeRefunded, includeCancelled);
    }

    private static class BucketAcc { OffsetDateTime start; OffsetDateTime end; long orderCount=0; BigDecimal gross=BigDecimal.ZERO; BucketAcc(OffsetDateTime s, OffsetDateTime e){start=s;end=e;} }
    private enum Gran { DAILY, WEEKLY, MONTHLY; OffsetDateTime alignStart(OffsetDateTime ts){return switch (this){case DAILY->ts.truncatedTo(ChronoUnit.DAYS);case WEEKLY->ts.truncatedTo(ChronoUnit.DAYS).with(java.time.DayOfWeek.MONDAY);case MONTHLY->ts.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);};} OffsetDateTime add(OffsetDateTime b,int u){return switch(this){case DAILY->b.plusDays(u);case WEEKLY->b.plusWeeks(u);case MONTHLY->b.plusMonths(u);};} static Gran from(String g){if(g==null)return DAILY;try{return Gran.valueOf(g.toUpperCase());}catch(IllegalArgumentException e){return DAILY;}} }
}
