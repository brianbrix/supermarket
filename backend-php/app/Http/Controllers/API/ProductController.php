<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $sort = $request->get('sort', 'name');
        $direction = strtolower($request->get('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowed = ['name','price','stock','id','created_at'];
        if (!in_array($sort, $allowed, true)) { $sort = 'name'; }
        $query = Product::query()->with(['category','images']);
    $pageSize = min(100, (int)$request->get('size', 20));
    $paginator = $query->orderBy($sort, $direction)->paginate($pageSize);
    return $this->pageResponse($paginator, ProductResource::collection($paginator->items()));
    }

    public function search(Request $request)
    {
        $q = $request->get('q');
        $categoryId = $request->get('categoryId');
        $minPrice = $request->get('minPrice');
        $maxPrice = $request->get('maxPrice');
        $inStock = $request->get('inStock');
        $sort = $request->get('sort', 'name');
        $direction = strtolower($request->get('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowed = ['name','price','stock','id','created_at'];
        if (!in_array($sort, $allowed, true)) { $sort = 'name'; }
        $query = Product::query()->with(['category','images']);
        if ($q) {
            $query->where(function($w) use ($q){
                $w->where('name','ilike',"%$q%")
                  ->orWhere('description','ilike',"%$q%");
            });
        }
        if ($categoryId) {
            $query->where('category_id', (int)$categoryId);
        }
        if ($minPrice !== null && $minPrice !== '') {
            $query->where('price', '>=', (float)$minPrice);
        }
        if ($maxPrice !== null && $maxPrice !== '') {
            $query->where('price', '<=', (float)$maxPrice);
        }
        // Only filter when truthy; if provided as 'true' or 1, filter to stock > 0
        if ($inStock === true || $inStock === 1 || $inStock === '1' || strtolower((string)$inStock) === 'true') {
            $query->where('stock', '>', 0);
        }
        $pageSize = min(100, (int)$request->get('size', 20));
        $paginator = $query->orderBy($sort, $direction)->paginate($pageSize);
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
            }
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

        $categoryWeight = 0.6;
        $priceWeight = 0.35;
        $stockWeight = 0.05;

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
            $anchorPrice
        ) {
            return Product::query()
                ->select('products.*')
                ->where('products.id', '!=', $product->id)
                ->with(['category', 'images'])
                ->selectRaw(
                    '(CASE WHEN products.category_id = ? THEN ?::numeric ELSE 0::numeric END)'
                    . ' + (1 - LEAST(ABS(products.price - ?::numeric) / NULLIF(?::numeric, 0::numeric), 1)) * ?::numeric'
                    . ' + (CASE WHEN products.stock > 0 THEN ?::numeric ELSE 0::numeric END) AS relevance_score',
                    [
                        $categoryId,
                        $categoryWeight,
                        (float) $product->price,
                        $anchorPrice,
                        $priceWeight,
                        $stockWeight,
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
