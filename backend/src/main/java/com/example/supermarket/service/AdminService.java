package com.example.supermarket.service;

import com.example.supermarket.domain.Admin;
import com.example.supermarket.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class AdminService {

    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;

    @Autowired
    public AdminService(AdminRepository adminRepository, PasswordEncoder passwordEncoder) {
        this.adminRepository = adminRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<Admin> getAllAdmins() {
        return adminRepository.findAll();
    }

    public List<Admin> getActiveAdmins() {
        return adminRepository.findByActiveTrue();
    }

    public Optional<Admin> getAdminById(Long id) {
        return adminRepository.findById(id);
    }

    public Optional<Admin> getAdminByUsername(String username) {
        return adminRepository.findByUsername(username);
    }

    public Optional<Admin> getAdminByEmail(String email) {
        return adminRepository.findByEmail(email);
    }

    public Admin createAdmin(Admin admin) {
        if (adminRepository.existsByUsername(admin.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (adminRepository.existsByEmail(admin.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }
        
        // In a real application, you would hash the password here
        // admin.setPassword(passwordEncoder.encode(admin.getPassword()));
        
        return adminRepository.save(admin);
    }

    // Initialize default admin if none exists
    @jakarta.annotation.PostConstruct
    public void initDefaultAdmin() {
        if (adminRepository.count() == 0) {
            Admin admin = new Admin("admin", "admin@example.com", passwordEncoder.encode("admin"), "Default", "Admin");
            adminRepository.save(admin);
        }
    }

    public Admin updateAdmin(Long id, Admin adminDetails) {
        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found with id: " + id));

        // Check if username is being changed and if it already exists
        if (!admin.getUsername().equals(adminDetails.getUsername()) 
            && adminRepository.existsByUsername(adminDetails.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }

        // Check if email is being changed and if it already exists
        if (!admin.getEmail().equals(adminDetails.getEmail()) 
            && adminRepository.existsByEmail(adminDetails.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        admin.setUsername(adminDetails.getUsername());
        admin.setEmail(adminDetails.getEmail());
        admin.setFirstName(adminDetails.getFirstName());
        admin.setLastName(adminDetails.getLastName());
        admin.setRole(adminDetails.getRole());
        admin.setActive(adminDetails.isActive());

        // Only update password if it's provided and not empty
        if (adminDetails.getPassword() != null && !adminDetails.getPassword().trim().isEmpty()) {
            admin.setPassword(adminDetails.getPassword());
        }

        return adminRepository.save(admin);
    }

    public void deleteAdmin(Long id) {
        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found with id: " + id));
        adminRepository.delete(admin);
    }

    public void deactivateAdmin(Long id) {
        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found with id: " + id));
        admin.setActive(false);
        adminRepository.save(admin);
    }

    public void activateAdmin(Long id) {
        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found with id: " + id));
        admin.setActive(true);
        adminRepository.save(admin);
    }

    // Simple authentication method (in production, use Spring Security)
    public Optional<Admin> authenticate(String username, String password) {
        return adminRepository.findByUsernameAndPassword(username, password)
                .filter(Admin::isActive)
                .map(admin -> {
                    admin.setLastLogin(OffsetDateTime.now());
                    return adminRepository.save(admin);
                });
    }

    public boolean isUsernameAvailable(String username) {
        return !adminRepository.existsByUsername(username);
    }

    public boolean isEmailAvailable(String email) {
        return !adminRepository.existsByEmail(email);
    }
}