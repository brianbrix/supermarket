<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('users')) { return; }
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users','username')) {
                $table->string('username',64)->nullable()->unique();
            }
            if (!Schema::hasColumn('users','first_name')) {
                $table->string('first_name',120)->nullable();
            }
            if (!Schema::hasColumn('users','last_name')) {
                $table->string('last_name',120)->nullable();
            }
            if (!Schema::hasColumn('users','role')) {
                $table->string('role',32)->default('USER');
            }
            if (!Schema::hasColumn('users','active')) {
                $table->boolean('active')->default(true);
            }
            if (!Schema::hasColumn('users','last_login')) {
                $table->timestamp('last_login')->nullable();
            }
        });
        // Backfill username values from email local-part where null
        if (Schema::hasColumn('users','username') && Schema::hasColumn('users','email')) {
            $driver = DB::getDriverName();
            if ($driver === 'pgsql') {
                DB::statement("UPDATE users SET username = split_part(email,'@',1) WHERE username IS NULL AND email IS NOT NULL");
            } else {
                // Portable fallback (may be less efficient)
                $users = DB::table('users')->whereNull('username')->whereNotNull('email')->get(['id','email']);
                foreach ($users as $u) {
                    $base = strstr($u->email,'@', true) ?: $u->email;
                    try { DB::table('users')->where('id',$u->id)->update(['username'=>$base]); } catch(\Throwable $e) { /* ignore uniqueness collisions */ }
                }
            }
        }
    }
    public function down(): void {
        // Non-destructive rollback (keep added columns). If truly needed, columns can be dropped manually.
    }
};
