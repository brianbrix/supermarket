package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.util.List;

public class AovSeriesResponse {
    public enum Granularity { DAILY, WEEKLY, MONTHLY }

    private Granularity granularity;
    private List<AovPoint> series;
    private BigDecimal currentAov;
    private BigDecimal previousAov;
    private BigDecimal percentChange; // null if not computable
    private boolean previousMissing;

    public AovSeriesResponse() {}

    public AovSeriesResponse(Granularity granularity, List<AovPoint> series, BigDecimal currentAov, BigDecimal previousAov, BigDecimal percentChange, boolean previousMissing) {
        this.granularity = granularity;
        this.series = series;
        this.currentAov = currentAov;
        this.previousAov = previousAov;
        this.percentChange = percentChange;
        this.previousMissing = previousMissing;
    }

    public Granularity getGranularity() {
        return granularity;
    }

    public List<AovPoint> getSeries() {
        return series;
    }

    public BigDecimal getCurrentAov() {
        return currentAov;
    }

    public BigDecimal getPreviousAov() {
        return previousAov;
    }

    public BigDecimal getPercentChange() {
        return percentChange;
    }

    public boolean isPreviousMissing() {
        return previousMissing;
    }

    public void setGranularity(Granularity granularity) { this.granularity = granularity; }
    public void setSeries(List<AovPoint> series) { this.series = series; }
    public void setCurrentAov(BigDecimal currentAov) { this.currentAov = currentAov; }
    public void setPreviousAov(BigDecimal previousAov) { this.previousAov = previousAov; }
    public void setPercentChange(BigDecimal percentChange) { this.percentChange = percentChange; }
    public void setPreviousMissing(boolean previousMissing) { this.previousMissing = previousMissing; }
}
