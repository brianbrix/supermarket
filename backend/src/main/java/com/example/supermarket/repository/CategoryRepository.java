package com.example.supermarket.repository;

import com.example.supermarket.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    Optional<Category> findByNameIgnoreCase(String name);

    @Query("select c.id as id, c.name as name, c.description as description, count(p.id) as productCount " +
            "from Category c left join Product p on p.category = c group by c.id, c.name, c.description")
    List<Object[]> fetchWithProductCounts();

    @Query("""
        SELECT c FROM Category c
        WHERE (:q IS NULL OR 
              LOWER(COALESCE(c.name,'')) LIKE CONCAT('%', LOWER(:q), '%') OR 
              LOWER(COALESCE(c.description,'')) LIKE CONCAT('%', LOWER(:q), '%'))
    """)
    Page<Category> searchCategories(@Param("q") String q, Pageable pageable);
}
