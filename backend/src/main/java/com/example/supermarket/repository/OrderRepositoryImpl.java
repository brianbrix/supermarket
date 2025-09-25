package com.example.supermarket.repository;

import com.example.supermarket.domain.Order;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Repository
public class OrderRepositoryImpl implements OrderRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    public Page<Order> searchOrders(Order.OrderStatus status,
                                    OffsetDateTime from,
                                    OffsetDateTime to,
                                    BigDecimal minTotal,
                                    BigDecimal maxTotal,
                                    String q,
                                    Pageable pageable) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Order> cq = cb.createQuery(Order.class);
        Root<Order> root = cq.from(Order.class);

        List<Predicate> predicates = new ArrayList<>();

        if (status != null) {
            predicates.add(cb.equal(root.get("status"), status));
        }
        if (from != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }
        if (to != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }
        if (minTotal != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("totalGross"), minTotal));
        }
        if (maxTotal != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("totalGross"), maxTotal));
        }
        if (q != null && !q.isBlank()) {
            String pattern = "%" + q.toLowerCase() + "%";
            Expression<String> nameExpr = cb.lower(cb.coalesce(root.get("customerName"), ""));
            Expression<String> phoneExpr = cb.lower(cb.coalesce(root.get("customerPhone"), ""));
            predicates.add(cb.or(cb.like(nameExpr, pattern), cb.like(phoneExpr, pattern)));
        }

        cq.where(predicates.toArray(new Predicate[0]));
        // Order
        cq.orderBy(cb.desc(root.get("createdAt")));

        TypedQuery<Order> query = em.createQuery(cq);
        // Pagination
        query.setFirstResult((int) pageable.getOffset());
        query.setMaxResults(pageable.getPageSize());
        List<Order> content = query.getResultList();

        // Count query
        CriteriaQuery<Long> countCq = cb.createQuery(Long.class);
        Root<Order> countRoot = countCq.from(Order.class);
        countCq.select(cb.count(countRoot));
        // Rebuild same predicates for count
        List<Predicate> countPredicates = new ArrayList<>();
        if (status != null) {
            countPredicates.add(cb.equal(countRoot.get("status"), status));
        }
        if (from != null) {
            countPredicates.add(cb.greaterThanOrEqualTo(countRoot.get("createdAt"), from));
        }
        if (to != null) {
            countPredicates.add(cb.lessThanOrEqualTo(countRoot.get("createdAt"), to));
        }
        if (minTotal != null) {
            countPredicates.add(cb.greaterThanOrEqualTo(countRoot.get("totalGross"), minTotal));
        }
        if (maxTotal != null) {
            countPredicates.add(cb.lessThanOrEqualTo(countRoot.get("totalGross"), maxTotal));
        }
        if (q != null && !q.isBlank()) {
            String pattern = "%" + q.toLowerCase() + "%";
            Expression<String> nameExpr = cb.lower(cb.coalesce(countRoot.get("customerName"), ""));
            Expression<String> phoneExpr = cb.lower(cb.coalesce(countRoot.get("customerPhone"), ""));
            countPredicates.add(cb.or(cb.like(nameExpr, pattern), cb.like(phoneExpr, pattern)));
        }
        countCq.where(countPredicates.toArray(new Predicate[0]));
        Long total = em.createQuery(countCq).getSingleResult();

        return new PageImpl<>(content, pageable, total);
    }
}
