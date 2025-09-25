package com.example.supermarket.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Payment entity extended to support external mobile money providers (M-Pesa, Airtel).
 * New fields:
 *  - provider: which external provider handled the payment.
 *  - channel: specific channel / product (STK Push, PayBill, Till, P2P, etc.).
 *  - phoneNumber: MSISDN used for the mobile money transaction (E.164/ local format as provided).
 *  - currency: ISO 4217 code (default KES) for better future multi-currency support.
 *  - externalRequestId: ID returned when initiating (e.g. CheckoutRequestID for STK push).
 *  - externalTransactionId: Final transaction reference (e.g. MpesaReceiptNumber) once successful.
 *  - rawRequestPayload / rawCallbackPayload: JSON snapshot for auditing & debugging.
 */

@Entity
@Table(name = "payments")
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    // Nullable if guest checkout
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(precision = 14, scale = 2, nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status = PaymentStatus.INITIATED;

    @Enumerated(EnumType.STRING)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    private PaymentProvider provider; // e.g. MPESA, AIRTEL

    @Enumerated(EnumType.STRING)
    private PaymentChannel channel; // e.g. MPESA_STK_PUSH, MPESA_PAYBILL

    private String phoneNumber; // MSISDN used for mobile money (if applicable)

    @Column(length = 3)
    private String currency = "KES";

    // External references
    private String externalRequestId; // initial request id
    private String externalTransactionId; // final receipt id

    @Lob
    private String rawRequestPayload;

    @Lob
    private String rawCallbackPayload;

    private String providerRef; // stub/reference for external provider

    private OffsetDateTime createdAt = OffsetDateTime.now();
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    public void onUpdate() { this.updatedAt = OffsetDateTime.now(); }

    public Long getId() { return id; }
    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod method) { this.method = method; }
    public PaymentProvider getProvider() { return provider; }
    public void setProvider(PaymentProvider provider) { this.provider = provider; }
    public PaymentChannel getChannel() { return channel; }
    public void setChannel(PaymentChannel channel) { this.channel = channel; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getExternalRequestId() { return externalRequestId; }
    public void setExternalRequestId(String externalRequestId) { this.externalRequestId = externalRequestId; }
    public String getExternalTransactionId() { return externalTransactionId; }
    public void setExternalTransactionId(String externalTransactionId) { this.externalTransactionId = externalTransactionId; }
    public String getRawRequestPayload() { return rawRequestPayload; }
    public void setRawRequestPayload(String rawRequestPayload) { this.rawRequestPayload = rawRequestPayload; }
    public String getRawCallbackPayload() { return rawCallbackPayload; }
    public void setRawCallbackPayload(String rawCallbackPayload) { this.rawCallbackPayload = rawCallbackPayload; }
    public String getProviderRef() { return providerRef; }
    public void setProviderRef(String providerRef) { this.providerRef = providerRef; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public enum PaymentStatus {
        INITIATED,
        SUCCESS,
        FAILED,
        REFUNDED
    }

    public enum PaymentMethod {
        CARD,
        MOBILE_MONEY,
        CASH_ON_DELIVERY
    }

    public enum PaymentProvider {
        MPESA,
        AIRTEL
    }

    public enum PaymentChannel {
        // NOTE: *_STK_PUSH entries historically represented automated push flows.
        // Conceptually STK is a capability layered on top of underlying channels (PayBill, Till, Collection).
        // They are kept for backward compatibility; new configuration should prefer PAYBILL / TILL with supportsStk=true.
        MPESA_STK_PUSH,      // legacy shortcut (treat like PAYBILL/TILL with supportsStk)
        MPESA_PAYBILL,
        MPESA_TILL,
    MPESA_P2P,
    MPESA_POCHI,
        AIRTEL_STK_PUSH,     // legacy shortcut
        AIRTEL_COLLECTION
    }
}
