package com.example.supermarket.admin.controller;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.Product;
import com.example.supermarket.dto.DashboardStatsResponse;
import com.example.supermarket.dto.AnalyticsOverviewResponse;
import com.example.supermarket.dto.OrderResponse;
import com.example.supermarket.dto.ProductRequest;
import com.example.supermarket.dto.ProductResponse;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.service.DashboardService;
import com.example.supermarket.service.OrderService;
import com.example.supermarket.service.ProductService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private final ProductService productService;
    private final OrderService orderService;
    private final DashboardService dashboardService;

    public AdminController(ProductService productService, OrderService orderService, DashboardService dashboardService) {
        this.productService = productService;
        this.orderService = orderService;
        this.dashboardService = dashboardService;
    }

    // Product Management
    @PostMapping("/products")
    public ResponseEntity<ProductResponse> createProduct(@RequestBody ProductRequest req) {
        Product saved = productService.createFromRequest(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.toResponse(saved));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<ProductResponse> updateProduct(@PathVariable Long id, @RequestBody ProductRequest req) {
        Product updated = productService.updateFromRequest(id, req);
        return ResponseEntity.ok(productService.toResponse(updated));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    // Admin product list with filters (mirrors public search but namespaced for admin UI consistency)
    @GetMapping("/products")
    public ResponseEntity<PageResponse<ProductResponse>> listProductsAdmin(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "categoryId", required = false) Long categoryId,
            @RequestParam(name = "minPrice", required = false) java.math.BigDecimal minPrice,
            @RequestParam(name = "maxPrice", required = false) java.math.BigDecimal maxPrice,
            @RequestParam(name = "inStock", required = false) Boolean inStock,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sort", defaultValue = "name") String sort,
            @RequestParam(name = "direction", defaultValue = "asc") String direction) {
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            return ResponseEntity.badRequest().build();
        }
        PageResponse<ProductResponse> resp = productService.searchPaged(q, categoryId, minPrice, maxPrice, inStock, page, size, sort, direction);
        return ResponseEntity.ok(resp);
    }

    // Order Management
    @GetMapping("/orders")
    public ResponseEntity<PageResponse<OrderResponse>> getAllOrders(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "status", required = false) Order.OrderStatus status,
            @RequestParam(name = "from", required = false) java.time.OffsetDateTime from,
            @RequestParam(name = "to", required = false) java.time.OffsetDateTime to,
            @RequestParam(name = "minTotal", required = false) java.math.BigDecimal minTotal,
            @RequestParam(name = "maxTotal", required = false) java.math.BigDecimal maxTotal,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sort", defaultValue = "createdAt") String sort,
            @RequestParam(name = "direction", defaultValue = "desc") String direction) {
        if (from != null && to != null && from.isAfter(to)) {
            return ResponseEntity.badRequest().build();
        }
        if (minTotal != null && maxTotal != null && minTotal.compareTo(maxTotal) > 0) {
            return ResponseEntity.badRequest().build();
        }
        PageResponse<OrderResponse> resp = orderService.searchPaged(q, status, from, to, minTotal, maxTotal, page, size, sort, direction);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/orders/{id}")
    public ResponseEntity<OrderResponse> getOrderById(@PathVariable Long id) {
        Optional<Order> order = orderService.getOrderById(id);
        return order.map(o -> ResponseEntity.ok(orderService.toResponse(o)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/orders/{id}/status")
    public ResponseEntity<OrderResponse> updateOrderStatus(@PathVariable Long id, @RequestParam Order.OrderStatus status) {
        Order updatedOrder = orderService.updateOrderStatus(id, status);
        return ResponseEntity.ok(orderService.toResponse(updatedOrder));
    }

    @GetMapping("/orders/status/{status}")
    public ResponseEntity<List<OrderResponse>> getOrdersByStatus(@PathVariable Order.OrderStatus status) {
        List<OrderResponse> orders = orderService.getOrdersByStatus(status).stream().map(orderService::toResponse).toList();
        return ResponseEntity.ok(orders);
    }

    @DeleteMapping("/orders/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        orderService.deleteOrder(id);
        return ResponseEntity.noContent().build();
    }

    // Dashboard Analytics
    @GetMapping("/dashboard/stats")
    public ResponseEntity<DashboardStatsResponse> getDashboardStats() {
        return ResponseEntity.ok(dashboardService.getStats());
    }

    @GetMapping("/dashboard/recent-orders")
    public ResponseEntity<List<OrderResponse>> getRecentOrders(@RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(dashboardService.getRecentOrders(limit));
    }

    // Additional analytics (placeholder for extended metrics, charts data, etc.)
    @GetMapping("/analytics/overview")
    public ResponseEntity<AnalyticsOverviewResponse> getAnalyticsOverview(
            @RequestParam(defaultValue = "5") int lowStockThreshold,
            @RequestParam(defaultValue = "30") int revenueDays
    ) {
        return ResponseEntity.ok(dashboardService.getAnalyticsOverview(lowStockThreshold, revenueDays));
    }
}
