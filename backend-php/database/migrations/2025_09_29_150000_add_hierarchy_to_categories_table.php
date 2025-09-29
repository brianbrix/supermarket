<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'parent_id')) {
                $table->foreignId('parent_id')->nullable()->after('id')->constrained('categories')->nullOnDelete();
            }
            if (!Schema::hasColumn('categories', 'slug')) {
                $table->string('slug')->nullable()->after('description');
            }
            if (!Schema::hasColumn('categories', 'path')) {
                $table->string('path')->nullable()->after('slug');
            }
            if (!Schema::hasColumn('categories', 'depth')) {
                $table->unsignedInteger('depth')->default(0)->after('path');
            }
        });

        // Backfill slug/path for existing rows
        $categories = DB::table('categories')->orderBy('id')->get();
        foreach ($categories as $category) {
            $baseSlug = Str::slug($category->name);
            if (!$baseSlug) {
                $baseSlug = 'category-' . $category->id;
            }
            // Ensure uniqueness on root level
            $slug = $baseSlug;
            $suffix = 1;
            while (DB::table('categories')->where('id', '!=', $category->id)->whereNull('parent_id')->where('slug', $slug)->exists()) {
                $slug = $baseSlug . '-' . $suffix;
                $suffix++;
            }
            DB::table('categories')->where('id', $category->id)->update([
                'slug' => $slug,
                'path' => $slug,
                'depth' => 0,
                'parent_id' => null,
            ]);
        }

        Schema::table('categories', function (Blueprint $table) {
            $table->unique(['parent_id', 'slug']);
            $table->index('path');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'parent_id')) {
                $table->dropForeign(['parent_id']);
                $table->dropColumn('parent_id');
            }
            if (Schema::hasColumn('categories', 'slug')) {
                $table->dropColumn('slug');
            }
            if (Schema::hasColumn('categories', 'path')) {
                $table->dropColumn('path');
            }
            if (Schema::hasColumn('categories', 'depth')) {
                $table->dropColumn('depth');
            }
        });
    }
};
