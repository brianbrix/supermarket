<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\HomepageLayoutResource;
use App\Models\HomepageLayout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HomepageLayoutController extends Controller
{
    public function show(Request $request, ?string $slug = null): JsonResponse
    {
        $targetSlug = $slug ? strtolower($slug) : strtolower($request->query('slug', 'home'));

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
            return response()->json([
                'message' => 'Homepage layout not found.',
            ], 404);
        }

        return (new HomepageLayoutResource($layout))->response();
    }
}
