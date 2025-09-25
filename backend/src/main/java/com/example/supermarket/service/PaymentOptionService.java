package com.example.supermarket.service;

import com.example.supermarket.domain.Payment;
import com.example.supermarket.domain.PaymentOption;
import com.example.supermarket.dto.PaymentOptionAdminRequest;
import com.example.supermarket.dto.PaymentOptionResponse;
import com.example.supermarket.repository.PaymentOptionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class PaymentOptionService {

    @Autowired
    private PaymentOptionRepository repository;

    public PaymentOptionResponse create(PaymentOptionAdminRequest req) {
        PaymentOption option = new PaymentOption();
        apply(option, req);
        validate(option, true);
        return toResponse(repository.save(option));
    }

    public PaymentOptionResponse update(Long id, PaymentOptionAdminRequest req) {
        PaymentOption option = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("PaymentOption not found: " + id));
        apply(option, req);
        validate(option, false);
        return toResponse(option); // JPA dirty tracking will flush
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("PaymentOption not found: " + id);
        }
        repository.deleteById(id);
    }

    public List<PaymentOptionResponse> listAll(Boolean active) {
    java.util.function.Predicate<PaymentOption> excludeSendMoney = p -> true; // send money enums removed, no filtering needed
        if (active != null) {
            if (active) {
                return repository.findAllByActiveTrueOrderBySortOrderAscDisplayNameAsc().stream()
                        .filter(excludeSendMoney)
                        .map(this::toResponse).toList();
            } else {
                return repository.findAll().stream()
                        .filter(p->!p.isActive())
                        .filter(excludeSendMoney)
                        .sorted((a,b)->{
                            int so = Integer.compare(Optional.ofNullable(a.getSortOrder()).orElse(0), Optional.ofNullable(b.getSortOrder()).orElse(0));
                            if (so != 0) return so;
                            return a.getDisplayName().compareToIgnoreCase(b.getDisplayName());
                        }).map(this::toResponse).toList();
            }
        }
        return repository.findAll().stream()
                .filter(excludeSendMoney)
                .sorted((a,b)->{
                    int so = Integer.compare(Optional.ofNullable(a.getSortOrder()).orElse(0), Optional.ofNullable(b.getSortOrder()).orElse(0));
                    if (so != 0) return so;
                    return a.getDisplayName().compareToIgnoreCase(b.getDisplayName());
                }).map(this::toResponse).toList();
    }

    public List<PaymentOptionResponse> listActive() {
    return repository.findAllByActiveTrueOrderBySortOrderAscDisplayNameAsc().stream()
        .map(this::toResponse).toList();
    }

    private void apply(PaymentOption option, PaymentOptionAdminRequest req) {
        option.setProvider(req.provider());
        option.setChannel(req.channel());
        option.setDisplayName(req.displayName());
        option.setShortDescription(req.shortDescription());
        option.setInstructionsMarkdown(req.instructionsMarkdown());
        option.setPaybillNumber(req.paybillNumber());
        option.setTillNumber(req.tillNumber());
        option.setBusinessShortCode(req.businessShortCode());
        option.setRecipientPhone(req.recipientPhone());
        option.setAccountReferenceTemplate(req.accountReferenceTemplate());
        option.setSupportsStk(req.supportsStk());
        option.setActive(req.active());
        option.setSortOrder(req.sortOrder() == null ? 0 : req.sortOrder());
        option.setMetadataJson(req.metadataJson());
    }

    private void validate(PaymentOption option, boolean creating) {
        Payment.PaymentChannel ch = option.getChannel();
        // Disallow configuration of manual send money channels; they are covered under COD flow now.
        // Per-channel requirements (remaining allowed channels)
        switch (ch) {
            case MPESA_PAYBILL -> require(option.getPaybillNumber(), "paybillNumber required for MPESA_PAYBILL");
            case MPESA_TILL -> require(option.getTillNumber(), "tillNumber required for MPESA_TILL");
            case MPESA_P2P, MPESA_POCHI -> require(option.getRecipientPhone(), "recipientPhone required for P2P/POCHI");
            default -> {}
        }
        // supportsStk only valid for STK channels
        if (option.isSupportsStk()) {
            if (!(ch == Payment.PaymentChannel.MPESA_STK_PUSH || ch == Payment.PaymentChannel.AIRTEL_STK_PUSH || ch == Payment.PaymentChannel.MPESA_PAYBILL || ch == Payment.PaymentChannel.MPESA_TILL || ch == Payment.PaymentChannel.AIRTEL_COLLECTION)) {
                throw new IllegalArgumentException("supportsStk true only allowed for STK legacy or base bill/till/collection channels");
            }
        }
        // Provide a default account reference template if missing for PayBill/Till
        if (option.getAccountReferenceTemplate() == null && (ch == Payment.PaymentChannel.MPESA_PAYBILL || ch == Payment.PaymentChannel.MPESA_TILL)) {
            option.setAccountReferenceTemplate("ORDER-{orderId}");
        }
    }

    private void require(String v, String msg) {
        if (v == null || v.isBlank()) throw new IllegalArgumentException(msg);
    }

    private PaymentOptionResponse toResponse(PaymentOption p) {
        return new PaymentOptionResponse(
                p.getId(),
                p.getProvider().name(),
                p.getChannel().name(),
                p.getDisplayName(),
                p.getShortDescription(),
                p.getInstructionsMarkdown(),
                p.isSupportsStk(),
                p.getPaybillNumber(),
                p.getTillNumber(),
                p.getRecipientPhone(),
                p.getAccountReferenceTemplate(),
                p.isActive(),
                p.getSortOrder()
        );
    }
}
