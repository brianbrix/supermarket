<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('orders')) { return; }
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->enum('status', ['PENDING','PROCESSING','COMPLETED','CANCELLED'])->default('PENDING');
            $table->decimal('total_gross', 14, 2)->default(0);
            $table->decimal('total_net', 14, 2)->default(0);
            $table->decimal('vat_amount', 14, 2)->default(0);
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->string('thumbnail_url')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('orders');
    }
};
