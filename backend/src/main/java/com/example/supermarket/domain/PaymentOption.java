package com.example.supermarket.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/**
 * Configurable payment option exposed to checkout. Allows admin to define multiple
 * provider/channel combinations (e.g. M-Pesa PayBill, Till, Pochi, Airtel STK) with
 * dynamic instructions.
 */
@Entity
@Table(name = "payment_options")
public class PaymentOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Payment.PaymentProvider provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Payment.PaymentChannel channel;

    @Column(nullable = false, length = 120)
    private String displayName;

    @Column(length = 240)
    private String shortDescription;

    @Lob
    private String instructionsMarkdown; // Manual instructions / steps / disclaimers

    // Identifiers (nullable depending on channel)
    private String paybillNumber;       // For MPESA_PAYBILL
    private String tillNumber;          // For MPESA_TILL
    private String businessShortCode;   // Alternate alias for paybill if needed
    private String recipientPhone;      // For P2P / POCHI channels
    private String accountReferenceTemplate; // e.g. ORDER-{orderId}

    private boolean supportsStk = false; // If true, UI can trigger automated STK push
    private boolean active = true;
    private Integer sortOrder = 0;

    @Lob
    private String metadataJson; // flexible JSON blob for future extension

    private OffsetDateTime createdAt = OffsetDateTime.now();
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    public void onUpdate() { this.updatedAt = OffsetDateTime.now(); }

    // Getters / setters
    public Long getId() { return id; }
    public Payment.PaymentProvider getProvider() { return provider; }
    public void setProvider(Payment.PaymentProvider provider) { this.provider = provider; }
    public Payment.PaymentChannel getChannel() { return channel; }
    public void setChannel(Payment.PaymentChannel channel) { this.channel = channel; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getShortDescription() { return shortDescription; }
    public void setShortDescription(String shortDescription) { this.shortDescription = shortDescription; }
    public String getInstructionsMarkdown() { return instructionsMarkdown; }
    public void setInstructionsMarkdown(String instructionsMarkdown) { this.instructionsMarkdown = instructionsMarkdown; }
    public String getPaybillNumber() { return paybillNumber; }
    public void setPaybillNumber(String paybillNumber) { this.paybillNumber = paybillNumber; }
    public String getTillNumber() { return tillNumber; }
    public void setTillNumber(String tillNumber) { this.tillNumber = tillNumber; }
    public String getBusinessShortCode() { return businessShortCode; }
    public void setBusinessShortCode(String businessShortCode) { this.businessShortCode = businessShortCode; }
    public String getRecipientPhone() { return recipientPhone; }
    public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }
    public String getAccountReferenceTemplate() { return accountReferenceTemplate; }
    public void setAccountReferenceTemplate(String accountReferenceTemplate) { this.accountReferenceTemplate = accountReferenceTemplate; }
    public boolean isSupportsStk() { return supportsStk; }
    public void setSupportsStk(boolean supportsStk) { this.supportsStk = supportsStk; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
