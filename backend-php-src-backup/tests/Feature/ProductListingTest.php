<?php

use function Pest\Laravel\getJson;
use App\Models\Product;
use App\Models\Category;

it('lists products with pagination envelope', function () {
    Category::factory()->create();
    Product::factory()->count(3)->create();

    $response = getJson('/api/products');
    $response->assertStatus(200)
        ->assertJsonStructure([
            'content', 'page', 'size', 'totalPages', 'totalElements', 'numberOfElements', 'first', 'last', 'sort'
        ])
        ->assertJson(fn($json) => $json->where('page', 0)->etc());
});
