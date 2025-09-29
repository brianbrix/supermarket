<?php

namespace Database\Seeders;

use App\Models\HomepageLayout;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class HomepageLayoutSeeder extends Seeder
{
    public function run(): void
    {
        if (HomepageLayout::where('slug', 'home')->exists()) {
            return;
        }

        $layout = [
            'sections' => [
                [
                    'id' => 'hero-primary',
                    'type' => 'hero',
                    'headline' => 'Essentials delivered lightning fast',
                    'subheading' => 'Shop fresh groceries, household staples, and top brands with same-day delivery.',
                    'backgroundImage' => null,
                    'primaryCta' => [
                        'label' => 'Shop fresh picks',
                        'href' => '/products?tag=fresh-deals',
                    ],
                    'secondaryCta' => [
                        'label' => 'Browse categories',
                        'href' => '/products',
                    ],
                ],
                [
                    'id' => 'featured-categories',
                    'type' => 'category-grid',
                    'title' => 'Shop by category',
                    'subtitle' => 'Jump into popular aisles shoppers love right now.',
                    'columns' => 4,
                    'items' => [
                        ['label' => 'Fresh Produce', 'icon' => '🥑', 'href' => '/products?category=produce'],
                        ['label' => 'Bakery & Breakfast', 'icon' => '🥐', 'href' => '/products?category=bakery'],
                        ['label' => 'Beverages', 'icon' => '🧃', 'href' => '/products?category=beverages'],
                        ['label' => 'Household Essentials', 'icon' => '🧼', 'href' => '/products?category=household'],
                        ['label' => 'Snacks & Treats', 'icon' => '🍪', 'href' => '/products?category=snacks'],
                        ['label' => 'Baby & Kids', 'icon' => '🍼', 'href' => '/products?category=baby'],
                        ['label' => 'Health & Beauty', 'icon' => '💄', 'href' => '/products?category=beauty'],
                        ['label' => 'Pet Supplies', 'icon' => '🐾', 'href' => '/products?category=pets'],
                    ],
                ],
                [
                    'id' => 'daily-deals',
                    'type' => 'product-carousel',
                    'title' => 'Daily price drops',
                    'dataSource' => [
                        'type' => 'dynamic',
                        'scope' => 'promotions',
                        'filters' => [
                            'tag' => 'daily-deals',
                            'limit' => 8,
                        ],
                    ],
                    'display' => [
                        'showRating' => true,
                        'showAddToCart' => true,
                    ],
                ],
                [
                    'id' => 'banner-delivery',
                    'type' => 'image-banner',
                    'title' => 'Free delivery over KSh 2,500',
                    'description' => 'Schedule a delivery slot that works for you and we will handle the rest.',
                    'theme' => 'success',
                    'media' => [
                        'imageUrl' => null,
                        'backgroundColor' => '#e1f7e7',
                    ],
                    'cta' => [
                        'label' => 'See delivery options',
                        'href' => '/delivery',
                    ],
                ],
                [
                    'id' => 'top-rated',
                    'type' => 'product-carousel',
                    'title' => 'Highly rated by shoppers',
                    'dataSource' => [
                        'type' => 'dynamic',
                        'scope' => 'top-rated',
                        'filters' => [
                            'minRating' => 4,
                            'limit' => 8,
                        ],
                    ],
                    'display' => [
                        'showRating' => true,
                        'showAddToCart' => true,
                    ],
                ],
                [
                    'id' => 'content-rich-text',
                    'type' => 'rich-text',
                    'title' => 'Why shoppers love Supermarket+',
                    'body' => [
                        ['type' => 'paragraph', 'content' => 'We combine curated products, unbeatable freshness, and delightful delivery to keep your pantry stocked without the hassle.'],
                        ['type' => 'list', 'style' => 'check', 'items' => [
                            'Over 5,000 items with transparent pricing',
                            'Real-time order tracking and proactive support',
                            'Personalized recommendations powered by your favorites',
                        ]],
                    ],
                ],
            ],
        ];

        HomepageLayout::create([
            'slug' => 'home',
            'version' => 1,
            'title' => 'Default home experience',
            'layout' => $layout,
            'meta' => [
                'theme' => 'light',
                'lastSyncedAt' => Carbon::now()->toIso8601String(),
            ],
            'status' => 'published',
            'is_active' => true,
            'published_at' => Carbon::now(),
        ]);
    }
}
