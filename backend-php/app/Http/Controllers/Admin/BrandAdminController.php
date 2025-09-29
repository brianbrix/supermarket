<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BrandResource;
use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class BrandAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = Brand::query()->with('categories');

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

        if ($request->filled('categoryId')) {
            $categoryId = (int) $request->query('categoryId');
            $query->whereHas('categories', function ($q) use ($categoryId) {
                $q->where('categories.id', $categoryId);
            });
        }

        if ($request->filled('active')) {
            $value = strtolower((string) $request->query('active'));
            $truthy = ['1', 'true', 'yes', 'on'];
            $falsy = ['0', 'false', 'no', 'off'];
            if (in_array($value, $truthy, true)) {
                $query->where('is_active', true);
            } elseif (in_array($value, $falsy, true)) {
                $query->where('is_active', false);
            }
        }

        $allowedSort = ['id', 'name', 'slug', 'created_at', 'updated_at'];
        $sort = $request->query('sort', 'name');
        if (!in_array($sort, $allowedSort, true)) {
            $sort = 'name';
        }

        $direction = strtolower((string) $request->query('direction', 'asc')) === 'desc' ? 'desc' : 'asc';

        $size = (int) $request->query('size', 20);
        if ($size < 1) {
            $size = 1;
        } elseif ($size > 200) {
            $size = 200;
        }

        $page = (int) $request->query('page', 0);

        $paginator = $query
            ->orderBy($sort, $direction)
            ->paginate($size, ['*'], 'page', $page + 1);

        $items = BrandResource::collection($paginator->getCollection())->toArray($request);

        return response()->json([
            'content' => $items,
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

    public function store(Request $request)
    {
        $payload = $this->validatePayload($request);

        $brand = Brand::create([
            'name' => $payload['name'],
            'description' => $payload['description'] ?? null,
            'is_active' => $payload['is_active'],
            'slug' => $payload['slug'] ?? null,
        ]);

        $categoryIds = $payload['category_ids'] ?? [];
        if (!empty($categoryIds)) {
            $brand->categories()->sync($categoryIds);
        }

        return (new BrandResource($brand->fresh('categories')))
            ->additional(['message' => 'Brand created successfully.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, Brand $brand)
    {
        $payload = $this->validatePayload($request, $brand->id);

        $brand->fill([
            'name' => $payload['name'],
            'description' => $payload['description'] ?? null,
            'is_active' => $payload['is_active'],
        ]);

        if (!empty($payload['slug'])) {
            $brand->slug = $payload['slug'];
        }

        $brand->save();

        if (array_key_exists('category_ids', $payload)) {
            $brand->categories()->sync($payload['category_ids']);
        }

        return new BrandResource($brand->fresh('categories'));
    }

    public function destroy(Brand $brand)
    {
        $brand->delete();
        return response()->json(['deleted' => true]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'is_active' => ['sometimes'],
            'active' => ['sometimes'],
            'categoryIds' => ['sometimes', 'array'],
            'categoryIds.*' => ['integer', 'exists:categories,id'],
            'categories' => ['sometimes', 'array'],
            'categories.*' => ['integer', 'exists:categories,id'],
        ]);

        $isActive = $this->normalizeBoolean($data['is_active'] ?? $data['active'] ?? true);

        $payload = [
            'name' => trim($data['name']),
            'description' => array_key_exists('description', $data) ? ($data['description'] ?? null) : null,
            'is_active' => $isActive,
        ];

        if (array_key_exists('slug', $data)) {
            $customSlug = trim((string) $data['slug']);
            $payload['slug'] = $customSlug !== '' ? Str::slug($customSlug) : null;
        }

        $categories = $data['categoryIds'] ?? $data['categories'] ?? null;
        if ($categories !== null) {
            $payload['category_ids'] = collect(Arr::wrap($categories))
                ->filter(fn ($value) => $value !== null && $value !== '')
                ->map(fn ($value) => (int) $value)
                ->unique()
                ->values()
                ->all();
        }

        return $payload;
    }

    private function normalizeBoolean($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if ($value === null) {
            return true;
        }

        $normalized = strtolower((string) $value);
        $truthy = ['1', 'true', 'yes', 'on'];
        $falsy = ['0', 'false', 'no', 'off'];

        if (in_array($normalized, $truthy, true)) {
            return true;
        }

        if (in_array($normalized, $falsy, true)) {
            return false;
        }

        return true;
    }
}
