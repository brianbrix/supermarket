package com.example.supermarket.config;

import com.example.supermarket.domain.User;
import com.example.supermarket.domain.Product;
import com.example.supermarket.repository.UserRepository;
import com.example.supermarket.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private com.example.supermarket.repository.CategoryRepository categoryRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public void run(String... args) {
        // Only initialize data if the database is empty
        if (productRepository.count() == 0) {
            initializeProducts();
        }
        
        // Initialize default admin user
        if (userRepository.count() == 0) {
            initializeDefaultAdmin();
        }
    }

    private void initializeProducts() {

    // Create categories
    var staples = categoryRepository.save(new com.example.supermarket.domain.Category("Staples"));
    var vegetables = categoryRepository.save(new com.example.supermarket.domain.Category("Vegetables"));
    var dairy = categoryRepository.save(new com.example.supermarket.domain.Category("Dairy"));
    var bakery = categoryRepository.save(new com.example.supermarket.domain.Category("Bakery"));

    // Create sample products matching the frontend data, referencing Category entities
    Product unga = new Product(
        "Unga wa Mahindi 2kg",
        staples,
        new BigDecimal("230"),
        "High-quality maize flour, perfect for ugali and baking.",
        "https://example.com/images/unga-2kg.jpg"
        , 100, "2kg"
    );

    Product sukuma = new Product(
        "Sukuma Wiki Bunch",
        vegetables,
        new BigDecimal("35"),
        "Fresh sukuma wiki (collard greens) bunch, locally grown.",
        "https://example.com/images/sukuma.jpg"
        , 100, "1 bunch"
    );

    Product maziwa = new Product(
        "Maziwa Fresh 500ml",
        dairy,
        new BigDecimal("65"),
        "Pasteurized fresh milk in 500ml pack.",
        "https://example.com/images/maziwa-500ml.jpg"
        , 100, "500ml packet"
    );

    Product mandazi = new Product(
        "Mandazi Pack (4)",
        bakery,
        new BigDecimal("120"),
        "Soft and sweet mandazi pack of 4, freshly baked.",
        "https://example.com/images/mandazi-4.jpg",
        100,
        "4 pieces"
    );

    productRepository.save(unga);
    productRepository.save(sukuma);
    productRepository.save(maziwa);
    productRepository.save(mandazi);

        System.out.println("Sample products initialized successfully!");
    }

    private void initializeDefaultAdmin() {
        User defaultAdmin = new User(
                "admin",
                "admin@supermarket.com",
                // NOTE: initial plain password; login flow still allows plain match fallback. Will be migrated to encoded after first login or future migration.
                "admin123",
                "System",
                "Administrator",
                User.Role.SUPER_ADMIN
        );
        userRepository.save(defaultAdmin);
        System.out.println("Default admin (user) created - Username: admin, Password: admin123");
    }
}