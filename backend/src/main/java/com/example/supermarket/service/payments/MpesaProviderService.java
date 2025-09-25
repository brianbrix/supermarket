package com.example.supermarket.service.payments;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.Payment;
import com.example.supermarket.dto.MobileMoneyInitiationRequest;
import com.example.supermarket.dto.MpesaStkCallback;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Base64;

/**
 *  M-Pesa integration (STK Push / PayBill / Till). Actual endpoints & security credentials must be configured.
 * This service currently stubs network calls and sets indicative fields; extend with real HTTP integration.
 */
@Service
public class MpesaProviderService implements PaymentProvider {

    @Value("${payments.mpesa.consumerKey:changeme}")
    private String consumerKey;
    @Value("${payments.mpesa.consumerSecret:changeme}")
    private String consumerSecret;
    @Value("${payments.mpesa.shortCode:000000}")
    private String shortCode;
    @Value("${payments.mpesa.passkey:passkey}")
    private String passkey;
    @Value("${payments.mpesa.callbackUrl:https://example.com/api/payments/mpesa/callback}")
    private String callbackUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public boolean supports(Payment.PaymentProvider provider, Payment.PaymentChannel channel) {
        return provider == Payment.PaymentProvider.MPESA;
    }

    @Override
    public Payment initiate(Order order, Payment payment, MobileMoneyInitiationRequest request) {
        // Build password for STK push if channel is STK
        if (request.channel() == Payment.PaymentChannel.MPESA_STK_PUSH ||
                (request.channel() == Payment.PaymentChannel.MPESA_PAYBILL && Boolean.TRUE.equals(request.supportsStk())) ||
                (request.channel() == Payment.PaymentChannel.MPESA_TILL && Boolean.TRUE.equals(request.supportsStk()))) {
            String timestamp = java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(java.time.LocalDateTime.now());
            String passwordRaw = shortCode + passkey + timestamp;
            String password = Base64.getEncoder().encodeToString(passwordRaw.getBytes(StandardCharsets.UTF_8));
            // In real integration: obtain OAuth token then POST to STK endpoint with payload including password & timestamp
            payment.setExternalRequestId("STK-REQ-" + System.currentTimeMillis());
            payment.setRawRequestPayload("{\"simulated\":true,\"password\":\""+password+"\",\"timestamp\":\""+timestamp+"\"}");
        } else {
            payment.setExternalRequestId("MPESA-GEN-" + System.currentTimeMillis());
        }
        payment.setProvider(Payment.PaymentProvider.MPESA);
        payment.setChannel(request.channel());
        payment.setPhoneNumber(request.phoneNumber());
        payment.setCurrency("KES");
        payment.setStatus(Payment.PaymentStatus.INITIATED);
        return payment; // persistence handled by caller
    }

    @Override
    public Payment handleCallback(String rawPayload) {
        try {
            MpesaStkCallback callback = mapper.readValue(rawPayload, MpesaStkCallback.class);
            // A real implementation would look up Payment by checkoutRequestID (externalRequestId) then update.
            // For now just create a transient Payment to demonstrate mapping.
            Payment p = new Payment();
            p.setExternalRequestId(callback.checkoutRequestID());
            p.setExternalTransactionId(extractReceipt(callback));
            p.setStatus(callback.resultCode() == 0 ? Payment.PaymentStatus.SUCCESS : Payment.PaymentStatus.FAILED);
            p.setRawCallbackPayload(rawPayload);
            return p;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid M-Pesa callback payload", e);
        }
    }

    private String extractReceipt(MpesaStkCallback cb) {
        if (cb.callbackMetadata() == null || cb.callbackMetadata().item() == null) return null;
        return cb.callbackMetadata().item().stream()
                .filter(i -> "MpesaReceiptNumber".equalsIgnoreCase(i.name()))
                .map(MpesaStkCallback.Item::value)
                .findFirst().orElse(null);
    }
}
