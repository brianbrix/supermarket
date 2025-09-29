<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductTag;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProductTagSeeder extends Seeder
{
    public function run(): void
    {
        $definitions = [
            ['name' => 'Trending Now', 'slug' => 'trending', 'description' => 'Popular items customers are buying right now.'],
            ['name' => 'Top Rated', 'slug' => 'top-rated', 'description' => 'Products with excellent customer reviews.'],
            ['name' => 'Limited Offer', 'slug' => 'limited-offer', 'description' => 'Short-term deals and promotions.'],
            ['name' => 'New Arrival', 'slug' => 'new-arrival', 'description' => 'Recently added products worth checking out.'],
        ];

        $tags = collect($definitions)->map(function (array $definition) {
            $slug = Str::slug($definition['slug'] ?? $definition['name']);

            return ProductTag::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'] ?? null,
                ]
            );
        });

        $products = Product::query()->with('tags')->get();
        if ($products->isEmpty()) {
            return;
        }

        $tagIds = $tags->pluck('id');

        foreach ($products as $product) {
            $assignCount = random_int(1, min(3, $tagIds->count()));
            $product->tags()->syncWithoutDetaching(
                $tagIds->shuffle()->take($assignCount)
            );
        }
    }
}
