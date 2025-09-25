package com.example.supermarket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductControllerIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    Long createdId;

    @BeforeEach
    void setup() throws Exception {
        if (createdId == null) {
            // Create a product with no category for now (assuming nullable) else adjust once categories are seeded
        String json = "{" +
            "\"name\":\"Test Product\"," +
            "\"categoryId\":null," +
            "\"price\":9.99," +
            "\"description\":\"Test Desc\"," +
            "\"imageUrl\":null," +
            "\"stock\":25," +
            "\"unit\":\"unit\"" +
            "}";
            String locationHeader = mockMvc.perform(post("/api/products")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name").value("Test Product"))
                    .andReturn().getResponse().getContentAsString();
            // Parse id
            createdId = objectMapper.readTree(locationHeader).get("id").asLong();
        }
    }

    @Test
    void listProducts() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").exists());
    }
}
