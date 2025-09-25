package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class AovPoint {
    private OffsetDateTime start; // inclusive start of bucket
    private OffsetDateTime end;   // exclusive end (or same for daily)
    private int orderCount;
    private BigDecimal grossTotal;
    private BigDecimal aov; // grossTotal / orderCount (or 0 when count=0)
    private BigDecimal movingAverage; // optional (null when not applicable)

    public AovPoint() {}

    public AovPoint(OffsetDateTime start, OffsetDateTime end, int orderCount, BigDecimal grossTotal, BigDecimal aov, BigDecimal movingAverage) {
        this.start = start;
        this.end = end;
        this.orderCount = orderCount;
        this.grossTotal = grossTotal;
        this.aov = aov;
        this.movingAverage = movingAverage;
    }

    // New canonical getters
    public OffsetDateTime getStart() { return start; }
    public OffsetDateTime getEnd() { return end; }

    // Backward-compatible legacy-style getters (if any code already used them)
    public OffsetDateTime getBucketStart() { return start; }
    public OffsetDateTime getBucketEnd() { return end; }

    public int getOrderCount() { return orderCount; }
    public BigDecimal getGrossTotal() { return grossTotal; }
    public BigDecimal getAov() { return aov; }
    public BigDecimal getMovingAverage() { return movingAverage; }

    public void setStart(OffsetDateTime start) { this.start = start; }
    public void setEnd(OffsetDateTime end) { this.end = end; }
    public void setBucketStart(OffsetDateTime start) { this.start = start; }
    public void setBucketEnd(OffsetDateTime end) { this.end = end; }
    public void setOrderCount(int orderCount) { this.orderCount = orderCount; }
    public void setGrossTotal(BigDecimal grossTotal) { this.grossTotal = grossTotal; }
    public void setAov(BigDecimal aov) { this.aov = aov; }
    public void setMovingAverage(BigDecimal movingAverage) { this.movingAverage = movingAverage; }
}
