package com.example.supermarket.dto;

import jakarta.validation.constraints.NotBlank;

public class PasswordResetConfirmRequest {
    @NotBlank
    private String token;
    @NotBlank
    private String newPassword;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
