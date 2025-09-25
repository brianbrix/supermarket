package com.example.supermarket.service.payments;

import com.example.supermarket.domain.Payment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PaymentProviderRegistry {

    private final List<PaymentProvider> providers;

    public PaymentProviderRegistry(List<PaymentProvider> providers) {
        this.providers = providers;
    }

    public PaymentProvider resolve(Payment.PaymentProvider provider, Payment.PaymentChannel channel) {
        return providers.stream()
                .filter(p -> p.supports(provider, channel))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No payment provider implementation for " + provider + " / " + channel));
    }
}
