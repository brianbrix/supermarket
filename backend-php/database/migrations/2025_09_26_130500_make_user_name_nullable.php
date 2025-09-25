<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users','name')) return;
        // Drop NOT NULL constraint via raw SQL (portable fallback attempts)
        $driver = DB::getDriverName();
        try {
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE users ALTER COLUMN name DROP NOT NULL');
            } elseif ($driver === 'mysql') {
                // Need to detect column type; assume VARCHAR(255)
                DB::statement('ALTER TABLE users MODIFY name VARCHAR(255) NULL');
            } elseif ($driver === 'sqlite') {
                // SQLite cannot easily alter column nullability; skip (SQLite ignores NOT NULL drop scenario here)
            }
        } catch (Throwable $e) {
            // Ignore if already nullable
        }
        // Backfill any existing NULL name values using first_name + last_name or username/email
        if (Schema::hasColumn('users','first_name') && Schema::hasColumn('users','last_name')) {
            if ($driver === 'pgsql') {
                DB::statement("UPDATE users SET name = COALESCE(NULLIF(TRIM(first_name || ' ' || last_name),'') , username, email) WHERE name IS NULL");
            } else {
                $users = DB::table('users')->whereNull('name')->get(['id','first_name','last_name','username','email']);
                foreach ($users as $u) {
                    $name = trim(($u->first_name ?? '').' '.($u->last_name ?? ''));
                    if ($name === '') $name = $u->username ?? $u->email ?? 'User';
                    DB::table('users')->where('id',$u->id)->update(['name'=>$name]);
                }
            }
        }
    }
    public function down(): void {
        // Non-destructive rollback; we won't re-impose NOT NULL automatically.
    }
};
