package com.example.supermarket.dto;

import java.util.List;

/**
 * Simplified representation of M-Pesa STK Push callback payload.
 * Raw JSON will also be stored; this DTO pulls common fields for easier handling.
 */
public record MpesaStkCallback(
        String merchantRequestID,
        String checkoutRequestID,
        int resultCode,
        String resultDesc,
        CallbackMetadata callbackMetadata
) {
    public record CallbackMetadata(List<Item> item) {}
    public record Item(String name, String value) {}
}
