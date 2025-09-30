<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('products')) { return; }
        if (Schema::hasColumn('products', 'active')) { return; }
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('active')->default(true)->after('image_url');
        });
    }

    public function down(): void {
        if (!Schema::hasTable('products')) { return; }
        if (!Schema::hasColumn('products', 'active')) { return; }
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('active');
        });
    }
};
