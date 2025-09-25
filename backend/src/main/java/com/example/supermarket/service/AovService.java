package com.example.supermarket.service;

import com.example.supermarket.domain.Order;
import com.example.supermarket.dto.AovPoint;
import com.example.supermarket.dto.AovSeriesResponse;
import com.example.supermarket.dto.AovSeriesResponse.Granularity;
import com.example.supermarket.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AovService {

    private final OrderRepository orderRepository;

    private static final List<Order.OrderStatus> EXCLUDED = List.of(
            Order.OrderStatus.CANCELLED,
            Order.OrderStatus.REFUNDED
    );

    public AovService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public AovSeriesResponse getAovSeries(Granularity granularity, int periods) {
        if (periods <= 0) periods = defaultPeriods(granularity);

    // Use system default offset (rather than forcing UTC) so daily bucketing aligns with how order timestamps are stored
    OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime alignedNow = alignToBucketStart(granularity, now);
        // Start of oldest bucket
        OffsetDateTime seriesStart = subtractUnits(alignedNow, granularity, periods - 1);

        // include one previous bucket for delta calculation
        OffsetDateTime queryStart = subtractUnits(seriesStart, granularity, 1);

        List<Object[]> rows = orderRepository.findForAovSince(queryStart, EXCLUDED);

        // Prepare arrays sized periods + 1 (extra previous bucket at index 0)
        int totalBuckets = periods + 1; // index 0 = previous bucket, 1..periods = series
        BigDecimal[] grossTotals = new BigDecimal[totalBuckets];
        int[] counts = new int[totalBuckets];
        Arrays.fill(grossTotals, BigDecimal.ZERO);

        for (Object[] row : rows) {
            OffsetDateTime ts = (OffsetDateTime) row[0];
            BigDecimal gross = (BigDecimal) row[1];
            OffsetDateTime bucketStart = alignToBucketStart(granularity, ts);
            // Distance must be computed from queryStart (oldest previous bucket) forward to the bucketStart.
            long bucketOffset = bucketDistance(granularity, queryStart, bucketStart);
            if (bucketOffset < 0 || bucketOffset >= totalBuckets) continue; // outside tracked range
            int idx = (int) bucketOffset;
            grossTotals[idx] = grossTotals[idx].add(gross);
            counts[idx]++;
        }

        List<AovPoint> series = new ArrayList<>(periods);
        for (int i = 1; i < totalBuckets; i++) { // skip index 0 (previous bucket)
            OffsetDateTime bucketStart = addUnits(granularity, queryStart, i);
            OffsetDateTime bucketEnd = addUnits(granularity, bucketStart, 1);
            BigDecimal gross = grossTotals[i];
            int count = counts[i];
            BigDecimal aov = count == 0 ? BigDecimal.ZERO : gross.divide(new BigDecimal(count), 2, RoundingMode.HALF_UP);
            series.add(new AovPoint(bucketStart, bucketEnd, count, gross, aov, null));
        }

        // Moving average (7 period simple) for DAILY
        if (granularity == Granularity.DAILY) {
            int window = 7;
            for (int i = 0; i < series.size(); i++) {
                int from = Math.max(0, i - window + 1);
                BigDecimal sum = BigDecimal.ZERO;
                int c = 0;
                for (int j = from; j <= i; j++) {
                    sum = sum.add(series.get(j).getAov());
                    c++;
                }
                series.get(i).setMovingAverage(sum.divide(new BigDecimal(c), 2, RoundingMode.HALF_UP));
            }
        }

        BigDecimal currentAov = series.isEmpty() ? BigDecimal.ZERO : series.get(series.size() - 1).getAov();
        // Previous bucket for display & delta is the immediately preceding series bucket (yesterday / last week / last month)
        BigDecimal previousAov = null;
        if (series.size() >= 2) {
            previousAov = series.get(series.size() - 2).getAov();
        }
        BigDecimal pctChange = null;
        boolean prevMissing = false;
        if (previousAov == null) {
            prevMissing = true; // not enough history
        } else if (previousAov.compareTo(BigDecimal.ZERO) != 0) {
            pctChange = currentAov.subtract(previousAov)
                    .divide(previousAov, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        return new AovSeriesResponse(granularity, series, currentAov, previousAov, pctChange, prevMissing);
    }

    private int defaultPeriods(Granularity g) {
        return switch (g) {
            case DAILY -> 30;
            case WEEKLY -> 12;
            case MONTHLY -> 12;
        };
    }

    private OffsetDateTime alignToBucketStart(Granularity g, OffsetDateTime ts) {
        return switch (g) {
            case DAILY -> ts.truncatedTo(ChronoUnit.DAYS);
            case WEEKLY -> ts.truncatedTo(ChronoUnit.DAYS).with(java.time.DayOfWeek.MONDAY);
            case MONTHLY -> ts.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
        };
    }

    private OffsetDateTime addUnits(Granularity g, OffsetDateTime base, int units) {
        return switch (g) {
            case DAILY -> base.plusDays(units);
            case WEEKLY -> base.plusWeeks(units);
            case MONTHLY -> base.plusMonths(units);
        };
    }

    private OffsetDateTime subtractUnits(OffsetDateTime base, Granularity g, int units) {
        return addUnits(g, base, -units);
    }

    private long bucketDistance(Granularity g, OffsetDateTime fromInclusive, OffsetDateTime toInclusive) {
        return switch (g) {
            case DAILY -> ChronoUnit.DAYS.between(fromInclusive, toInclusive);
            case WEEKLY -> ChronoUnit.WEEKS.between(fromInclusive, toInclusive);
            case MONTHLY -> ChronoUnit.MONTHS.between(fromInclusive, toInclusive);
        };
    }
}
