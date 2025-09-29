<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $sort = $request->get('sort', 'name');
        $direction = strtolower($request->get('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
    $allowed = ['name','brand','price','stock','id','created_at'];
        if (!in_array($sort, $allowed, true)) { $sort = 'name'; }
    $query = Product::query()->with(['category', 'images', 'tags']);
    $pageSize = min(100, (int)$request->get('size', 20));
    $paginator = $query->orderBy($sort, $direction)->paginate($pageSize);
    return $this->pageResponse($paginator, ProductResource::collection($paginator->items()));
    }

    public function search(Request $request)
    {
        $q = $request->get('q');
        $scope = strtolower((string) $request->get('scope', ''));
        $promoTag = $request->get('promoTag') ?? $request->get('tag');
        $categoryId = $request->get('categoryId');  
        $minPrice = $request->get('minPrice');
        $maxPrice = $request->get('maxPrice');
        $inStock = $request->get('inStock');
        $sort = $request->get('sort', 'name');
        $direction = strtolower($request->get('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowed = ['name', 'brand', 'price', 'stock', 'id', 'created_at', 'rating_avg', 'rating_count'];
        if (!in_array($sort, $allowed, true)) {
            $sort = 'name';
        }

    $query = Product::query()->with(['category', 'images', 'tags']);

        if ($q) {
            $safeQ = str_replace(['%', '_'], ['\\%', '\\_'], $q);
            $query->where(function ($w) use ($safeQ) {
                $like = "%{$safeQ}%";
                $w->where('name', 'ilike', $like)
                    ->orWhere('description', 'ilike', $like)
                    ->orWhere('brand', 'ilike', $like);
            });
        }

        $brand = $request->get('brand');
        $brands = $request->get('brands');
        if ($brand) {
            $query->where('brand', 'ilike', '%' . str_replace(['%', '_'], ['\\%', '\\_'], $brand) . '%');
        }
        if (is_array($brands) && !empty($brands)) {
            $brandList = array_values(array_filter($brands, fn ($b) => $b !== null && $b !== ''));
            if (!empty($brandList)) {
                $query->whereIn('brand', $brandList);
            }
        }
        if ($categoryId) {
            $query->where('category_id', (int) $categoryId);
        }
        if ($minPrice !== null && $minPrice !== '') {
            $query->where('price', '>=', (float) $minPrice);
        }
        if ($maxPrice !== null && $maxPrice !== '') {
            $query->where('price', '<=', (float) $maxPrice);
        }
        $ids = $request->input('ids');
        if ($ids) {
            $idList = is_array($ids) ? $ids : explode(',', (string) $ids);
            $idList = array_values(array_filter(array_map(static function ($value) {
                if (is_numeric($value)) {
                    return (int) $value;
                }
                return null;
            }, $idList), static fn ($value) => $value !== null));
            if (!empty($idList)) {
                $query->whereIn('id', $idList);
            }
        }

        $tagSlugs = $this->collectTagSlugs($request, $promoTag);
        if (!empty($tagSlugs)) {
            $query->whereHas('tags', function ($tagQuery) use ($tagSlugs) {
                $tagQuery->whereIn('slug', $tagSlugs);
            });
        }

        // Only filter when truthy; if provided as 'true' or 1, filter to stock > 0
        if ($inStock === true || $inStock === 1 || $inStock === '1' || strtolower((string) $inStock) === 'true') {
            $query->where('stock', '>', 0);
        }

        $pageSize = min(100, (int) $request->get('size', 20));
        $appliedScopeOrder = $this->applyScopeSorting($query, $scope, $tagSlugs, $request);
        if (!$appliedScopeOrder) {
            $query->orderBy($sort, $direction);
        }

        $paginator = $query->paginate($pageSize);

        return $this->pageResponse($paginator, ProductResource::collection($paginator->items()));
    }

    public function priceRange(Request $request)
    {
        $categoryId = $request->get('categoryId');
        $cacheKey = $categoryId
            ? "products:price-range:category:" . (int) $categoryId
            : 'products:price-range:all';

        $range = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($categoryId) {
            $builder = Product::query();
            if ($categoryId) {
                $builder->where('category_id', (int) $categoryId);
            }

            $min = $builder->min('price');
            $max = $builder->max('price');

            return [
                'min' => $min !== null ? (float) $min : 0.0,
                'max' => $max !== null ? (float) $max : 0.0,
            ];
        });

        return response()->json($range);
    }

    public function show(Product $product)
    {
        $product->load([
            'category',
            'images' => function ($query) {
                $query->orderBy('position')->orderBy('id');
            },
            'tags',
        ]);
        return new ProductResource($product);
    }

    public function related(Request $request, Product $product)
    {
        $limit = (int) $request->get('limit', 6);
        if ($limit < 1) {
            $limit = 1;
        } elseif ($limit > 12) {
            $limit = 12;
        }

    $categoryWeight = 0.5;
    $priceWeight = 0.25;
    $stockWeight = 0.05;
    $ratingWeight = 0.15;
    $ratingVolumeWeight = 0.05;
    $ratingVolumePivot = 25;

        $anchorPrice = max((float) $product->price, 1.0);
        $categoryId = $product->category_id ?? 0;

        $cacheKey = sprintf('products:%d:related:%d:%s', $product->id, $limit, $product->updated_at?->timestamp ?? 0);

        $related = Cache::remember($cacheKey, now()->addMinutes(5), function () use (
            $product,
            $limit,
            $categoryId,
            $categoryWeight,
            $priceWeight,
            $stockWeight,
            $anchorPrice,
            $ratingWeight,
            $ratingVolumeWeight,
            $ratingVolumePivot
        ) {
            return Product::query()
                ->select('products.*')
                ->where('products.id', '!=', $product->id)
                ->with(['category', 'images', 'tags'])
                ->selectRaw(
                    '(CASE WHEN products.category_id = ? THEN ?::numeric ELSE 0::numeric END)'
                    . ' + (1 - LEAST(ABS(products.price - ?::numeric) / NULLIF(?::numeric, 0::numeric), 1)) * ?::numeric'
                    . ' + (CASE WHEN products.stock > 0 THEN ?::numeric ELSE 0::numeric END)'
                    . ' + (LEAST(COALESCE(products.rating_avg, 0)::numeric / 5, 1) * ?::numeric)'
                    . ' + (LEAST(COALESCE(products.rating_count, 0)::numeric / NULLIF(?::numeric, 0::numeric), 1) * ?::numeric) AS relevance_score',
                    [
                        $categoryId,
                        $categoryWeight,
                        (float) $product->price,
                        $anchorPrice,
                        $priceWeight,
                        $stockWeight,
                        $ratingWeight,
                        $ratingVolumePivot,
                        $ratingVolumeWeight,
                    ]
                )
                ->orderByDesc('relevance_score')
                ->orderByDesc('products.stock')
                ->orderBy('products.price')
                ->limit($limit)
                ->get();
        });

        return ProductResource::collection($related);
    }

    private function applyScopeSorting($query, string $scope, array $tagSlugs, Request $request): bool
    {
        $normalized = trim($scope);
        if ($normalized === '') {
            return false;
        }

        switch ($normalized) {
            case 'top-rated':
            case 'top_rated':
            case 'toprated':
                $query->orderByRaw('COALESCE(rating_avg, 0) DESC');
                $query->orderByRaw('COALESCE(rating_count, 0) DESC');
                $query->orderByDesc('updated_at');
                return true;

            case 'promotions':
            case 'promotion':
            case 'promo':
                if (empty($tagSlugs)) {
                    $query->whereHas('tags');
                }
                $query->orderBy('stock', 'desc');
                $query->orderByDesc('updated_at');
                $query->orderByRaw('COALESCE(rating_avg, 0) DESC');
                return true;

            case 'trending':
                $days = (int) $request->get('trendingDays', 14);
                if ($days < 1) {
                    $days = 1;
                }
                if ($days > 90) {
                    $days = 90;
                }
                $windowStart = Carbon::now()->subDays($days);
                $query->withCount(['orderItems as recent_order_count' => function ($orderItems) use ($windowStart) {
                    $orderItems->where('created_at', '>=', $windowStart);
                }]);
                $query->orderByDesc('recent_order_count');
                $query->orderByRaw('COALESCE(rating_avg, 0) DESC');
                $query->orderByRaw('COALESCE(rating_count, 0) DESC');
                $query->orderByDesc('updated_at');
                return true;

            case 'recent':
            case 'recently-added':
            case 'recently_added':
            case 'new':
            case 'new-arrivals':
            case 'new_arrivals':
                $query->orderByDesc('created_at');
                return true;

            default:
                return false;
        }
    }

    private function collectTagSlugs(Request $request, ?string $promoTag): array
    {
        $slugs = $this->normalizeTagSlugs($request->input('tags'));
        $slugs = array_merge($slugs, $this->normalizeTagSlugs($request->input('tagSlugs')));

        if ($promoTag !== null && $promoTag !== '') {
            $slugs = array_merge($slugs, $this->normalizeTagSlugs([$promoTag]));
        }

        return array_values(array_unique(array_filter($slugs)));
    }

    private function normalizeTagSlugs($input): array
    {
        if ($input === null) {
            return [];
        }

        $values = Arr::wrap($input);
        $slugs = [];

        foreach ($values as $value) {
            if (is_array($value)) {
                $candidate = $value['slug'] ?? $value['name'] ?? null;
            } else {
                $candidate = $value;
            }

            if ($candidate === null) {
                continue;
            }

            $normalized = Str::slug((string) $candidate);

            if ($normalized === '') {
                continue;
            }

            $slugs[$normalized] = $normalized;
        }

        return array_values($slugs);
    }

    private function pageResponse($paginator, $data)
    {
        return response()->json([
            'content' => $data,
            'page' => $paginator->currentPage() - 1, // zero-based to match existing frontend expectation
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
            'sort' => null
        ]);
    }
}
