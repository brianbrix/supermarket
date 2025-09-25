package com.example.supermarket.service;

import com.example.supermarket.domain.Product;
import com.example.supermarket.domain.ProductImage;
import com.example.supermarket.dto.ProductResponse;
import com.example.supermarket.mapper.ProductMapper;
import com.example.supermarket.repository.ProductImageRepository;
import com.example.supermarket.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class ProductImageService {
    private static final int MAX_IMAGES = 5;
    private final ProductRepository productRepository;
    private final ProductImageRepository productImageRepository;
    private final ImageStorageService imageStorageService;
    private final ProductMapper productMapper;

    public ProductImageService(ProductRepository productRepository,
                               ProductImageRepository productImageRepository,
                               ImageStorageService imageStorageService,
                               ProductMapper productMapper) {
        this.productRepository = productRepository;
        this.productImageRepository = productImageRepository;
        this.imageStorageService = imageStorageService;
        this.productMapper = productMapper;
    }

    @Transactional
    public ProductResponse addImages(Long productId, List<MultipartFile> files) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        long existing = productImageRepository.countByProductId(productId);
        if (existing >= MAX_IMAGES) {
            throw new IllegalStateException("Maximum images reached");
        }
        int canAdd = (int) (MAX_IMAGES - existing);
        List<MultipartFile> toProcess = files.stream().limit(canAdd).toList();
        int nextPosition = (int) existing; // 0-based
        for (MultipartFile mf : toProcess) {
            String url = imageStorageService.store(mf);
            ProductImage pi = new ProductImage();
            pi.setProduct(product);
            pi.setUrl(url);
            pi.setPosition(nextPosition++);
            productImageRepository.save(pi);
            // maintain legacy single imageUrl using first image if absent
            if (product.getImageUrl() == null) {
                product.setImageUrl(url);
            }
        }
        // refresh product with images collection
        Product refreshed = productRepository.findById(productId).orElseThrow();
        return productMapper.toResponse(refreshed);
    }

    @Transactional
    public ProductResponse deleteImage(Long productId, Long imageId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        ProductImage img = productImageRepository.findById(imageId)
                .orElseThrow(() -> new IllegalArgumentException("Image not found"));
        if (!img.getProduct().getId().equals(productId)) {
            throw new IllegalArgumentException("Image does not belong to product");
        }
        productImageRepository.delete(img);
        // Re-pack positions
        List<ProductImage> remaining = productImageRepository.findByProductIdOrderByPositionAscIdAsc(productId);
        int pos = 0;
        for (ProductImage pi : remaining) {
            if (pi.getPosition() != pos) {
                pi.setPosition(pos);
                productImageRepository.save(pi);
            }
            pos++;
        }
        // Update legacy imageUrl to first remaining or null
        if (remaining.isEmpty()) {
            product.setImageUrl(null);
        } else {
            product.setImageUrl(remaining.get(0).getUrl());
        }
        productRepository.save(product);
        Product refreshed = productRepository.findById(productId).orElseThrow();
        return productMapper.toResponse(refreshed);
    }
}