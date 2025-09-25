package com.example.supermarket.repository;

import com.example.supermarket.domain.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public interface OrderRepositoryCustom {
    Page<Order> searchOrders(Order.OrderStatus status,
                             OffsetDateTime from,
                             OffsetDateTime to,
                             BigDecimal minTotal,
                             BigDecimal maxTotal,
                             String q,
                             Pageable pageable);
}
