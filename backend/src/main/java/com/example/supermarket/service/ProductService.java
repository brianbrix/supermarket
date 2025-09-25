package com.example.supermarket.service;

import com.example.supermarket.domain.Product;
import com.example.supermarket.dto.ProductRequest;
import com.example.supermarket.dto.ProductResponse;
import com.example.supermarket.domain.Category;
import com.example.supermarket.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import com.example.supermarket.dto.PageResponse;
import com.example.supermarket.mapper.ProductMapper;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryService categoryService;

    @Autowired
    private ProductMapper productMapper;

    public List<Product> getAllProducts() { return productRepository.findAll(); }

    public List<ProductResponse> getAllProductResponses() { return getAllProducts().stream().map(productMapper::toResponse).toList(); }

    public PageResponse<ProductResponse> getAllPaged(int page, int size, String sort, String direction) {
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
        Page<Product> p = productRepository.findAll(pageable);
        List<ProductResponse> content = p.getContent().stream().map(productMapper::toResponse).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isFirst(), p.isLast());
    }

    public Optional<Product> getProductById(Long id) {
        return productRepository.findById(id);
    }

    public Optional<ProductResponse> getProductResponseById(Long id) { return getProductById(id).map(productMapper::toResponse); }

    public Product saveProduct(Product product) {
        return productRepository.save(product);
    }

    public ProductResponse toResponse(Product p) { return productMapper.toResponse(p); }

    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found with id: " + id));
        productRepository.delete(product);
    }

    public List<Product> getProductsByCategory(String categoryName) {
    return categoryService.findByName(categoryName)
        .map(cat -> productRepository.findByCategoryId(cat.getId()))
        .orElse(List.of());
    }

    public List<ProductResponse> getProductResponsesByCategory(String categoryName) { return getProductsByCategory(categoryName).stream().map(productMapper::toResponse).toList(); }

    // Create from DTO, resolving category by id
    public Product createFromRequest(ProductRequest req) {
        Category category = null;
        if (req.categoryId() != null) {
            category = categoryService.getCategoryById(req.categoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + req.categoryId()));
        }
        Integer stock = req.stock() != null ? Math.max(0, req.stock()) : 0;
        String unit = req.unit() != null ? req.unit().trim() : null;
        Product p = new Product(req.name(), category, req.price(), req.description(), req.imageUrl(), stock, unit);
        return productRepository.save(p);
    }

    public ProductResponse createResponse(ProductRequest req) {
        return productMapper.toResponse(createFromRequest(req));
    }

    public Product updateFromRequest(Long id, ProductRequest req) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found with id: " + id));
        product.setName(req.name());
        if (req.categoryId() != null) {
            Category category = categoryService.getCategoryById(req.categoryId())
                    .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + req.categoryId()));
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }
        product.setPrice(req.price());
        product.setDescription(req.description());
        product.setImageUrl(req.imageUrl());
        if (req.stock() != null) {
            product.setStock(Math.max(0, req.stock()));
        }
        if (req.unit() != null) {
            product.setUnit(req.unit().trim());
        } else {
            product.setUnit(null); // allow clearing
        }
        return productRepository.save(product);
    }

    public ProductResponse updateResponse(Long id, ProductRequest req) {
        return productMapper.toResponse(updateFromRequest(id, req));
    }

    public List<ProductResponse> search(String q, Long categoryId, BigDecimal minPrice, BigDecimal maxPrice, Boolean inStock) {
        // Delegate to pageable method with large page to preserve compatibility
    PageResponse<ProductResponse> pr = searchPaged(q, categoryId, minPrice, maxPrice, inStock, 0, 10_000, null, null);
        return pr.content();
    }

    public PageResponse<ProductResponse> searchPaged(String q, Long categoryId, BigDecimal minPrice, BigDecimal maxPrice, Boolean inStock, int page, int size, String sort, String direction) {
        String query = (q != null && !q.isBlank()) ? q.trim() : null;
        Sort sortObj = buildSort(sort, direction);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100), sortObj);
        Page<Product> result;
        if (query == null) {
            result = productRepository.searchProductsWithoutQuery(categoryId, minPrice, maxPrice, inStock, pageable);
        } else {
            result = productRepository.searchProductsWithQuery(query.toLowerCase(), categoryId, minPrice, maxPrice, inStock, pageable);
        }
        List<ProductResponse> content = result.getContent().stream().map(productMapper::toResponse).toList();
        return new PageResponse<>(content, result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(), result.isFirst(), result.isLast());
    }

    private Sort buildSort(String sort, String direction) {
        String property = (sort == null || sort.isBlank()) ? "name" : sort;
        // Whitelist allowable sort properties
        if (!List.of("name","price","stock","id").contains(property)) {
            property = "name";
        }
        Sort base = Sort.by(property);
        boolean asc = direction == null || direction.equalsIgnoreCase("asc");
        return asc ? base.ascending() : base.descending();
    }
}