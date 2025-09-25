package com.example.supermarket.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "category_id")
    private Category category;
    private String description;
    private String imageUrl; // legacy single image (first image for backward compatibility)
    // Track available sellable stock units. Provide explicit column definition so Hibernate includes DEFAULT 0 when adding column.
    // Note: columnDefinition is Postgres-specific here; adjust if targeting multiple DB vendors.
    @Column(nullable = false, columnDefinition = "integer not null default 0")
    private Integer stock = 0;

    // e.g. "pack of 4", "500g", "1L"; optional display unit descriptor
    private String unit;

    // Price stored as VAT-inclusive
    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("position ASC, id ASC")
    private java.util.List<ProductImage> images = new java.util.ArrayList<>();

    public Product() {}

    public Product(String name, Category category, BigDecimal price) {
        this.name = name;
        this.category = category;
        this.price = price;
    }

    public Product(String name, Category category, BigDecimal price, String description, String imageUrl, Integer stock, String unit) {
        this.name = name;
        this.category = category;
        this.price = price;
        this.description = description;
        this.imageUrl = imageUrl;
        this.stock = stock;
        this.unit = unit;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public java.util.List<ProductImage> getImages() { return images; }
    public void setImages(java.util.List<ProductImage> images) { this.images = images; }
    public void addImage(ProductImage img) { images.add(img); img.setProduct(this); }
    public void removeImage(ProductImage img) { images.remove(img); img.setProduct(null); }
    public Integer getStock() { return stock; }
    public void setStock(Integer stock) { this.stock = stock; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
}
