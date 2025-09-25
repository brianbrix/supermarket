package com.example.supermarket.mapper;

import com.example.supermarket.domain.Payment;
import com.example.supermarket.dto.PaymentResponse;
import org.springframework.stereotype.Component;

@Component
public class PaymentMapper {
    public PaymentResponse toResponse(Payment payment) {
        if (payment == null) return null;
        Long userId = payment.getUser() != null ? payment.getUser().getId() : null;
    return new PaymentResponse(
        payment.getId(),
        payment.getOrder().getId(),
        userId,
        payment.getAmount(),
        payment.getStatus().name(),
        payment.getMethod() != null ? payment.getMethod().name() : null,
        payment.getProvider() != null ? payment.getProvider().name() : null,
        payment.getChannel() != null ? payment.getChannel().name() : null,
        payment.getCurrency(),
        payment.getPhoneNumber(),
        payment.getProviderRef(),
        payment.getExternalRequestId(),
        payment.getExternalTransactionId(),
        payment.getCreatedAt(),
        payment.getUpdatedAt()
    );
    }
}