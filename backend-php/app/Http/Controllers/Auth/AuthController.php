<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'username' => 'required|string|max:64|unique:users,username',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'first_name' => 'nullable|string|max:120',
            'last_name' => 'nullable|string|max:120'
        ]);
        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'first_name' => $data['first_name'] ?? null,
            'last_name' => $data['last_name'] ?? null,
            'role' => 'USER',
            'active' => true
        ]);
        $token = $user->createToken('auth')->plainTextToken;
        return response()->json(['user' => $user, 'token' => $token], 201);
    }

    public function login(Request $request)
    {
        // Support a single 'identifier' field (either email or username) for convenience.
        $data = $request->validate([
            'identifier' => 'required_without_all:email,username|string',
            'username' => 'sometimes|string',
            'email' => 'sometimes|email',
            'password' => 'required'
        ]);

        $identifier = $data['identifier'] ?? $data['username'] ?? $data['email'] ?? null;
        $query = User::query();
        if ($identifier) {
            if (Schema::hasColumn('users','username')) {
                $query->where(function($q) use ($identifier) {
                    $q->where('username', $identifier)->orWhere('email', $identifier);
                });
            } else {
                $query->where('email', $identifier);
            }
        } else {
            // Fallback to legacy separate fields if provided explicitly
            $query
                ->when(isset($data['username']) && Schema::hasColumn('users','username'), function($q) use ($data) { return $q->where('username',$data['username']); })
                ->when(isset($data['email']), function($q) use ($data) { return $q->where('email',$data['email']); });
        }
        $user = $query->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }
        if (!$user->active) {
            return response()->json(['error' => 'User inactive'], 403);
        }
        $user->last_login = now();
        $user->save();
        $token = $user->createToken('auth')->plainTextToken;
        return ['user' => $user, 'token' => $token];
    }

    public function me(Request $request)
    {
        return $request->user();
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->noContent();
    }
}
