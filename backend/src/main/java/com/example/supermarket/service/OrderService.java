package com.example.supermarket.service;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.OrderItem;
import com.example.supermarket.domain.User;
import com.example.supermarket.domain.Product;
import com.example.supermarket.dto.OrderResponse;
import com.example.supermarket.dto.OrderItemRequest;
import com.example.supermarket.repository.OrderRepository;
import com.example.supermarket.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.mapper.OrderMapper;
import com.example.supermarket.repository.PaymentRepository;

@Service
@Transactional
public class OrderService {

    private static final BigDecimal VAT_RATE = new BigDecimal("0.16"); // 16% VAT

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private PaymentRepository paymentRepository;

    public List<Order> getAllOrders() { return orderRepository.findAll(); }

    public PageResponse<OrderResponse> getAllOrdersPaged(int page, int size, String sort, String direction) {
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
        Page<Order> p = orderRepository.findAll(pageable);
        List<OrderResponse> content = p.getContent().stream().map(orderMapper::toResponse).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isFirst(), p.isLast());
    }

    public PageResponse<OrderResponse> searchPaged(String q, Order.OrderStatus status, java.time.OffsetDateTime from, java.time.OffsetDateTime to,
                                                  java.math.BigDecimal minTotal, java.math.BigDecimal maxTotal,
                                                  int page, int size, String sort, String direction) {
        String query = (q != null && !q.isBlank()) ? q.trim() : null;
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
    Page<Order> p = orderRepository.searchOrders(status, from, to, minTotal, maxTotal, query, pageable);
        List<OrderResponse> content = p.getContent().stream().map(orderMapper::toResponse).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isFirst(), p.isLast());
    }

    public Optional<Order> getOrderById(Long id) {
        return orderRepository.findById(id);
    }

    public Order createOrder(String customerName, String customerPhone, List<OrderItemRequest> items, User user) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least one item");
        }

        // First pass: load all products & validate stock
        BigDecimal totalGross = BigDecimal.ZERO;
        Order order = new Order();
        order.setCustomerName(customerName);
        order.setCustomerPhone(customerPhone);
        if (user != null) {
            order.setUser(user);
            // If no customerName passed (future scenario), default to user's full name
            if (customerName == null || customerName.isBlank()) {
                order.setCustomerName(user.getFullName());
            }
        }
        boolean thumbnailSet = false;

    for (OrderItemRequest itemRequest : items) {
            Product product = productRepository.findById(itemRequest.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + itemRequest.productId()));

            int requested = itemRequest.quantity();
            if (requested <= 0) {
                throw new IllegalArgumentException("Quantity must be positive for product: " + product.getId());
            }
            Integer currentStock = product.getStock();
            if (currentStock == null) currentStock = 0; // safety
            if (requested > currentStock) {
                // Using IllegalStateException here; a custom ConflictException could map to 409 via GlobalExceptionHandler
                throw new IllegalStateException("Insufficient stock for product id " + product.getId() + ": requested " + requested + ", available " + currentStock);
            }

            // Pricing calculations
            BigDecimal unitPriceGross = product.getPrice();
            BigDecimal unitPriceNet = unitPriceGross.divide(BigDecimal.ONE.add(VAT_RATE), 2, RoundingMode.HALF_UP);
            BigDecimal vatPerUnit = unitPriceGross.subtract(unitPriceNet);
            BigDecimal totalVatForItem = vatPerUnit.multiply(new BigDecimal(requested));

            OrderItem orderItem = new OrderItem();
            orderItem.setProduct(product);
            orderItem.setQuantity(requested);
            orderItem.setUnitPriceGross(unitPriceGross);
            orderItem.setUnitPriceNet(unitPriceNet);
            orderItem.setVatAmount(totalVatForItem);
            order.addItem(orderItem);

            if (!thumbnailSet && product.getImageUrl() != null && !product.getImageUrl().isBlank()) {
                order.setThumbnailUrl(product.getImageUrl());
                thumbnailSet = true;
            }

            totalGross = totalGross.add(unitPriceGross.multiply(new BigDecimal(requested)));

            // Decrement stock (will be persisted when transaction commits)
            product.setStock(currentStock - requested);
        }

        BigDecimal totalNet = totalGross.divide(BigDecimal.ONE.add(VAT_RATE), 2, RoundingMode.HALF_UP);
        BigDecimal vatAmount = totalGross.subtract(totalNet);
        order.setTotalGross(totalGross);
        order.setTotalNet(totalNet);
        order.setVatAmount(vatAmount);
        return orderRepository.save(order);
    }


    public void deleteOrder(Long id) {
        orderRepository.deleteById(id);
    }

    // Admin-specific order management methods
    public Order updateOrderStatus(Long orderId, Order.OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found with id: " + orderId));
        
        order.setStatus(newStatus);
        return orderRepository.save(order);
    }

    public List<Order> getOrdersByStatus(Order.OrderStatus status) {
        return orderRepository.findAll().stream()
                .filter(order -> order.getStatus() == status)
                .toList();
    }

    public List<Order> getOrdersByCustomer(String customerName) {
        return orderRepository.findAll().stream()
                .filter(order -> order.getCustomerName().toLowerCase().contains(customerName.toLowerCase()))
                .toList();
    }

    public List<Order> getOrdersByUser(User user) {
        return orderRepository.findByUser(user);
    }

    public PageResponse<OrderResponse> getOrdersByUserPaged(User user, int page, int size, String sort, String direction) {
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
        Page<Order> p = orderRepository.findByUser(user, pageable);
        List<Order> orders = p.getContent();
        List<Long> orderIds = orders.stream().map(Order::getId).toList();
        var payments = orderIds.isEmpty() ? java.util.List.<com.example.supermarket.domain.Payment>of() : paymentRepository.findByOrderIdIn(orderIds);
        java.util.Map<Long, com.example.supermarket.domain.Payment> paymentMap = payments.stream().collect(java.util.stream.Collectors.toMap(pm -> pm.getOrder().getId(), pm -> pm,(a,b)->a));
        List<OrderResponse> content = orders.stream().map(o -> {
            OrderResponse base = orderMapper.toResponse(o);
            var payment = paymentMap.get(o.getId());
            if (payment == null) return new OrderResponse(
                    base.id(), base.createdAt(), base.customerName(), base.customerPhone(), base.items(), base.totalGross(), base.totalNet(), base.vatAmount(), base.thumbnailUrl(), base.status(), base.userId(), null, null
            );
            return new OrderResponse(
                    base.id(), base.createdAt(), base.customerName(), base.customerPhone(), base.items(), base.totalGross(), base.totalNet(), base.vatAmount(), base.thumbnailUrl(), base.status(), base.userId(), payment.getStatus().name(), payment.getMethod() != null ? payment.getMethod().name() : null
            );
        }).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isFirst(), p.isLast());
    }

    // Order statistics for admin dashboard
    public long getTotalOrdersCount() {
        return orderRepository.count();
    }

    public BigDecimal getTotalRevenue() { return orderRepository.sumTotalGross(); }

    public long getOrdersCountByStatus(Order.OrderStatus status) { return orderRepository.countByStatus(status); }

    public OrderResponse toResponse(Order order) { return orderMapper.toResponse(order); }

    private Sort buildSort(String sort, String direction) {
        String property = (sort == null || sort.isBlank()) ? "createdAt" : sort;
        if (!List.of("createdAt", "totalGross", "status", "id").contains(property)) {
            property = "createdAt";
        }
        Sort base = Sort.by(property);
        boolean asc = direction == null || direction.equalsIgnoreCase("asc");
        return asc ? base.ascending() : base.descending();
    }
}