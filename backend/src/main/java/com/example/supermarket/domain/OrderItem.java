package com.example.supermarket.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnore
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    private Product product;

    private int quantity;

    @Column(precision = 12, scale = 2)
    private BigDecimal unitPriceGross; // inclusive price per unit

    @Column(precision = 12, scale = 2)
    private BigDecimal unitPriceNet; // exclusive price per unit

    @Column(precision = 12, scale = 2)
    private BigDecimal vatAmount; // vat portion for all units (unit * qty - net total)

    public Order getOrder() { return order; }
    public void setOrder(Order order) { this.order = order; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPriceGross() { return unitPriceGross; }
    public void setUnitPriceGross(BigDecimal unitPriceGross) { this.unitPriceGross = unitPriceGross; }
    public BigDecimal getUnitPriceNet() { return unitPriceNet; }
    public void setUnitPriceNet(BigDecimal unitPriceNet) { this.unitPriceNet = unitPriceNet; }
    public BigDecimal getVatAmount() { return vatAmount; }
    public void setVatAmount(BigDecimal vatAmount) { this.vatAmount = vatAmount; }
}
