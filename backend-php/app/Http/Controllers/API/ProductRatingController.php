<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductRatingResource;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductRating;
use App\Services\AdminNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductRatingController extends Controller
{
    public function index(Product $product, Request $request)
    {
        $size = (int) $request->query('size', 10);
        $size = max(1, min(50, $size));
        $page = max(0, (int) $request->query('page', 0));

        $paginator = ProductRating::query()
            ->where('product_id', $product->id)
            ->latest('created_at')
            ->paginate($size, ['*'], 'page', $page + 1);

        $items = $paginator->items();

        return response()->json([
            'content' => ProductRatingResource::collection(collect($items)),
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($items),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
            'sort' => null,
        ]);
    }

    public function summary(Product $product)
    {
        $count = (int) ($product->rating_count ?? 0);
        $average = $count > 0 ? round((float) ($product->rating_avg ?? 0), 2) : 0.0;
        $verified = ProductRating::query()
            ->where('product_id', $product->id)
            ->where('is_verified', true)
            ->count();

        $distribution = ProductRating::query()
            ->where('product_id', $product->id)
            ->selectRaw('rating, COUNT(*) as aggregate_count')
            ->groupBy('rating')
            ->pluck('aggregate_count', 'rating')
            ->all();

        $normalized = [];
        for ($i = 5; $i >= 1; $i--) {
            $normalized[$i] = (int) ($distribution[$i] ?? 0);
        }

        return response()->json([
            'average' => $average,
            'count' => $count,
            'verifiedCount' => (int) $verified,
            'distribution' => $normalized,
            'lastSubmittedAt' => $product->rating_last_submitted_at?->toIso8601String(),
        ]);
    }

    public function store(Product $product, Request $request, AdminNotificationService $notifications)
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:160'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'name' => ['nullable', 'string', 'max:160'],
            'orderItemId' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $orderItem = null;
        $isVerified = false;

        if (!empty($data['orderItemId'])) {
            $orderItem = OrderItem::query()->with('order')
                ->where('id', $data['orderItemId'])
                ->where('product_id', $product->id)
                ->first();

            if (!$orderItem) {
                throw ValidationException::withMessages([
                    'orderItemId' => __('Invalid order reference for this product.'),
                ]);
            }

            if ($user && $orderItem->order?->user_id === $user->id) {
                $isVerified = true;
            }
        }

        if (!$isVerified && $user) {
            $hasCompletedOrder = OrderItem::query()
                ->where('product_id', $product->id)
                ->whereHas('order', function ($query) use ($user) {
                    $query->where('user_id', $user->id)
                        ->whereIn('status', ['DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING']);
                })
                ->exists();

            $isVerified = $hasCompletedOrder;
        }

        $sanitizedComment = isset($data['comment'])
            ? trim(strip_tags($data['comment']))
            : null;

        $sanitizedTitle = isset($data['title'])
            ? Str::of($data['title'])->stripTags()->trim()->limit(160, '')->__toString()
            : null;

        if (!$sanitizedComment && !$sanitizedTitle) {
            $sanitizedComment = null;
        }

        $customerName = $user?->name;
        if (!$customerName && !empty($data['name'])) {
            $customerName = Str::of($data['name'])->stripTags()->trim()->limit(160, '')->__toString();
        }

        $metadata = [
            'source_ip' => $request->ip(),
        ];
        if ($agent = $request->userAgent()) {
            $metadata['user_agent'] = Str::limit($agent, 255, '');
        }

        $payload = [
            'product_id' => $product->id,
            'user_id' => $user?->id,
            'order_item_id' => $orderItem?->id,
            'rating' => (int) $data['rating'],
            'title' => $sanitizedTitle,
            'comment' => $sanitizedComment,
            'customer_name' => $customerName,
            'is_verified' => $isVerified,
            'metadata' => $metadata,
        ];

        $rating = DB::transaction(function () use ($payload, $user) {
            if ($user) {
                return tap(
                    ProductRating::updateOrCreate(
                        [
                            'product_id' => $payload['product_id'],
                            'user_id' => $payload['user_id'],
                        ],
                        $payload
                    )
                );
            }

            return ProductRating::create($payload);
        });

        $status = $rating->wasRecentlyCreated ? 201 : 200;
        $rating = $rating->fresh(['product']);

        if ($status === 201) {
            try {
                $notifications->notifyNewRating($rating);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return (new ProductRatingResource($rating))
            ->response()
            ->setStatusCode($status);
    }
}
