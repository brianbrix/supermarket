<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use App\Models\ProductTag;

class ProductAdminController extends Controller
{
    public function index(Request $request)
    {
        // Eager load images so admin UI can render thumbnails / reorder without extra round-trips.
    $query = Product::query()->with(['category', 'images', 'tags']);
        if ($search = $request->query('q')) {
            $query->where(function ($q) use ($search) {
                $like = '%' . addcslashes($search, '%_') . '%';
                $q->where('name', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('brand', 'like', $like);
            });
        }
        if ($request->filled('brand')) {
            $brand = '%' . addcslashes($request->query('brand'), '%_') . '%';
            $query->where('brand', 'like', $brand);
        }
        $sort = $request->query('sort', 'id');
        $direction = strtolower($request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSort = ['id', 'name', 'brand', 'price', 'stock', 'created_at'];
        if (!in_array($sort, $allowedSort)) {
            $sort = 'id';
        }
        $query->orderBy($sort, $direction);
        $size = (int) $request->query('size', 20);
        $page = (int) $request->query('page', 0);
        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);
        // Transform each product to include images array with id/url/position (public API uses a Resource, admin keeps inline)
        $items = array_map(fn ($product) => $this->transformProduct($product), $paginator->items());

        return response()->json([
            'content' => $items,
            'page' => $paginator->currentPage()-1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage()===1,
            'last' => $paginator->currentPage()===$paginator->lastPage(),
            'sort' => null
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:255'],
            'brand' => ['nullable','string','max:120'],
            'description' => ['nullable','string'],
            'price' => ['required','numeric','min:0'],
            'stock' => ['required','integer','min:0'],
            'unit' => ['nullable','string','max:50'],
            'category_id' => ['nullable','integer','exists:categories,id'],
            'image_url' => ['nullable','string','max:500'],
        ]);
    $product = Product::create($data);
    $this->syncProductTags($product, $request);
    $product->load(['category', 'images', 'tags']);

    return response()->json($this->transformProduct($product), 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'name' => ['sometimes','string','max:255'],
            'brand' => ['sometimes','nullable','string','max:120'],
            'description' => ['sometimes','nullable','string'],
            'price' => ['sometimes','numeric','min:0'],
            'stock' => ['sometimes','integer','min:0'],
            'unit' => ['sometimes','nullable','string','max:50'],
            'category_id' => ['sometimes','nullable','integer','exists:categories,id'],
            'image_url' => ['sometimes','nullable','string','max:500'],
        ]);
    $product->update($data);
    $this->syncProductTags($product, $request);
    $product->load(['category', 'images', 'tags']);

    return response()->json($this->transformProduct($product));
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return response()->json(['deleted'=>true]);
    }

    private function transformProduct(Product $product): array
    {
        $images = $product->images ? $product->images->map(function ($img) {
            return [
                'id' => $img->id,
                'url' => $img->url,
                'position' => $img->position,
            ];
        })->values()->all() : [];

        $tags = $product->relationLoaded('tags') ? $product->tags->map(function ($tag) {
            return [
                'id' => $tag->id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'description' => $tag->description,
            ];
        })->values()->all() : [];

        return [
            'id' => $product->id,
            'name' => $product->name,
            'brand' => $product->brand,
            'description' => $product->description,
            'price' => $product->price,
            'stock' => $product->stock,
            'unit' => $product->unit,
            'categoryId' => $product->category_id,
            'categoryName' => optional($product->category)->name,
            'imageUrl' => $product->image_url,
            'images' => $images,
            'tags' => $tags,
            'tagSlugs' => array_map(fn ($tag) => $tag['slug'], $tags),
            'createdAt' => $product->created_at?->toIso8601String(),
            'updatedAt' => $product->updated_at?->toIso8601String(),
        ];
    }

    private function syncProductTags(Product $product, Request $request): void
    {
        if (!$request->has('tags') && !$request->has('tagSlugs')) {
            return;
        }

        $rawTags = array_merge(
            Arr::wrap($request->input('tags')),
            Arr::wrap($request->input('tagSlugs'))
        );

        $definitions = $this->normalizeTagDefinitions($rawTags);

        if (empty($definitions)) {
            $product->tags()->sync([]);
            return;
        }

        $tagIds = collect($definitions)->map(function (array $definition) {
            $tag = ProductTag::firstOrCreate(
                ['slug' => $definition['slug']],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'] ?? null,
                ]
            );

            $needsUpdate = false;
            if ($definition['name'] !== $tag->name) {
                $tag->name = $definition['name'];
                $needsUpdate = true;
            }

            if (array_key_exists('description', $definition) && $definition['description'] !== $tag->description) {
                $tag->description = $definition['description'];
                $needsUpdate = true;
            }

            if ($needsUpdate) {
                $tag->save();
            }

            return $tag->id;
        })->all();

        $product->tags()->sync($tagIds);
    }

    private function normalizeTagDefinitions(array $values): array
    {
        $normalized = [];

        foreach ($values as $value) {
            if ($value === null || $value === '') {
                continue;
            }

            if (is_array($value)) {
                $slugSource = $value['slug'] ?? $value['name'] ?? '';
                $name = $value['name'] ?? null;
                $description = $value['description'] ?? null;
            } else {
                $slugSource = $value;
                $name = null;
                $description = null;
            }

            $slug = Str::slug((string) $slugSource);

            if ($slug === '') {
                continue;
            }

            if ($name === null) {
                $name = Str::of($slug)->replace('-', ' ')->title();
            }

            $normalized[$slug] = [
                'slug' => $slug,
                'name' => $name,
            ];

            if ($description !== null) {
                $normalized[$slug]['description'] = $description;
            }
        }

        return array_values($normalized);
    }
}
