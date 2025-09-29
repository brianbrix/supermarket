<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('brand_category')) {
            Schema::create('brand_category', function (Blueprint $table) {
                $table->unsignedBigInteger('brand_id');
                $table->unsignedBigInteger('category_id');
                $table->timestamps();

                $table->primary(['brand_id', 'category_id']);

                $table->foreign('brand_id')
                    ->references('id')
                    ->on('brands')
                    ->cascadeOnDelete();

                $table->foreign('category_id')
                    ->references('id')
                    ->on('categories')
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_category');
    }
};
