package com.example.supermarket.repository;

import com.example.supermarket.domain.PaymentOption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaymentOptionRepository extends JpaRepository<PaymentOption, Long> {
    List<PaymentOption> findAllByActiveTrueOrderBySortOrderAscDisplayNameAsc();
}
