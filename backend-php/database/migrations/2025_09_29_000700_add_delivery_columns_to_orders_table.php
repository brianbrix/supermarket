<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'delivery_type')) {
                $table->enum('delivery_type', ['PICKUP', 'DELIVERY'])->default('PICKUP')->after('thumbnail_url');
            }
            if (!Schema::hasColumn('orders', 'delivery_status')) {
                $table->enum('delivery_status', ['REQUESTED', 'ASSIGNED', 'EN_ROUTE', 'DELIVERED', 'CANCELLED'])->nullable()->after('delivery_type');
            }
            if (!Schema::hasColumn('orders', 'delivery_shop_id')) {
                $table->foreignId('delivery_shop_id')->nullable()->after('delivery_status')->constrained('delivery_shops')->nullOnDelete();
            }
            if (!Schema::hasColumn('orders', 'delivery_requested_at')) {
                $table->timestamp('delivery_requested_at')->nullable()->after('delivery_shop_id');
            }
            if (!Schema::hasColumn('orders', 'delivery_dispatched_at')) {
                $table->timestamp('delivery_dispatched_at')->nullable()->after('delivery_requested_at');
            }
            if (!Schema::hasColumn('orders', 'delivery_completed_at')) {
                $table->timestamp('delivery_completed_at')->nullable()->after('delivery_dispatched_at');
            }
            if (!Schema::hasColumn('orders', 'delivery_address_line1')) {
                $table->string('delivery_address_line1')->nullable()->after('delivery_completed_at');
            }
            if (!Schema::hasColumn('orders', 'delivery_address_line2')) {
                $table->string('delivery_address_line2')->nullable()->after('delivery_address_line1');
            }
            if (!Schema::hasColumn('orders', 'delivery_city')) {
                $table->string('delivery_city')->nullable()->after('delivery_address_line2');
            }
            if (!Schema::hasColumn('orders', 'delivery_region')) {
                $table->string('delivery_region')->nullable()->after('delivery_city');
            }
            if (!Schema::hasColumn('orders', 'delivery_postal_code')) {
                $table->string('delivery_postal_code')->nullable()->after('delivery_region');
            }
            if (!Schema::hasColumn('orders', 'delivery_lat')) {
                $table->decimal('delivery_lat', 10, 7)->nullable()->after('delivery_postal_code');
            }
            if (!Schema::hasColumn('orders', 'delivery_lng')) {
                $table->decimal('delivery_lng', 10, 7)->nullable()->after('delivery_lat');
            }
            if (!Schema::hasColumn('orders', 'delivery_distance_km')) {
                $table->decimal('delivery_distance_km', 8, 2)->nullable()->after('delivery_lng');
            }
            if (!Schema::hasColumn('orders', 'delivery_cost')) {
                $table->decimal('delivery_cost', 10, 2)->nullable()->after('delivery_distance_km');
            }
            if (!Schema::hasColumn('orders', 'delivery_contact_phone')) {
                $table->string('delivery_contact_phone')->nullable()->after('delivery_cost');
            }
            if (!Schema::hasColumn('orders', 'delivery_contact_email')) {
                $table->string('delivery_contact_email')->nullable()->after('delivery_contact_phone');
            }
            if (!Schema::hasColumn('orders', 'delivery_notes')) {
                $table->text('delivery_notes')->nullable()->after('delivery_contact_email');
            }
            $table->index(['delivery_type']);
            $table->index(['delivery_status']);
            $table->index(['delivery_shop_id']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'delivery_notes')) {
                $table->dropColumn('delivery_notes');
            }
            if (Schema::hasColumn('orders', 'delivery_contact_email')) {
                $table->dropColumn('delivery_contact_email');
            }
            if (Schema::hasColumn('orders', 'delivery_contact_phone')) {
                $table->dropColumn('delivery_contact_phone');
            }
            if (Schema::hasColumn('orders', 'delivery_cost')) {
                $table->dropColumn('delivery_cost');
            }
            if (Schema::hasColumn('orders', 'delivery_distance_km')) {
                $table->dropColumn('delivery_distance_km');
            }
            if (Schema::hasColumn('orders', 'delivery_lng')) {
                $table->dropColumn('delivery_lng');
            }
            if (Schema::hasColumn('orders', 'delivery_lat')) {
                $table->dropColumn('delivery_lat');
            }
            if (Schema::hasColumn('orders', 'delivery_postal_code')) {
                $table->dropColumn('delivery_postal_code');
            }
            if (Schema::hasColumn('orders', 'delivery_region')) {
                $table->dropColumn('delivery_region');
            }
            if (Schema::hasColumn('orders', 'delivery_city')) {
                $table->dropColumn('delivery_city');
            }
            if (Schema::hasColumn('orders', 'delivery_address_line2')) {
                $table->dropColumn('delivery_address_line2');
            }
            if (Schema::hasColumn('orders', 'delivery_address_line1')) {
                $table->dropColumn('delivery_address_line1');
            }
            if (Schema::hasColumn('orders', 'delivery_completed_at')) {
                $table->dropColumn('delivery_completed_at');
            }
            if (Schema::hasColumn('orders', 'delivery_dispatched_at')) {
                $table->dropColumn('delivery_dispatched_at');
            }
            if (Schema::hasColumn('orders', 'delivery_requested_at')) {
                $table->dropColumn('delivery_requested_at');
            }
            if (Schema::hasColumn('orders', 'delivery_shop_id')) {
                $table->dropForeign(['delivery_shop_id']);
                $table->dropColumn('delivery_shop_id');
            }
            if (Schema::hasColumn('orders', 'delivery_status')) {
                $table->dropColumn('delivery_status');
            }
            if (Schema::hasColumn('orders', 'delivery_type')) {
                $table->dropColumn('delivery_type');
            }
        });
    }
};
