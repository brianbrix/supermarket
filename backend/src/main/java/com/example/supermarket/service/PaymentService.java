package com.example.supermarket.service;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.Payment;
import com.example.supermarket.domain.User;
import com.example.supermarket.dto.PaymentRequest;
import com.example.supermarket.dto.MobileMoneyInitiationRequest;
import com.example.supermarket.dto.MpesaStkCallback;
import com.example.supermarket.service.payments.PaymentProviderRegistry;
import com.example.supermarket.repository.PaymentOptionRepository;
import com.example.supermarket.domain.PaymentOption;
import com.example.supermarket.dto.ManualPaymentInitiationRequest;
import com.example.supermarket.dto.AirtelCallback;
import com.example.supermarket.dto.PaymentResponse;
import com.example.supermarket.dto.ManualReconciliationRequest;
import com.example.supermarket.repository.OrderRepository;
import com.example.supermarket.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.mapper.PaymentMapper;

@Service
@Transactional
public class PaymentService {

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PaymentMapper paymentMapper;

    @Autowired
    private PaymentProviderRegistry paymentProviderRegistry;

    @Autowired
    private PaymentOptionRepository paymentOptionRepository;

    public PaymentResponse createOrFetch(PaymentRequest request, User user) {
        Order order = orderRepository.findById(request.orderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + request.orderId()));

        // If payment already exists for order, return it (idempotent behavior)
        Optional<Payment> existing = paymentRepository.findByOrder(order);
        if (existing.isPresent()) { return paymentMapper.toResponse(existing.get()); }

