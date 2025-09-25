package com.example.supermarket.service;

import com.example.supermarket.domain.User;
import com.example.supermarket.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<User> getAll() { return userRepository.findAll(); }
    public Optional<User> getById(Long id) { return userRepository.findById(id); }
    public Optional<User> getByUsername(String username) { return userRepository.findByUsername(username); }
    public Optional<User> getByEmail(String email) { return userRepository.findByEmail(email); }

    public User create(User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    public User update(Long id, User details) {
        User user = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found with id: " + id));
        if (!user.getUsername().equals(details.getUsername()) && userRepository.existsByUsername(details.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (!user.getEmail().equals(details.getEmail()) && userRepository.existsByEmail(details.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }
        user.setUsername(details.getUsername());
        user.setEmail(details.getEmail());
        user.setFirstName(details.getFirstName());
        user.setLastName(details.getLastName());
        user.setRole(details.getRole());
        user.setActive(details.isActive());
        if (details.getPassword() != null && !details.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(details.getPassword()));
        }
        return userRepository.save(user);
    }

    public void delete(Long id) {
        userRepository.delete(userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found with id: " + id)));
    }

    public Optional<User> authenticate(String username, String rawPassword) {
        return userRepository.findByUsername(username)
                .filter(User::isActive)
                .filter(u -> passwordEncoder.matches(rawPassword, u.getPassword()))
                .map(u -> { u.setLastLogin(OffsetDateTime.now()); return userRepository.save(u); });
    }

    /**
     * Persist changes to an existing user. Does NOT perform uniqueness checks or encode password.
     * Caller is responsible for ensuring password already encoded and fields validated.
     */
    public User save(User user) {
        return userRepository.save(user);
    }
}
