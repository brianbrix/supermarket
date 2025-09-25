package com.example.supermarket.dto;

import java.math.BigDecimal;
import java.util.List;

// NOTE: 'imageUrls' retained for backward compatibility with existing frontend mapping.
// New 'images' provides per-image id + url + position to enable deletion & ordering in UI.


public record ProductResponse(
        Long id,
        String name,
        Long categoryId,
        String categoryName,
        BigDecimal price,
        String description,
        String imageUrl,
        List<String> imageUrls,
        List<ProductImageResponse> images,
        Integer stock,
        String unit
) {}
