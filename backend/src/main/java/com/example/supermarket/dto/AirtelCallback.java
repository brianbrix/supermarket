package com.example.supermarket.dto;

import java.math.BigDecimal;

/**
 * Simplified Airtel Money callback representation.
 * Real Airtel responses include nested data & status sections; we only extract
 * minimal fields required to reconcile a payment:
 *  - statusCode / statusMessage -> map to SUCCESS/FAILED
 *  - transactionId (final reference)
 *  - msisdn (payer phone)
 *  - amount
 *  - originalRequestId (id sent at initiation, if echoed back by Airtel)
 * Raw JSON will still be persisted separately on the Payment entity.
 */
public record AirtelCallback(
        String statusCode,
        String statusMessage,
        String transactionId,
        String msisdn,
        BigDecimal amount,
        String originalRequestId
) {}
