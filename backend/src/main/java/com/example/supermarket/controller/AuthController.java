package com.example.supermarket.controller;

import com.example.supermarket.domain.User;
import com.example.supermarket.dto.LoginRequest;
import com.example.supermarket.dto.UserResponse;
import com.example.supermarket.dto.RegisterRequest;
import com.example.supermarket.dto.ChangePasswordRequest;
import com.example.supermarket.dto.PasswordResetRequest;
import com.example.supermarket.dto.PasswordResetConfirmRequest;
import com.example.supermarket.security.JwtTokenProvider;
import com.example.supermarket.service.UserService;
import com.example.supermarket.service.PasswordResetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetService passwordResetService;

    public AuthController(UserService userService, JwtTokenProvider jwtTokenProvider, PasswordEncoder passwordEncoder, PasswordResetService passwordResetService) {
        this.userService = userService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        return userService.getByUsername(request.getUsername())
                .filter(User::isActive)
                .filter(u -> passwordEncoder.matches(request.getPassword(), u.getPassword()) || u.getPassword().equals(request.getPassword())) // fallback in case legacy plain text exists
                .map(user -> {
                    Map<String, Object> claims = new HashMap<>();
                    claims.put("role", user.getRole().name());
                    String token = jwtTokenProvider.generateToken(user.getUsername(), claims);
                    Map<String, Object> body = new HashMap<>();
                    body.put("token", token);
                    UserResponse resp = new UserResponse(user);
                    body.put("user", resp);
                    return ResponseEntity.ok(body);
                })
                .orElseGet(() -> {
                    Map<String, Object> error = new HashMap<>();
                    error.put("error", "Invalid credentials");
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
                });
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (userService.getByUsername(req.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username already taken"));
        }
        if (userService.getByEmail(req.getEmail()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email already registered"));
        }
        User user = new User(
                req.getUsername(),
                req.getEmail(),
                passwordEncoder.encode(req.getPassword()),
                req.getFirstName(),
                req.getLastName(),
                User.Role.CUSTOMER
        );
        User created = userService.create(user);
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", created.getRole().name());
        String token = jwtTokenProvider.generateToken(created.getUsername(), claims);
        UserResponse resp = new UserResponse(created);
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
        "token", token,
        "user", resp
    ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        var userOpt = userService.getByUsername(auth.getName());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }
        var user = userOpt.get();
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Current password incorrect"));
        }
        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userService.save(user);
        return ResponseEntity.ok(Map.of("message", "Password changed"));
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> requestPasswordReset(@Valid @RequestBody PasswordResetRequest req) {
        // Generate token regardless of user existence to prevent enumeration
        String token = passwordResetService.createToken(req.getEmail());
        // For now we just return token (in real system we would email it). Mark as TODO for production.
        return ResponseEntity.ok(Map.of("message", "If the email exists a reset link has been sent", "debugToken", token));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest req) {
        boolean success = passwordResetService.resetPassword(req.getToken(), req.getNewPassword());
        if (!success) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid or expired token"));
        }
        return ResponseEntity.ok(Map.of("message", "Password reset successful"));
    }
}
