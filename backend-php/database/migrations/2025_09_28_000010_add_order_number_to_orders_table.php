<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Carbon\Carbon;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'order_number')) {
                $table->string('order_number', 32)->nullable()->after('id');
            }
        });

        if (!Schema::hasColumn('orders', 'order_number')) {
            return;
        }

        $existing = DB::table('orders')
            ->select('id', 'order_number', 'created_at')
            ->orderBy('id')
            ->cursor();

        foreach ($existing as $order) {
            if (!empty($order->order_number)) {
                continue;
            }

            $orderNumber = $this->generateUniqueOrderNumber($order->created_at);

            DB::table('orders')
                ->where('id', $order->id)
                ->update(['order_number' => $orderNumber]);
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->unique('order_number');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('orders')) {
            return;
        }

        if (!Schema::hasColumn('orders', 'order_number')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_order_number_unique');
            $table->dropColumn('order_number');
        });
    }

    private function generateUniqueOrderNumber($createdAt): string
    {
        $timestamp = $createdAt ? Carbon::parse($createdAt) : Carbon::now();
        $prefix = $timestamp->format('Ymd');

        do {
            $candidate = 'ORD-' . $prefix . '-' . strtoupper(Str::random(5));
        } while (DB::table('orders')->where('order_number', $candidate)->exists());

        return $candidate;
    }
};
