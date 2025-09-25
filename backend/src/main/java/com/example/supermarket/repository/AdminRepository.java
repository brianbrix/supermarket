package com.example.supermarket.repository;

import com.example.supermarket.domain.Admin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminRepository extends JpaRepository<Admin, Long> {
    
    Optional<Admin> findByUsername(String username);
    
    Optional<Admin> findByEmail(String email);
    
    Optional<Admin> findByUsernameAndPassword(String username, String password);
    
    List<Admin> findByActiveTrue();
    
    List<Admin> findByRole(Admin.AdminRole role);
    
    boolean existsByUsername(String username);
    
    boolean existsByEmail(String email);
    
    @Query("SELECT a FROM Admin a WHERE a.active = true ORDER BY a.createdAt DESC")
    List<Admin> findAllActiveAdminsOrderByCreatedAt();
}