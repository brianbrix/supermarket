<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('payments', function (Blueprint $table) {
            $table->index('external_request_id');
            $table->index('external_transaction_id');
        });
    }
    public function down(): void {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['external_request_id']);
            $table->dropIndex(['external_transaction_id']);
        });
    }
};
