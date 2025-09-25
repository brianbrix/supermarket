<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->decimal('amount', 14, 2);
            $table->string('currency', 8)->default('USD');
            $table->string('method', 32)->nullable();
            $table->string('channel', 32)->nullable();
            $table->string('status', 32)->default('PENDING');
            $table->string('provider', 64)->nullable();
            $table->string('provider_ref', 128)->nullable();
            $table->string('external_request_id', 128)->nullable();
            $table->string('external_transaction_id', 128)->nullable();
            $table->string('phone_number', 64)->nullable();
            $table->json('raw_request_payload')->nullable();
            $table->json('raw_callback_payload')->nullable();
            $table->timestamps();
            $table->index(['status','created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('payments'); }
};
