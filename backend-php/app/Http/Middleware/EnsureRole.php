<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Enums\Role;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        // Normalize target role via enum (falls back to USER if unknown)
        $required = Role::fromMixed($role);
        if ($user->role !== $required) {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden'
            ], 403);
        }
        return $next($request);
    }
}
