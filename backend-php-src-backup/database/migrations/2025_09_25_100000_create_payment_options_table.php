<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('payment_options', function(Blueprint $table){
            $table->id();
            $table->string('code')->unique(); // e.g. MPESA, AIRTEL
            $table->string('name');
            $table->string('provider')->nullable(); // provider brand
            $table->enum('type', ['MOBILE','CARD','BANK','OTHER'])->default('MOBILE');
            $table->boolean('active')->default(true);
            $table->decimal('fee_fixed',10,2)->default(0);
            $table->decimal('fee_percent',8,4)->default(0);
            $table->json('meta')->nullable(); // arbitrary config
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('payment_options');
    }
};
