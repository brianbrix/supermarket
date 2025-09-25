<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // For an API-first backend, return null so Laravel issues a 401 JSON without redirect.
        // If a web route is later added that expects a login page, adjust this logic accordingly.
        return null;
    }
}
