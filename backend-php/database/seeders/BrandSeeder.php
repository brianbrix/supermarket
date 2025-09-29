<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Brand;
use App\Models\Category;

class BrandSeeder extends Seeder
{
    public function run(): void
    {
        $brands = [
            [
                'name' => 'Everfresh Organics',
                'description' => 'Organic produce and pantry essentials',
                'is_active' => true,
                'categories' => ['Groceries', 'Fresh Produce'],
            ],
            [
                'name' => 'Lumina Tech',
                'description' => 'Consumer electronics and smart accessories',
                'is_active' => true,
                'categories' => ['Electronics'],
            ],
        ];

        $categoryCache = [];

        foreach ($brands as $data) {
            $categoryNames = $data['categories'] ?? [];
            unset($data['categories']);

            $brand = Brand::updateOrCreate(
                ['name' => $data['name']],
                $data
            );

            if (empty($categoryNames)) {
                continue;
            }

            $categoryIds = [];
            foreach ($categoryNames as $name) {
                $trimmed = trim($name);
                if ($trimmed === '') {
                    continue;
                }
                if (!isset($categoryCache[$trimmed])) {
                    $categoryCache[$trimmed] = Category::firstOrCreate(
                        ['name' => $trimmed],
                        ['description' => $trimmed]
                    );
                }
                $categoryIds[] = $categoryCache[$trimmed]->id;
            }

            if (!empty($categoryIds)) {
                $brand->categories()->syncWithoutDetaching($categoryIds);
            }
        }
    }
}
