<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductRatingResource;
use App\Models\Product;
use App\Models\ProductRating;
use Illuminate\Http\Request;

class ProductRatingController extends Controller
{
    public function index(Product $product, Request $request)
    {
        $size = max(1, min(100, (int) $request->query('size', 20)));
        $page = max(0, (int) $request->query('page', 0));
        $onlyFlagged = filter_var($request->query('onlyFlagged'), FILTER_VALIDATE_BOOLEAN);
        $ratingFilter = $request->query('rating');

        $query = ProductRating::query()
            ->with('user')
            ->where('product_id', $product->id)
            ->latest('created_at');

        if ($onlyFlagged) {
            $query->where('is_flagged', true);
        }

        if ($ratingFilter !== null && $ratingFilter !== '') {
            $query->where('rating', (int) $ratingFilter);
        }

        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);

        return response()->json([
            'content' => ProductRatingResource::collection(collect($paginator->items())),
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
            'sort' => null,
        ]);
    }

    public function update(ProductRating $rating, Request $request)
    {
        $data = $request->validate([
            'is_flagged' => ['sometimes', 'boolean'],
            'is_verified' => ['sometimes', 'boolean'],
        ]);

        $rating->fill($data);
        $rating->save();

        return new ProductRatingResource($rating->fresh('user'));
    }

    public function destroy(ProductRating $rating)
    {
        $rating->delete();

        return response()->json([
            'deleted' => true,
        ]);
    }
}
