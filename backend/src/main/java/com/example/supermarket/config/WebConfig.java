package com.example.supermarket.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.images.directory:uploads}")
    private String imagesDir;

    @Value("${app.images.public-path:/images}")
    private String publicPath;

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        // Ensure path pattern ends with /**
        String pattern = publicPath.endsWith("/") ? publicPath + "**" : publicPath + "/**";
        Path uploadPath = Paths.get(imagesDir).toAbsolutePath().normalize();
        String location = uploadPath.toUri().toString(); // file:/.../
        registry.addResourceHandler(pattern)
                .addResourceLocations(location)
                .setCachePeriod(3600);
    }
}
