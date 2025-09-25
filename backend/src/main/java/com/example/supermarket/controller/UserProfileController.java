package com.example.supermarket.controller;

import com.example.supermarket.domain.User;
import com.example.supermarket.dto.UserResponse;
import com.example.supermarket.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "*")
public class UserProfileController {

    private final UserService userService;

    public UserProfileController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        return userService.getByUsername(auth.getName())
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(new UserResponse(u)))
                .orElseGet(() -> ResponseEntity.status(404).body("User not found"));
    }
}
