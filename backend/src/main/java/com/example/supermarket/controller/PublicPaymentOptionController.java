package com.example.supermarket.controller;

import com.example.supermarket.dto.PaymentOptionResponse;
import com.example.supermarket.service.PaymentOptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments/options")
@CrossOrigin(origins = "*")
public class PublicPaymentOptionController {

    @Autowired
    private PaymentOptionService service;

    @GetMapping
    public ResponseEntity<List<PaymentOptionResponse>> active() {
        return ResponseEntity.ok(service.listActive());
    }
}
