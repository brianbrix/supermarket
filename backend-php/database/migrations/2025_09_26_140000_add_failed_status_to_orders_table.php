<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY status ENUM('PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED') DEFAULT 'PENDING'");
            return;
        }

        if ($driver === 'pgsql') {
            $constraint = DB::selectOne(<<<SQL
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'CHECK'
                  AND tc.table_name = 'orders'
                  AND ccu.column_name = 'status'
                LIMIT 1
            SQL);
            if ($constraint) {
                $constraintName = $constraint->constraint_name;
                DB::statement("ALTER TABLE orders DROP CONSTRAINT \"{$constraintName}\"");
                DB::statement("ALTER TABLE orders ADD CONSTRAINT \"{$constraintName}\" CHECK (status IN ('PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED'))");
                return;
            }
        }

        // Fallback: attempt a generic change using string column
        Schema::table('orders', function (Blueprint $table) {
            $table->string('status', 32)->default('PENDING')->change();
        });
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY status ENUM('PENDING','PROCESSING','COMPLETED','CANCELLED') DEFAULT 'PENDING'");
            return;
        }

        if ($driver === 'pgsql') {
            $constraint = DB::selectOne(<<<SQL
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'CHECK'
                  AND tc.table_name = 'orders'
                  AND ccu.column_name = 'status'
                LIMIT 1
            SQL);
            if ($constraint) {
                $constraintName = $constraint->constraint_name;
                DB::statement("ALTER TABLE orders DROP CONSTRAINT \"{$constraintName}\"");
                DB::statement("ALTER TABLE orders ADD CONSTRAINT \"{$constraintName}\" CHECK (status IN ('PENDING','PROCESSING','COMPLETED','CANCELLED'))");
                return;
            }
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('status', 32)->default('PENDING')->change();
        });
    }
};