        Payment payment = new Payment();
        payment.setOrder(order);
        if (user != null) payment.setUser(user);
        payment.setAmount(order.getTotalGross());
        payment.setMethod(request.method());
        // Leave payment in INITIATED for all methods; status will transition via provider callback
        // or manual confirmation (e.g. COD on delivery). Previous behavior auto-successed non-COD
        // which skipped actual external confirmation and could misrepresent failed payments.
        payment.setStatus(Payment.PaymentStatus.INITIATED);
        payment.setProviderRef("SIM-" + System.currentTimeMillis());
        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toResponse(saved);
    }

    /**
     * Initiate a mobile money payment via provider abstraction.
     * Creates a Payment row (or reuses existing if already SUCCESS / INITIATED for same channel).
     */
    public PaymentResponse initiateMobileMoney(MobileMoneyInitiationRequest req, User user) {
        Order order = orderRepository.findById(req.orderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + req.orderId()));

        // Basic idempotency: if a payment already exists with same order & channel still pending, return it.
        var existing = paymentRepository.findByOrder(order)
                .filter(p -> p.getChannel() == req.channel() && p.getStatus() == Payment.PaymentStatus.INITIATED);
        if (existing.isPresent()) {
            return paymentMapper.toResponse(existing.get());
        }

        Payment payment = new Payment();
        payment.setOrder(order);
        payment.setAmount(req.amount() != null ? req.amount() : order.getTotalGross());
        payment.setMethod(req.method());
        payment.setProvider(req.provider());
        payment.setChannel(req.channel());
        payment.setPhoneNumber(req.phoneNumber());
        if (user != null) payment.setUser(user);

        // Let provider implementation enrich payment (external IDs, request payload)
        var provider = paymentProviderRegistry.resolve(req.provider(), req.channel());
        payment = provider.initiate(order, payment, req);

        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toResponse(saved);
    }

    /**
     * Create a manual (non-STK) mobile money payment referencing a PaymentOption.
     * Leaves status INITIATED; later confirmation is manual/admin-driven.
     */
    public PaymentResponse initiateManual(ManualPaymentInitiationRequest req, User user) {
        Order order = orderRepository.findById(req.orderId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + req.orderId()));
        PaymentOption option = paymentOptionRepository.findById(req.paymentOptionId())
                .orElseThrow(() -> new IllegalArgumentException("PaymentOption not found: " + req.paymentOptionId()));
        if (!option.isActive()) {
            throw new IllegalStateException("Payment option inactive");
        }
        // Idempotency: reuse existing INITIATED payment for same order+channel
        var existing = paymentRepository.findByOrder(order)
                .filter(p -> p.getChannel() == option.getChannel() && p.getStatus() == Payment.PaymentStatus.INITIATED);
        if (existing.isPresent()) {
            return paymentMapper.toResponse(existing.get());
        }
        Payment payment = new Payment();
        payment.setOrder(order);
        if (user != null) payment.setUser(user);
        payment.setAmount(req.amount() != null ? req.amount() : order.getTotalGross());
        payment.setMethod(Payment.PaymentMethod.MOBILE_MONEY);
        payment.setProvider(option.getProvider());
        payment.setChannel(option.getChannel());
        if (req.phoneNumber() != null) payment.setPhoneNumber(req.phoneNumber());
        // Use providerRef to store account reference / narration context for auditing
        StringBuilder ref = new StringBuilder();
        if (req.accountReference() != null && !req.accountReference().isBlank()) ref.append("REF:").append(req.accountReference());
        if (req.narration() != null && !req.narration().isBlank()) {
            if (ref.length()>0) ref.append(" | ");
            ref.append("NAR:").append(req.narration());
        }
        if (ref.length()>0) payment.setProviderRef(ref.toString());
        payment.setStatus(Payment.PaymentStatus.INITIATED);
        Payment saved = paymentRepository.save(payment);
        return paymentMapper.toResponse(saved);
    }

    /**
     * Persist updates from M-Pesa STK callback. Idempotent: if already SUCCESS/FAILED matching external IDs, returns existing.
     */
    public void handleMpesaCallback(MpesaStkCallback callback, String rawJson) {
        // Attempt to locate existing payment by externalRequestId (CheckoutRequestID) or final receipt if provided.
    java.util.Optional<Payment> paymentOpt = java.util.Optional.empty();
        if (callback.checkoutRequestID() != null) {
            paymentOpt = paymentRepository.findByExternalRequestId(callback.checkoutRequestID());
        }
        if (paymentOpt.isEmpty() && callback.callbackMetadata() != null && callback.callbackMetadata().item() != null) {
            String receipt = callback.callbackMetadata().item().stream()
                    .filter(i -> "MpesaReceiptNumber".equalsIgnoreCase(i.name()))
                    .map(MpesaStkCallback.Item::value)
                    .findFirst().orElse(null);
            if (receipt != null) {
                paymentOpt = paymentRepository.findByExternalTransactionId(receipt);
            }
        }
        if (paymentOpt.isEmpty()) {
            // No matching payment; log and ignore (could optionally create orphan record)
            return;
        }
        Payment payment = paymentOpt.get();
        // Idempotency: if already terminal, skip
        if (payment.getStatus() == Payment.PaymentStatus.SUCCESS || payment.getStatus() == Payment.PaymentStatus.FAILED) {
            return;
        }
        payment.setRawCallbackPayload(rawJson);
        if (callback.resultCode() == 0) {
            payment.setStatus(Payment.PaymentStatus.SUCCESS);
            if (callback.callbackMetadata() != null && callback.callbackMetadata().item() != null) {
                callback.callbackMetadata().item().stream()
                        .filter(i -> "MpesaReceiptNumber".equalsIgnoreCase(i.name()))
                        .map(MpesaStkCallback.Item::value)
                        .findFirst().ifPresent(payment::setExternalTransactionId);
            }
            applyOrderProgression(payment);
        } else {
            payment.setStatus(Payment.PaymentStatus.FAILED);
        }
        // JPA dirty tracking will persist changes on transaction commit
    }

    /**
     * Persist updates from Airtel callback. Locate by originalRequestId (externalRequestId) or transactionId.
     */
    public void handleAirtelCallback(AirtelCallback callback, String rawJson) {
        Optional<Payment> paymentOpt = Optional.empty();
        if (callback.originalRequestId() != null) {
            paymentOpt = paymentRepository.findByExternalRequestId(callback.originalRequestId());
        }
        if (paymentOpt.isEmpty() && callback.transactionId() != null) {
            paymentOpt = paymentRepository.findByExternalTransactionId(callback.transactionId());
        }
        if (paymentOpt.isEmpty()) {
            return; // unmatched callback
        }
        Payment payment = paymentOpt.get();
        if (payment.getStatus() == Payment.PaymentStatus.SUCCESS || payment.getStatus() == Payment.PaymentStatus.FAILED) {
            return; // idempotent
        }
        payment.setRawCallbackPayload(rawJson);
        boolean success = callback.statusCode() != null && ("SUCCESS".equalsIgnoreCase(callback.statusCode()) || "000".equals(callback.statusCode()));
        payment.setStatus(success ? Payment.PaymentStatus.SUCCESS : Payment.PaymentStatus.FAILED);
        if (callback.transactionId() != null) {
            payment.setExternalTransactionId(callback.transactionId());
        }
        if (callback.msisdn() != null) {
            payment.setPhoneNumber(callback.msisdn());
        }
        applyOrderProgression(payment);
    }

    private void applyOrderProgression(Payment payment) {
        if (payment.getOrder() != null && payment.getOrder().getStatus() == Order.OrderStatus.PENDING && payment.getStatus() == Payment.PaymentStatus.SUCCESS) {
            payment.getOrder().setStatus(Order.OrderStatus.PROCESSING);
        }
    }

    public PaymentResponse getByOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
    return paymentRepository.findByOrder(order)
        .map(paymentMapper::toResponse)
        .orElseThrow(() -> new IllegalArgumentException("Payment not found for order: " + orderId));
    }

    public java.util.List<PaymentResponse> getAll() { return paymentRepository.findAll().stream().map(paymentMapper::toResponse).toList(); }

    public PageResponse<PaymentResponse> getAllPaged(int page, int size, String sort, String direction) {
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
        Page<Payment> p = paymentRepository.findAll(pageable);
        var content = p.getContent().stream().map(paymentMapper::toResponse).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isFirst(), p.isLast());
    }

    public PageResponse<PaymentResponse> searchPaged(String q, Payment.PaymentStatus status, Payment.PaymentMethod method,
                                                   java.time.OffsetDateTime from, java.time.OffsetDateTime to,
                                                   java.math.BigDecimal minAmount, java.math.BigDecimal maxAmount,
                                                   int page, int size, String sort, String direction) {
        String query = (q != null && !q.isBlank()) ? q.trim() : null;
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
        Page<Payment> p = paymentRepository.searchPayments(query, status, method, from, to, minAmount, maxAmount, pageable);
        var content = p.getContent().stream().map(paymentMapper::toResponse).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isFirst(), p.isLast());
    }

    public PaymentResponse toResponse(Payment payment) { return paymentMapper.toResponse(payment); }

    /**
     * Attempt to reconcile a manual mobile money payment that was initiated without an automatic callback.
     * Strategy:
     *  - Locate payment by paymentId or orderId.
     *  - Ensure it is still INITIATED and provider matches request.
     *  - Perform provider lookup (stubbed) using phone & amount (if provided) to decide if settled.
     *  - If "settled" mark SUCCESS, assign a synthetic externalTransactionId and progress order.
     */
    public PaymentResponse reconcileManual(ManualReconciliationRequest req) {
        Payment payment;
        if (req.paymentId() != null) {
            payment = paymentRepository.findById(req.paymentId())
                    .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + req.paymentId()));
        } else if (req.orderId() != null) {
            Order order = orderRepository.findById(req.orderId())
                    .orElseThrow(() -> new IllegalArgumentException("Order not found: " + req.orderId()));
            payment = paymentRepository.findByOrder(order)
                    .orElseThrow(() -> new IllegalArgumentException("Payment not found for order: " + req.orderId()));
        } else {
            throw new IllegalArgumentException("paymentId or orderId required");
        }
        if (payment.getStatus() != Payment.PaymentStatus.INITIATED) {
            return paymentMapper.toResponse(payment); // already terminal or refunded
        }
        if (payment.getProvider() != req.provider()) {
            throw new IllegalArgumentException("Provider mismatch");
        }
        // Simulated provider verification – in real implementation call provider API:
        boolean settled = simulateProviderSettlementCheck(payment, req);
        if (settled) {
            payment.setStatus(Payment.PaymentStatus.SUCCESS);
            if (payment.getExternalTransactionId() == null) {
                payment.setExternalTransactionId("MANUAL-" + System.currentTimeMillis());
            }
            applyOrderProgression(payment);
        }
        return paymentMapper.toResponse(payment);
    }

    private boolean simulateProviderSettlementCheck(Payment payment, ManualReconciliationRequest req) {
        // Very naive heuristic: if phone matches or not provided, and amount matches or not provided, assume settled.
        boolean phoneOk = (req.phoneNumber() == null) || (payment.getPhoneNumber() == null) || payment.getPhoneNumber().endsWith(lastN(req.phoneNumber(), 6));
        boolean amountOk = (req.amount() == null) || payment.getAmount().compareTo(req.amount()) == 0;
        return phoneOk && amountOk;
    }

    private String lastN(String s, int n) {
        if (s == null) return null;
        return s.length() <= n ? s : s.substring(s.length() - n);
    }

    private Sort buildSort(String sort, String direction) {
        String property = (sort == null || sort.isBlank()) ? "createdAt" : sort;
        if (!java.util.List.of("createdAt", "amount", "status", "id").contains(property)) {
            property = "createdAt";
        }
        Sort base = Sort.by(property);
        boolean asc = direction == null || direction.equalsIgnoreCase("asc");
        return asc ? base.ascending() : base.descending();
    }
}
