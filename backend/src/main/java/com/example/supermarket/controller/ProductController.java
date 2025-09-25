package com.example.supermarket.controller;

import com.example.supermarket.dto.ProductRequest;
import com.example.supermarket.dto.ProductResponse;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.service.ProductService;
import com.example.supermarket.service.ProductImageService;
import com.example.supermarket.service.ImageStorageService;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
public class ProductController {

    @Autowired
    private ProductService productService;
    @Autowired
    private ImageStorageService imageStorageService;

    @Autowired
    private ProductImageService productImageService;
    // no categoryService here - business logic lives in ProductService

    @GetMapping
    public PageResponse<ProductResponse> getAllProducts(@RequestParam(name = "page", defaultValue = "0") int page,
                                                        @RequestParam(name = "size", defaultValue = "10") int size,
                                                        @RequestParam(name = "sort", defaultValue = "name") String sort,
                                                        @RequestParam(name = "direction", defaultValue = "asc") String direction) {
        return productService.getAllPaged(page, size, sort, direction);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getProductById(@PathVariable Long id) {
        return productService.getProductResponseById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/category/{category}")
    public List<ProductResponse> getProductsByCategory(@PathVariable String category) {
        return productService.getProductResponsesByCategory(category);
    }

    @GetMapping("/search")
    public PageResponse<ProductResponse> searchProducts(@RequestParam(name = "q", required = false) String q,
                                                @RequestParam(name = "categoryId", required = false) Long categoryId,
                                                @RequestParam(name = "minPrice", required = false) BigDecimal minPrice,
                                                @RequestParam(name = "maxPrice", required = false) BigDecimal maxPrice,
                                                @RequestParam(name = "inStock", required = false) Boolean inStock,
                                                @RequestParam(name = "page", defaultValue = "0") int page,
                                                @RequestParam(name = "size", defaultValue = "10") int size,
                                                @RequestParam(name = "sort", defaultValue = "name") String sort,
                                                @RequestParam(name = "direction", defaultValue = "asc") String direction) {
        return productService.searchPaged(q, categoryId, minPrice, maxPrice, inStock, page, size, sort, direction);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(@RequestBody ProductRequest req) {
        return ResponseEntity.status(201).body(productService.createResponse(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> updateProduct(@PathVariable Long id, @RequestBody ProductRequest productDetails) {
        try {
            return ResponseEntity.ok(productService.updateResponse(id, productDetails));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping(value = "/{id}/image", consumes = {"multipart/form-data"})
    public ResponseEntity<ProductResponse> uploadImage(@PathVariable Long id, @RequestPart("file") MultipartFile file) {
        // Store image and update product
        String imageUrl = imageStorageService.store(file);
        // reuse update logic: create a minimal ProductRequest carrying new imageUrl (keep existing fields)
        return productService.getProductById(id)
                .map(existing -> {
                    ProductRequest req = new ProductRequest(
                            existing.getName(),
                            existing.getCategory() != null ? existing.getCategory().getId() : null,
                            existing.getPrice(),
                            existing.getDescription(),
                imageUrl,
                existing.getStock(),
                existing.getUnit()
                    );
                    return ResponseEntity.ok(productService.updateResponse(id, req));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Multi-image: upload one or many (append) enforcing max 5
    @PostMapping(value = "/{id}/images", consumes = {"multipart/form-data"})
    public ResponseEntity<ProductResponse> uploadImages(@PathVariable Long id, @RequestPart("files") List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            ProductResponse updated = productImageService.addImages(id, files);
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).build(); // conflict (limit reached)
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{productId}/images/{imageId}")
    public ResponseEntity<ProductResponse> deleteImage(@PathVariable Long productId, @PathVariable Long imageId) {
        try {
            ProductResponse updated = productImageService.deleteImage(productId, imageId);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        try {
            productService.deleteProduct(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}