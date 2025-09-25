package com.example.supermarket.service;

import com.example.supermarket.domain.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PasswordResetService {
    private static final Duration EXPIRY = Duration.ofMinutes(30);

    private static class TokenEntry {
        final String email;
        final Instant expiresAt;
        TokenEntry(String email, Instant expiresAt) { this.email = email; this.expiresAt = expiresAt; }
        boolean expired() { return Instant.now().isAfter(expiresAt); }
    }

    private final Map<String, TokenEntry> tokens = new ConcurrentHashMap<>();
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public PasswordResetService(UserService userService, PasswordEncoder passwordEncoder) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    public String createToken(String email) {
        // Create even if email not found to avoid user enumeration timing differences
        var token = UUID.randomUUID().toString();
        tokens.put(token, new TokenEntry(email, Instant.now().plus(EXPIRY)));
        return token;
    }

    public boolean resetPassword(String token, String newPassword) {
        var entry = tokens.remove(token);
        if (entry == null || entry.expired()) {
            return false;
        }
        Optional<User> userOpt = userService.getByEmail(entry.email);
        if (userOpt.isEmpty()) {
            return true; // treat as success (don't leak existence)
        }
        User user = userOpt.get();
        user.setPassword(passwordEncoder.encode(newPassword));
        userService.save(user);
        return true;
    }
}
