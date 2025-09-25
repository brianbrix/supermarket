package com.example.supermarket.repository;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.List;
import java.util.Map;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByOrder(Order order);

    @Query("SELECT p FROM Payment p WHERE p.order.id IN :orderIds")
    List<Payment> findByOrderIdIn(@Param("orderIds") List<Long> orderIds);

    Optional<Payment> findByExternalRequestId(String externalRequestId);
    Optional<Payment> findByExternalTransactionId(String externalTransactionId);

    @Query("""
        SELECT p FROM Payment p
        WHERE (:status IS NULL OR p.status = :status)
        AND (:method IS NULL OR p.method = :method)
        AND (:q IS NULL OR LOWER(p.providerRef) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(p.order.customerName) LIKE LOWER(CONCAT('%', :q, '%')))
        AND (:from IS NULL OR p.createdAt >= :from)
        AND (:to IS NULL OR p.createdAt <= :to)
        AND (:minAmount IS NULL OR p.amount >= :minAmount)
        AND (:maxAmount IS NULL OR p.amount <= :maxAmount)
    """)
    Page<Payment> searchPayments(@Param("q") String q,
                               @Param("status") Payment.PaymentStatus status,
                               @Param("method") Payment.PaymentMethod method,
                               @Param("from") java.time.OffsetDateTime from,
                               @Param("to") java.time.OffsetDateTime to,
                               @Param("minAmount") java.math.BigDecimal minAmount,
                               @Param("maxAmount") java.math.BigDecimal maxAmount,
                               Pageable pageable);
}
