package com.example.supermarket.dto;

public class CategoryResponse {
    private Long id;
    private String name;
    private String description;
    private Long productCount;

    public CategoryResponse(Long id, String name, String description, Long productCount) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.productCount = productCount;
    }
 public CategoryResponse(Long id, String name) {
        this.id = id;
        this.name = name;
    }
    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public Long getProductCount() {
        return productCount;
    }
}
