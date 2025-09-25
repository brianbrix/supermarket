package com.example.supermarket.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record ProductRequest(
        @NotBlank String name,
        // categoryId is used to reference an existing Category
        Long categoryId,
        @NotNull BigDecimal price,
        String description,
        String imageUrl,
        Integer stock,
        String unit
) {}
