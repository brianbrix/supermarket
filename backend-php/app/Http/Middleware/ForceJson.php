<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForceJson
{
    public function handle(Request $request, Closure $next): Response
    {
        if (str_starts_with($request->path(), 'api/')) {
            // Force JSON expectation so validation/auth errors return JSON not redirects.
            $request->headers->set('Accept', 'application/json');
        }
        return $next($request);
    }
}
