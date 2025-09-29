<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('homepage_layouts', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->default('home');
            $table->unsignedInteger('version')->default(1);
            $table->string('title')->nullable();
            $table->string('status', 32)->default('draft');
            $table->boolean('is_active')->default(false);
            $table->json('layout')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['slug', 'version']);
            $table->index(['slug', 'is_active']);
            $table->index(['slug', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('homepage_layouts');
    }
};
