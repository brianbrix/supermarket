package com.example.supermarket.service;

import com.example.supermarket.domain.Category;
import com.example.supermarket.repository.CategoryRepository;
import com.example.supermarket.dto.CategoryRequest;
import com.example.supermarket.dto.CategoryResponse;
import com.example.supermarket.dto.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

    public List<Category> getAllCategories() {
        return categoryRepository.findAll();
    }

    public Optional<Category> getCategoryById(Long id) {
        return categoryRepository.findById(id);
    }

    public Category createCategory(Category category) { return categoryRepository.save(category); }

    public CategoryResponse createFromRequest(CategoryRequest req) {
        Category created = createCategory(new Category(req.name(), req.description()));
        return new CategoryResponse(created.getId(), created.getName(), created.getDescription(), 0L);
    }

    public Category updateCategory(Long id, Category categoryDetails) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Category not found with id: " + id));
        category.setName(categoryDetails.getName());
        category.setDescription(categoryDetails.getDescription());
        return categoryRepository.save(category);
    }

    public CategoryResponse updateFromRequest(Long id, CategoryRequest req) {
        Category updated = updateCategory(id, new Category(req.name(), req.description()));
        // product count not recalculated here (client can refresh list)
        return new CategoryResponse(updated.getId(), updated.getName(), updated.getDescription(), null);
    }

    public void deleteCategory(Long id) {
        categoryRepository.deleteById(id);
    }

    public Optional<Category> findByName(String name) {
        return categoryRepository.findByNameIgnoreCase(name);
    }

    public PageResponse<CategoryResponse> getPagedWithCounts(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Category> catPage = categoryRepository.findAll(pageable);
        // Build a map of counts (could optimize with single custom query if necessary)
        // For simplicity and moderate scale: reuse repository method for all counts and map.
        List<Object[]> withCounts = categoryRepository.fetchWithProductCounts();
        java.util.Map<Long, Long> countMap = withCounts.stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[3]));
        List<CategoryResponse> content = catPage.getContent().stream()
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getDescription(), countMap.getOrDefault(c.getId(), 0L)))
                .toList();
        return new PageResponse<>(content, page, size, catPage.getTotalElements(), catPage.getTotalPages(), catPage.isFirst(), catPage.isLast());
    }

    public PageResponse<CategoryResponse> searchPaged(String q, int page, int size, String sort, String direction) {
        String query = (q != null && !q.isBlank()) ? q.trim() : null;
        String property = (sort == null || sort.isBlank()) ? "name" : sort;
        if (!java.util.List.of("name","id").contains(property)) property = "name";
        boolean asc = direction == null || direction.equalsIgnoreCase("asc");
        Sort sortObj = asc ? Sort.by(property).ascending() : Sort.by(property).descending();
        Pageable pageable = PageRequest.of(Math.max(0,page), Math.min(size,100), sortObj);
        Page<Category> catPage = categoryRepository.searchCategories(query, pageable);
        // Preload counts once
        List<Object[]> withCounts = categoryRepository.fetchWithProductCounts();
        java.util.Map<Long, Long> countMap = withCounts.stream().collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[3]));
        List<CategoryResponse> content = catPage.getContent().stream()
            .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getDescription(), countMap.getOrDefault(c.getId(), 0L)))
            .toList();
        return new PageResponse<>(content, catPage.getNumber(), catPage.getSize(), catPage.getTotalElements(), catPage.getTotalPages(), catPage.isFirst(), catPage.isLast());
    }
}
