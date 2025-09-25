package com.example.supermarket.service.payments;

import com.example.supermarket.domain.Payment;
import com.example.supermarket.dto.MobileMoneyInitiationRequest;
import com.example.supermarket.domain.Order;

/**
 * Abstraction for external payment providers (Mpesa, Airtel).
 */
public interface PaymentProvider {
    boolean supports(Payment.PaymentProvider provider, Payment.PaymentChannel channel);

    /**
     * Initiates a payment with the remote provider returning the (possibly enriched) Payment entity.
     */
    Payment initiate(Order order, Payment payment, MobileMoneyInitiationRequest request);

    /**
     * Handle asynchronous callback updating payment; rawPayload retained for auditing.
     */
    Payment handleCallback(String rawPayload);
}
