<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private const STATUSES = "'PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED','FAILED','COMPLETED'";

    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY status ENUM(" . self::STATUSES . ") DEFAULT 'PENDING'");
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
                DB::statement("ALTER TABLE orders ADD CONSTRAINT \"{$constraintName}\" CHECK (status IN (" . self::STATUSES . "))");
                return;
            }
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('status', 32)->default('PENDING')->change();
        });
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        $legacy = "'PENDING','PROCESSING','COMPLETED','CANCELLED','FAILED'";

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY status ENUM($legacy) DEFAULT 'PENDING'");
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
                DB::statement("ALTER TABLE orders ADD CONSTRAINT \"{$constraintName}\" CHECK (status IN ($legacy))");
                return;
            }
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('status', 32)->default('PENDING')->change();
        });
    }
};
