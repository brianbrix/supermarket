package com.example.supermarket.controller;

import com.example.supermarket.dto.PaymentOptionAdminRequest;
import com.example.supermarket.dto.PaymentOptionResponse;
import com.example.supermarket.service.PaymentOptionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/payments/options")
@CrossOrigin(origins = "*")
public class AdminPaymentOptionController {

    @Autowired
    private PaymentOptionService service;

    @PostMapping
    public ResponseEntity<PaymentOptionResponse> create(@Valid @RequestBody PaymentOptionAdminRequest req) {
        return ResponseEntity.ok(service.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PaymentOptionResponse> update(@PathVariable Long id, @Valid @RequestBody PaymentOptionAdminRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<PaymentOptionResponse>> list(@RequestParam(name = "active", required = false) Boolean active) {
        return ResponseEntity.ok(service.listAll(active));
    }
}
