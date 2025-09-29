<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('products', 'brand_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->foreignId('brand_id')
                    ->nullable()
                    ->after('brand')
                    ->constrained('brands')
                    ->nullOnDelete();
            });
        }

        $this->hydrateBrandData();
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'brand_id')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropForeign(['brand_id']);
                $table->dropColumn('brand_id');
            });
        }
    }

    private function hydrateBrandData(): void
    {
        if (!Schema::hasTable('brands')) {
            return;
        }

        $products = DB::table('products')
            ->select('id', 'brand', 'category_id')
            ->whereNotNull('brand')
            ->whereRaw("TRIM(brand) <> ''")
            ->get();

        if ($products->isEmpty()) {
            return;
        }

        $now = Carbon::now();

        $existingBySlug = DB::table('brands')->pluck('id', 'slug');
        $existingByName = DB::table('brands')->pluck('id', 'name')->mapWithKeys(function ($id, $name) {
            $key = mb_strtolower(trim($name));
            return [$key => $id];
        })->all();

        $nameToId = $existingByName;
        $usedSlugs = $existingBySlug->keys()->mapWithKeys(fn ($slug) => [$slug => true])->all();

        $pivotPairs = [];

        foreach ($products as $product) {
            $name = trim((string) $product->brand);
            if ($name === '') {
                continue;
            }
            $key = mb_strtolower($name);
            if (!isset($nameToId[$key])) {
                $base = Str::slug($name) ?: 'brand';
                $slug = $base;
                $suffix = 1;
                while (isset($usedSlugs[$slug])) {
                    $slug = $base . '-' . $suffix;
                    $suffix++;
                }

                $brandId = DB::table('brands')->insertGetId([
                    'name' => $name,
                    'slug' => $slug,
                    'description' => null,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $nameToId[$key] = $brandId;
                $usedSlugs[$slug] = true;
            }

            $brandId = $nameToId[$key];

            DB::table('products')
                ->where('id', $product->id)
                ->update(['brand_id' => $brandId]);

            if ($product->category_id) {
                $pairKey = $brandId . ':' . $product->category_id;
                $pivotPairs[$pairKey] = [
                    'brand_id' => $brandId,
                    'category_id' => $product->category_id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if (!empty($pivotPairs) && Schema::hasTable('brand_category')) {
            DB::table('brand_category')->insertOrIgnore(array_values($pivotPairs));
        }
    }
};
