package com.example.supermarket.repository;

import com.example.supermarket.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
	List<Product> findByCategoryId(Long categoryId);

	// Low stock (threshold inclusive)
	List<Product> findTop10ByStockLessThanEqualOrderByStockAsc(Integer threshold);

		@Query("""
				SELECT p FROM Product p
				WHERE (LOWER(COALESCE(p.name,'')) LIKE CONCAT('%', :qLower, '%') OR LOWER(COALESCE(p.description,'')) LIKE CONCAT('%', :qLower, '%'))
					AND (:categoryId IS NULL OR p.category.id = :categoryId)
					AND (:minPrice IS NULL OR p.price >= :minPrice)
					AND (:maxPrice IS NULL OR p.price <= :maxPrice)
					AND (:inStock IS NULL OR (:inStock = TRUE AND p.stock > 0) OR (:inStock = FALSE AND p.stock = 0))
		""")
		Page<Product> searchProductsWithQuery(
						@Param("qLower") String qLower,
						@Param("categoryId") Long categoryId,
						@Param("minPrice") BigDecimal minPrice,
						@Param("maxPrice") BigDecimal maxPrice,
						@Param("inStock") Boolean inStock,
						Pageable pageable
		);

		@Query("""
				SELECT p FROM Product p
				WHERE (:categoryId IS NULL OR p.category.id = :categoryId)
					AND (:minPrice IS NULL OR p.price >= :minPrice)
					AND (:maxPrice IS NULL OR p.price <= :maxPrice)
					AND (:inStock IS NULL OR (:inStock = TRUE AND p.stock > 0) OR (:inStock = FALSE AND p.stock = 0))
		""")
		Page<Product> searchProductsWithoutQuery(
						@Param("categoryId") Long categoryId,
						@Param("minPrice") BigDecimal minPrice,
						@Param("maxPrice") BigDecimal maxPrice,
						@Param("inStock") Boolean inStock,
						Pageable pageable
		);
}
