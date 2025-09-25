package com.example.supermarket.repository;

import com.example.supermarket.domain.Order;
import com.example.supermarket.domain.User;
import java.util.List;
import java.math.BigDecimal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

public interface OrderRepository extends JpaRepository<Order, Long>, OrderRepositoryCustom {
	List<Order> findByUser(User user);
	Page<Order> findByUser(User user, Pageable pageable);

	long countByStatus(Order.OrderStatus status);

	@Query("SELECT COALESCE(SUM(o.totalGross), 0) FROM Order o")
	BigDecimal sumTotalGross();

	// Revenue per day since a cutoff timestamp (grouped by year/month/day for JPQL portability across H2 & Postgres)
	@Query("SELECT YEAR(o.createdAt), MONTH(o.createdAt), DAY(o.createdAt), COALESCE(SUM(o.totalGross),0) FROM Order o WHERE o.createdAt >= :cutoff GROUP BY YEAR(o.createdAt), MONTH(o.createdAt), DAY(o.createdAt) ORDER BY YEAR(o.createdAt), MONTH(o.createdAt), DAY(o.createdAt)")
	List<Object[]> revenueTrendSince(@org.springframework.data.repository.query.Param("cutoff") java.time.OffsetDateTime cutoff);

	// Top selling products by quantity across order items
	@Query("SELECT oi.product.id, oi.product.name, SUM(oi.quantity) as qty FROM OrderItem oi GROUP BY oi.product.id, oi.product.name ORDER BY qty DESC")
	List<Object[]> topSellingProducts();

	// Lightweight projection for AOV calculations (createdAt + totalGross only)
	@Query("SELECT o.createdAt, o.totalGross FROM Order o WHERE o.createdAt >= :start AND o.status NOT IN :excluded ORDER BY o.createdAt ASC")
	List<Object[]> findForAovSince(@org.springframework.data.repository.query.Param("start") java.time.OffsetDateTime start,
			@org.springframework.data.repository.query.Param("excluded") List<Order.OrderStatus> excluded);

	// Dynamic search implemented via custom repository implementation (OrderRepositoryImpl)
	Page<Order> searchOrders(Order.OrderStatus status,
	                       java.time.OffsetDateTime from,
	                       java.time.OffsetDateTime to,
	                       java.math.BigDecimal minTotal,
	                       java.math.BigDecimal maxTotal,
	                       String q,
	                       Pageable pageable);
}
