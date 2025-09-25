package com.example.supermarket.mapper;

import com.example.supermarket.domain.Order;
import com.example.supermarket.dto.OrderResponse;
import org.springframework.stereotype.Component;

@Component
public class OrderMapper {
    public OrderResponse toResponse(Order order) {
        if (order == null) return null;
        Long userId = order.getUser() != null ? order.getUser().getId() : null;
    return new OrderResponse(
        order.getId(),
        order.getCreatedAt(),
        order.getCustomerName(),
        order.getCustomerPhone(),
        order.getItems().stream().map(oi -> new OrderResponse.OrderItemEntry(
            oi.getProduct().getId(),
            oi.getProduct().getName(),
            oi.getQuantity(),
            oi.getUnitPriceGross(),
            oi.getUnitPriceNet(),
            oi.getVatAmount()
        )).toList(),
        order.getTotalGross(),
        order.getTotalNet(),
        order.getVatAmount(),
        order.getThumbnailUrl(),
        order.getStatus().name(),
        userId,
        null,
        null
    );
    }
}