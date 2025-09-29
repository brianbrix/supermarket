<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\BrandResource;
use App\Models\Brand;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index(Request $request)
    {
        $query = Brand::query()->with('categories');

        $active = $request->query('active');
        if ($active !== null && $active !== '') {
            $truthy = ['1', 'true', 'yes', 'on'];
            $falsy = ['0', 'false', 'no', 'off'];
            $value = strtolower((string) $active);
            if (in_array($value, $truthy, true)) {
                $query->where('is_active', true);
            } elseif (in_array($value, $falsy, true)) {
                $query->where('is_active', false);
            }
        } else {
            $query->where('is_active', true);
        }

        if ($request->filled('categoryId')) {
            $categoryId = (int) $request->query('categoryId');
            $query->whereHas('categories', function ($q) use ($categoryId) {
                $q->where('categories.id', $categoryId);
            });
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            if ($term !== '') {
                $like = '%' . addcslashes($term, '%_') . '%';
                $query->where(function ($q) use ($like) {
                    $q->where('name', 'ilike', $like)
                        ->orWhere('slug', 'ilike', $like);
                });
            }
        }

        $limit = (int) $request->query('limit', 100);
        if ($limit < 1) {
            $limit = 1;
        } elseif ($limit > 500) {
            $limit = 500;
        }

        $brands = $query
            ->orderBy('name')
            ->limit($limit)
            ->get();

        return BrandResource::collection($brands);
    }
}
