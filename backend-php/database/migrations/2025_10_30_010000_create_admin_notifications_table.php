<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('admin_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type', 80);
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('severity', 20)->default('info');
            $table->string('context_type', 60)->nullable();
            $table->unsignedBigInteger('context_id')->nullable();
            $table->json('data')->nullable();
            $table->string('dedupe_key', 120)->nullable()->unique();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['type', 'read_at']);
            $table->index(['context_type', 'context_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_notifications');
    }
};
