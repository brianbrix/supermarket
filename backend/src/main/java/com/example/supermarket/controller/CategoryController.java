package com.example.supermarket.controller;

import com.example.supermarket.dto.*;
import com.example.supermarket.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping
@CrossOrigin(origins = "*")
public class CategoryController {

    @Autowired
    private CategoryService categoryService;

    // Public simple list (no pagination) retains old behavior
    @GetMapping("/api/categories")
    public List<CategoryResponse> listAll() {
        return categoryService.getAllCategories().stream()
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getDescription(), null))
                .toList();
    }

    // Admin paginated with counts
    @GetMapping("/api/admin/categories")
    public PageResponse<CategoryResponse> paged(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "10") int size) {
        return categoryService.getPagedWithCounts(page, size);
    }

    @GetMapping("/api/admin/categories/search")
    public PageResponse<CategoryResponse> search(@RequestParam(name = "q", required = false) String q,
                                                 @RequestParam(name = "page", defaultValue = "0") int page,
                                                 @RequestParam(name = "size", defaultValue = "10") int size,
                                                 @RequestParam(name = "sort", defaultValue = "name") String sort,
                                                 @RequestParam(name = "direction", defaultValue = "asc") String direction) {
        return categoryService.searchPaged(q, page, size, sort, direction);
    }

    @PostMapping("/api/admin/categories")
    public ResponseEntity<CategoryResponse> create(@RequestBody CategoryRequest req) {
        CategoryResponse created = categoryService.createFromRequest(req);
    return ResponseEntity.created(URI.create("/api/admin/categories/" + created.getId())).body(created);
    }

    @PutMapping("/api/admin/categories/{id}")
    public ResponseEntity<CategoryResponse> update(@PathVariable Long id, @RequestBody CategoryRequest req) {
        try {
            return ResponseEntity.ok(categoryService.updateFromRequest(id, req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/api/admin/categories/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        try {
            categoryService.deleteCategory(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
