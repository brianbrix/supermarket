<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\HomepageLayoutResource;
use App\Models\HomepageLayout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class HomepageLayoutController extends Controller
{
    private const CACHE_TTL_SECONDS = 300;

    public function show(Request $request, ?string $slug = null): JsonResponse
    {
        $targetSlug = $slug ? strtolower($slug) : strtolower($request->query('slug', 'home'));

    $cacheKey = HomepageLayout::cacheKey($targetSlug);

        $payload = Cache::remember($cacheKey, self::CACHE_TTL_SECONDS, function () use ($targetSlug) {
            $layout = HomepageLayout::with('publishedBy')
                ->active($targetSlug)
                ->orderByDesc('published_at')
                ->first();

            if (!$layout) {
                $layout = HomepageLayout::with('publishedBy')
                    ->where('slug', $targetSlug)
                    ->where('status', 'published')
                    ->orderByDesc('published_at')
                    ->first();
            }

            if (!$layout) {
                return null;
            }

            return (new HomepageLayoutResource($layout))->resolve();
        });

        if ($payload === null) {
            return response()->json([
                'message' => 'Homepage layout not found.',
            ], 404);
        }

        return response()->json($payload);
    }
}
