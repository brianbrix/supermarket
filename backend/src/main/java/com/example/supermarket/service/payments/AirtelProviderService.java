package com.example.supermarket.service.payments;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.Payment;
import com.example.supermarket.dto.MobileMoneyInitiationRequest;
import com.example.supermarket.dto.AirtelCallback;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Airtel Money integration. Provides token acquisition caching and basic initiate stub.
 * Real endpoints & response handling must be implemented with Airtel's documented API payloads.
 */
@Service
public class AirtelProviderService implements PaymentProvider {

    @Value("${payments.airtel.clientId:changeme}")
    private String clientId;
    @Value("${payments.airtel.clientSecret:changeme}")
    private String clientSecret;
    @Value("${payments.airtel.baseUrl:https://openapi.airtel.africa}")
    private String baseUrl;
    @Value("${payments.airtel.callbackUrl:https://example.com/api/payments/airtel/callback}")
    private String callbackUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    private final AtomicReference<String> cachedToken = new AtomicReference<>();
    private volatile long tokenExpiryEpoch = 0L; // epoch seconds

    @Override
    public boolean supports(Payment.PaymentProvider provider, Payment.PaymentChannel channel) {
        return provider == Payment.PaymentProvider.AIRTEL;
    }

    @Override
    public Payment initiate(Order order, Payment payment, MobileMoneyInitiationRequest request) {
        ensureToken();
        // Build a minimal simulated initiation; real API call would POST to /merchant/v1/payments
        boolean isStkLike = request.channel() == Payment.PaymentChannel.AIRTEL_STK_PUSH ||
                (request.channel() == Payment.PaymentChannel.AIRTEL_COLLECTION && Boolean.TRUE.equals(request.supportsStk()));
        payment.setExternalRequestId((isStkLike ? "STK-" : "AIRTEL-") + "REQ-" + System.currentTimeMillis());
        payment.setRawRequestPayload("{\"simulated\":true,\"stk\":"+isStkLike+",\"amount\":" + payment.getAmount() + "}");
        payment.setStatus(Payment.PaymentStatus.INITIATED);
        return payment;
    }

    @Override
    public Payment handleCallback(String rawPayload) {
        try {
            AirtelCallback callback = mapper.readValue(rawPayload, AirtelCallback.class);
            Payment p = new Payment();
            // externalRequestId may be echoed back as originalRequestId
            p.setExternalRequestId(callback.originalRequestId());
            p.setExternalTransactionId(callback.transactionId());
            boolean success = callback.statusCode() != null && ("SUCCESS".equalsIgnoreCase(callback.statusCode()) || "000".equals(callback.statusCode()));
            p.setStatus(success ? Payment.PaymentStatus.SUCCESS : Payment.PaymentStatus.FAILED);
            p.setRawCallbackPayload(rawPayload);
            p.setProvider(Payment.PaymentProvider.AIRTEL);
            if (callback.msisdn() != null) {
                p.setPhoneNumber(callback.msisdn());
            }
            return p;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid Airtel callback payload", e);
        }
    }

    private synchronized void ensureToken() {
        long now = Instant.now().getEpochSecond();
        if (cachedToken.get() != null && now < tokenExpiryEpoch - 30) { // 30s early refresh window
            return;
        }
        // Simulated token generation (Base64 client credentials). Replace with real OAuth call.
        String simulated = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes());
        cachedToken.set("SIM-TOKEN-" + simulated);
        tokenExpiryEpoch = now + 300; // 5 minute simulated TTL
    }
}
