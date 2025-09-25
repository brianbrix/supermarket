<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use App\Models\Product;
use App\Models\Category;

class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->words(2, true),
            'description' => $this->faker->sentence(),
            'price' => $this->faker->randomFloat(2, 1, 200),
            'stock' => $this->faker->numberBetween(0, 500),
            'unit' => 'pcs',
            'category_id' => Category::factory(),
            'image_url' => $this->faker->imageUrl(640,480,'food', true)
        ];
    }
}
