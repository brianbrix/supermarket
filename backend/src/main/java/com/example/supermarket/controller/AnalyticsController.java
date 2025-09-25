package com.example.supermarket.controller;

import com.example.supermarket.dto.AovSeriesResponse;
import com.example.supermarket.dto.AovSeriesResponse.Granularity;
import com.example.supermarket.service.AovService;
import com.example.supermarket.service.UnifiedAnalyticsService;
import com.example.supermarket.service.AdvancedAnalyticsService;
import com.example.supermarket.dto.AdvancedAnalyticsResponse;
import com.example.supermarket.domain.Order;
import com.example.supermarket.dto.UnifiedAnalyticsResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/analytics")
public class AnalyticsController {

    private final AovService aovService;
    private final UnifiedAnalyticsService unifiedAnalyticsService;
    private final AdvancedAnalyticsService advancedAnalyticsService;

    public AnalyticsController(AovService aovService, UnifiedAnalyticsService unifiedAnalyticsService, AdvancedAnalyticsService advancedAnalyticsService) {
        this.aovService = aovService;
        this.unifiedAnalyticsService = unifiedAnalyticsService;
        this.advancedAnalyticsService = advancedAnalyticsService;
    }

    @GetMapping("/aov")
    public ResponseEntity<AovSeriesResponse> getAov(
            @RequestParam(name = "granularity", defaultValue = "DAILY") Granularity granularity,
            @RequestParam(name = "periods", required = false) Integer periods
    ) {
        int p = periods == null ? 0 : periods;
        return ResponseEntity.ok(aovService.getAovSeries(granularity, p));
    }

    @GetMapping("/unified")
    public ResponseEntity<UnifiedAnalyticsResponse> unified(
            @RequestParam(name = "from", required = false) java.time.OffsetDateTime from,
            @RequestParam(name = "to", required = false) java.time.OffsetDateTime to,
            @RequestParam(name = "granularity", defaultValue = "DAILY") String granularity,
            @RequestParam(name = "statuses", required = false) java.util.List<Order.OrderStatus> statuses,
            @RequestParam(name = "includeRefunded", defaultValue = "false") boolean includeRefunded,
            @RequestParam(name = "includeCancelled", defaultValue = "false") boolean includeCancelled
    ) {
        return ResponseEntity.ok(unifiedAnalyticsService.getUnified(from, to, granularity, statuses, includeRefunded, includeCancelled));
    }

    @GetMapping("/advanced")
    public ResponseEntity<AdvancedAnalyticsResponse> advanced(
            @RequestParam(name = "from", required = false) java.time.OffsetDateTime from,
            @RequestParam(name = "to", required = false) java.time.OffsetDateTime to
    ) {
        return ResponseEntity.ok(advancedAnalyticsService.compute(from, to));
    }
}
