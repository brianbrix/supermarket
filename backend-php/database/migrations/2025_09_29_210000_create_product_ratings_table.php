<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->tinyInteger('rating');
            $table->string('title', 160)->nullable();
            $table->text('comment')->nullable();
            $table->string('customer_name', 160)->nullable();
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_flagged')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['product_id', 'created_at']);
            $table->index(['product_id', 'rating']);
            $table->index(['product_id', 'user_id']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('rating_sum')->default(0);
            $table->decimal('rating_avg', 4, 2)->default(0);
            $table->timestamp('rating_last_submitted_at')->nullable();
            $table->index(['rating_avg', 'rating_count']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['rating_avg', 'rating_count']);
            $table->dropColumn([
                'rating_count',
                'rating_sum',
                'rating_avg',
                'rating_last_submitted_at',
            ]);
        });

        Schema::dropIfExists('product_ratings');
    }
};
