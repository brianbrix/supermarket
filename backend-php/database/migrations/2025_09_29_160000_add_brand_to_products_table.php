<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('products', 'brand')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('brand', 120)->nullable()->after('name');
                $table->index('brand');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'brand')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropIndex('products_brand_index');
                $table->dropColumn('brand');
            });
        }
    }
};
