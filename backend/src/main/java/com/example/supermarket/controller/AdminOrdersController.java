package com.example.supermarket.controller;

import com.example.supermarket.domain.Order;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.dto.OrderResponse;
import com.example.supermarket.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/orders")
@CrossOrigin(origins = "*")
public class AdminOrdersController {

    @Autowired
    private OrderService orderService;

    @GetMapping
    public ResponseEntity<PageResponse<OrderResponse>> list(@RequestParam(name = "q", required = false) String q,
                                                            @RequestParam(name = "status", required = false) Order.OrderStatus status,
                                                            @RequestParam(name = "from", required = false) java.time.OffsetDateTime from,
                                                            @RequestParam(name = "to", required = false) java.time.OffsetDateTime to,
                                                            @RequestParam(name = "minTotal", required = false) java.math.BigDecimal minTotal,
                                                            @RequestParam(name = "maxTotal", required = false) java.math.BigDecimal maxTotal,
                                                            @RequestParam(name = "page", defaultValue = "0") int page,
                                                            @RequestParam(name = "size", defaultValue = "10") int size,
                                                            @RequestParam(name = "sort", required = false) String sort,
                                                            @RequestParam(name = "direction", required = false) String direction) {
        if (from != null && to != null && from.isAfter(to)) {
            return ResponseEntity.badRequest().build();
        }
        if (minTotal != null && maxTotal != null && minTotal.compareTo(maxTotal) > 0) {
            return ResponseEntity.badRequest().build();
        }
        PageResponse<OrderResponse> resp;
        if (q != null || status != null || from != null || to != null || minTotal != null || maxTotal != null) {
            resp = orderService.searchPaged(q, status, from, to, minTotal, maxTotal, page, size, sort, direction);
        } else {
            resp = orderService.getAllOrdersPaged(page, size, sort, direction);
        }
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<OrderResponse> updateStatus(@PathVariable Long id, @RequestParam("status") Order.OrderStatus status) {
        try {
            Order updated = orderService.updateOrderStatus(id, status);
            return ResponseEntity.ok(orderService.toResponse(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
