package com.example.supermarket.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.images")
public class ImageStorageProperties {
    /** Base directory on disk where images are stored */
    private String directory = "uploads";
    /** Public base URL prefix (e.g., /images) */
    private String publicPath = "/images";

    public String getDirectory() { return directory; }
    public void setDirectory(String directory) { this.directory = directory; }
    public String getPublicPath() { return publicPath; }
    public void setPublicPath(String publicPath) { this.publicPath = publicPath; }
}
