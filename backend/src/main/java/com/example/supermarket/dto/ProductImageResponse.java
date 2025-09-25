package com.example.supermarket.dto;

public record ProductImageResponse(
        Long id,
        String url,
        Integer position
) {}
