package com.example.supermarket.mapper;

import com.example.supermarket.domain.Product;
import com.example.supermarket.domain.ProductImage;
import com.example.supermarket.dto.ProductImageResponse;
import java.util.List;
import com.example.supermarket.dto.ProductResponse;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {
    public ProductResponse toResponse(Product p) {
        if (p == null) return null;
    // Build ordered list of image URLs; if empty but legacy single imageUrl exists, include it.
        List<ProductImage> entityImages = p.getImages();
        List<String> urls = entityImages.stream().map(ProductImage::getUrl).toList();
        if (urls.isEmpty() && p.getImageUrl() != null) {
            urls = List.of(p.getImageUrl());
        }
        String primary = !urls.isEmpty() ? urls.get(0) : p.getImageUrl();
        List<ProductImageResponse> images = entityImages.stream()
                .map(im -> new ProductImageResponse(im.getId(), im.getUrl(), im.getPosition()))
                .toList();
        // If no multi-image records but legacy imageUrl exists, expose it as a pseudo image (id null, position 0)
        if (images.isEmpty() && p.getImageUrl() != null) {
            images = List.of(new ProductImageResponse(null, p.getImageUrl(), 0));
        }
        return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getCategory() != null ? p.getCategory().getId() : null,
                p.getCategory() != null ? p.getCategory().getName() : null,
                p.getPrice(),
                p.getDescription(),
                primary,
                urls,
                images,
                p.getStock(),
                p.getUnit()
        );
    }
}