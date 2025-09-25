package com.example.supermarket.controller;

import com.example.supermarket.domain.User;
import com.example.supermarket.domain.Payment;
import com.example.supermarket.dto.PaymentRequest;
import com.example.supermarket.dto.MobileMoneyInitiationRequest;
import com.example.supermarket.dto.PaymentResponse;
import com.example.supermarket.dto.ManualPaymentInitiationRequest;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.dto.ManualReconciliationRequest;
import com.example.supermarket.service.PaymentService;
import com.example.supermarket.dto.MpesaStkCallback;
import com.example.supermarket.service.UserService;
import com.example.supermarket.dto.AirtelCallback;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;


@RestController
@CrossOrigin(origins = "*")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private UserService userService;

    @PostMapping("/api/payments")
    public ResponseEntity<PaymentResponse> create(@Valid @RequestBody PaymentRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = null;
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            user = userService.getByUsername(auth.getName()).orElse(null);
        }
        return ResponseEntity.ok(paymentService.createOrFetch(request, user));
    }

    @PostMapping("/api/payments/mobile-money/initiate")
    public ResponseEntity<PaymentResponse> initiateMobileMoney(@Valid @RequestBody MobileMoneyInitiationRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = null;
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            user = userService.getByUsername(auth.getName()).orElse(null);
        }
        return ResponseEntity.ok(paymentService.initiateMobileMoney(request, user));
    }

    @PostMapping("/api/payments/manual/initiate")
    public ResponseEntity<PaymentResponse> initiateManual(@Valid @RequestBody ManualPaymentInitiationRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = null;
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            user = userService.getByUsername(auth.getName()).orElse(null);
        }
        return ResponseEntity.ok(paymentService.initiateManual(request, user));
    }

    @PostMapping("/api/payments/manual/reconcile")
    public ResponseEntity<PaymentResponse> reconcile(@Valid @RequestBody ManualReconciliationRequest request) {
        return ResponseEntity.ok(paymentService.reconcileManual(request));
    }


    @GetMapping("/api/payments/order/{orderId}")
    public ResponseEntity<PaymentResponse> byOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(paymentService.getByOrder(orderId));
    }

    @GetMapping("/api/admin/payments")
    public ResponseEntity<PageResponse<PaymentResponse>> allAdmin(@RequestParam(name = "q", required = false) String q,
                                                                  @RequestParam(name = "status", required = false) Payment.PaymentStatus status,
                                                                  @RequestParam(name = "method", required = false) Payment.PaymentMethod method,
                                                                  @RequestParam(name = "from", required = false) java.time.OffsetDateTime from,
                                                                  @RequestParam(name = "to", required = false) java.time.OffsetDateTime to,
                                                                  @RequestParam(name = "minAmount", required = false) java.math.BigDecimal minAmount,
                                                                  @RequestParam(name = "maxAmount", required = false) java.math.BigDecimal maxAmount,
                                                                  @RequestParam(name = "page", defaultValue = "0") int page,
                                                                  @RequestParam(name = "size", defaultValue = "10") int size,
                                                                  @RequestParam(name = "sort", required = false) String sort,
                                                                  @RequestParam(name = "direction", required = false) String direction) {
        if (from != null && to != null && from.isAfter(to)) {
            return ResponseEntity.badRequest().build();
        }
        if (minAmount != null && maxAmount != null && minAmount.compareTo(maxAmount) > 0) {
            return ResponseEntity.badRequest().build();
        }
        PageResponse<PaymentResponse> resp;
        if (q != null || status != null || method != null || from != null || to != null || minAmount != null || maxAmount != null) {
            resp = paymentService.searchPaged(q, status, method, from, to, minAmount, maxAmount, page, size, sort, direction);
        } else {
            resp = paymentService.getAllPaged(page, size, sort, direction);
        }
        return ResponseEntity.ok(resp);
    }

    // M-Pesa STK callback endpoint (publicly accessible by Safaricom IPs) - no auth required
    @PostMapping("/api/payments/mpesa/callback")
    public ResponseEntity<Void> mpesaCallback(@RequestBody String rawJson) {
        try {
            // Parse a lightweight DTO for extraction; we want both raw and structured
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            MpesaStkCallback cb = mapper.readValue(rawJson, MpesaStkCallback.class);
            paymentService.handleMpesaCallback(cb, rawJson);
        } catch (Exception e) {
            // swallow parse errors (could log) to avoid repeated retries; or return 400 to surface issue
        }
        return ResponseEntity.ok().build();
    }

    // Airtel Money callback endpoint - publicly accessible (restrict via IP allowlist / signature in production)
    @PostMapping("/api/payments/airtel/callback")
    public ResponseEntity<Void> airtelCallback(@RequestBody String rawJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            AirtelCallback cb = mapper.readValue(rawJson, AirtelCallback.class);
            paymentService.handleAirtelCallback(cb, rawJson);
        } catch (Exception e) {
            // swallow parsing issues silently (optionally log)
        }
        return ResponseEntity.ok().build();
    }
}
