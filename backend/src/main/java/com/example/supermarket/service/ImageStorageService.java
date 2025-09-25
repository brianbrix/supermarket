package com.example.supermarket.service;

import com.example.supermarket.config.ImageStorageProperties;
import com.example.supermarket.exception.BadRequestException;
import com.example.supermarket.exception.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;

@Service
public class ImageStorageService {

    private final Path storageRoot;
    private final String publicPath;

    @Autowired
    public ImageStorageService(ImageStorageProperties properties) throws IOException {
        this.storageRoot = Paths.get(properties.getDirectory()).toAbsolutePath().normalize();
        this.publicPath = properties.getPublicPath();
        Files.createDirectories(storageRoot);
    }

    public String store(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("Empty file");
        }
    String providedName = file.getOriginalFilename();
    if (providedName == null || providedName.isBlank()) providedName = "image";
    String original = StringUtils.cleanPath(providedName);
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.')) : "";
        if (ext.length() > 10) ext = ""; // safety
        String filename = Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + ext;
        Path target = storageRoot.resolve(filename);
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
        return publicPath.endsWith("/") ? publicPath + filename : publicPath + "/" + filename;
    }

    public Resource loadAsResource(String filename) {
        try {
            Path file = storageRoot.resolve(filename).normalize();
            if (!Files.exists(file)) throw new NotFoundException("File not found");
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) return resource;
            throw new NotFoundException("File not readable");
        } catch (MalformedURLException e) {
            throw new NotFoundException("File not found");
        }
    }
}
