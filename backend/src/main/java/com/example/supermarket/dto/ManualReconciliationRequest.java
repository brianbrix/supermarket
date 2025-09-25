package com.example.supermarket.dto;

import com.example.supermarket.domain.Payment;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * Request payload for manually reconciling a previously INITIATED mobile money payment
 * where the customer paid outside the automated STK push (e.g. entered PayBill/Till manually).
 *
 * Only one of paymentId or orderId is required; if both are provided paymentId wins.
 * If the backend finds an INITIATED payment and the simulated provider query deems it settled,
 * the payment will transition to SUCCESS and order progression will apply.
 */
public record ManualReconciliationRequest(
        Long paymentId,
        Long orderId,
        @NotNull Payment.PaymentProvider provider,
        String phoneNumber,
        BigDecimal amount
) { }
