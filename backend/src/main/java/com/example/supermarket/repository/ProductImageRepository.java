package com.example.supermarket.repository;

import com.example.supermarket.domain.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    @Query("select count(pi) from ProductImage pi where pi.product.id = :productId")
    long countByProductId(@Param("productId") Long productId);
    List<ProductImage> findByProductIdOrderByPositionAscIdAsc(Long productId);
}