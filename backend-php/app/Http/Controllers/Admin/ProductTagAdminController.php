<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductTag;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductTagAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = ProductTag::query()->withCount('products');

        if ($search = trim((string) $request->query('q', ''))) {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $query->where(function ($builder) use ($like) {
                $builder->where('name', 'ilike', $like)
                    ->orWhere('slug', 'ilike', $like)
                    ->orWhere('description', 'ilike', $like);
            });
        }

        $sort = $request->query('sort', 'name');
        $direction = strtolower($request->query('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowedSort = ['id', 'name', 'slug', 'created_at', 'updated_at', 'productCount'];
        if (!in_array($sort, $allowedSort, true)) {
            $sort = 'name';
        }

        if ($sort === 'productCount') {
            $query->orderBy('products_count', $direction);
        } else {
            $query->orderBy($sort, $direction);
        }

        $size = max(1, min(200, (int) $request->query('size', 20)));
        $page = max(0, (int) $request->query('page', 0));
        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);

        $items = array_map(fn (ProductTag $tag) => $this->transform($tag), $paginator->items());

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
        $data = $this->validateInput($request);
        $tag = ProductTag::create($data);

        return response()->json($this->transform($tag), 201);
    }

    public function update(Request $request, ProductTag $productTag)
    {
        $data = $this->validateInput($request, $productTag);
        $productTag->update($data);

        return response()->json($this->transform($productTag));
    }

    public function destroy(ProductTag $productTag)
    {
        $productTag->delete();

        return response()->json(['deleted' => true]);
    }

    private function validateInput(Request $request, ?ProductTag $existing = null): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:500'],
        ];

        $data = $request->validate($rules);

        $name = trim($data['name']);
        $slugCandidate = $data['slug'] ?? '';
        $slug = Str::slug($slugCandidate !== '' ? $slugCandidate : $name);

        if ($slug === '') {
            $slug = 'tag-' . Str::random(6);
        }

        $exists = ProductTag::query()
            ->where('slug', $slug)
            ->when($existing, fn ($query) => $query->where('id', '!=', $existing->id))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'slug' => 'That slug is already in use. Please choose a different one.',
            ]);
        }

        $data['name'] = $name;
        $data['slug'] = $slug;

        if (array_key_exists('description', $data) && $data['description'] !== null) {
            $data['description'] = trim($data['description']);
        }

        return $data;
    }

    private function transform(ProductTag $tag): array
    {
        return [
            'id' => $tag->id,
            'name' => $tag->name,
            'slug' => $tag->slug,
            'description' => $tag->description,
            'productCount' => (int) ($tag->products_count ?? $tag->products()->count()),
            'createdAt' => $tag->created_at?->toIso8601String(),
            'updatedAt' => $tag->updated_at?->toIso8601String(),
        ];
    }
}
