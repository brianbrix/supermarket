<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;
use App\Enums\Role;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'username','email','password','first_name','last_name','role','active','last_login'
    ];

    protected $hidden = ['password','remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login' => 'datetime',
        'active' => 'boolean',
        'role' => Role::class,
    ];

    public function orders() { return $this->hasMany(Order::class); }

    public function isAdmin(): bool
    {
        return $this->role === Role::ADMIN;
    }
}
