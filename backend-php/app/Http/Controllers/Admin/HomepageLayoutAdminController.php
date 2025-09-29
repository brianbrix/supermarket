<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\HomepageLayoutResource;
use App\Models\HomepageLayout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class HomepageLayoutAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HomepageLayout::query()->with('publishedBy');

        if ($slug = $request->query('slug')) {
            $query->where('slug', $slug);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($request->boolean('active')) {
            $query->where('is_active', true);
        }

        if ($search = $request->query('q')) {
            $like = '%' . addcslashes($search, '%_') . '%';
            $query->where(function ($q) use ($like) {
                $q->where('title', 'like', $like)
                    ->orWhere('slug', 'like', $like);
            });
        }

        $query->orderByDesc('created_at');

        $size = max(1, min(50, (int) $request->query('size', 20)));
        $page = max(0, (int) $request->query('page', 0));

        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);
        $items = array_map(fn ($layout) => $this->formatLayout($layout), $paginator->items());

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

    public function show(HomepageLayout $layout): JsonResponse
    {
        $layout->load('publishedBy');
        return response()->json($this->formatLayout($layout));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9_-]+$/i'],
            'title' => ['nullable', 'string', 'max:255'],
            'layout' => ['required', 'array'],
            'meta' => ['nullable', 'array'],
        ]);

    $slug = Str::slug($data['slug']) ?: 'home';
        $version = (int) (HomepageLayout::where('slug', $slug)->max('version') ?? 0) + 1;

        $layout = HomepageLayout::create([
            'slug' => $slug,
            'version' => $version,
            'title' => $data['title'] ?? null,
            'layout' => $data['layout'],
            'meta' => $data['meta'] ?? [],
            'status' => 'draft',
            'is_active' => false,
        ]);

        $layout->load('publishedBy');

        return response()->json($this->formatLayout($layout), 201);
    }

    public function update(Request $request, HomepageLayout $layout): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'layout' => ['sometimes', 'array'],
            'meta' => ['sometimes', 'nullable', 'array'],
            'status' => ['sometimes', 'string', Rule::in(['draft', 'archived'])],
        ]);

        if (array_key_exists('title', $data)) {
            $layout->title = $data['title'];
        }

        if (array_key_exists('layout', $data)) {
            $layout->layout = $data['layout'];
        }

        if (array_key_exists('meta', $data)) {
            $layout->meta = $data['meta'] ?? [];
        }

        if (array_key_exists('status', $data)) {
            $layout->status = $data['status'];
            if ($data['status'] !== 'published') {
                $layout->is_active = false;
            }
        }

        $layout->save();
        $layout->load('publishedBy');

        return response()->json($this->formatLayout($layout));
    }

    public function publish(Request $request, HomepageLayout $layout): JsonResponse
    {
        if ($layout->status === 'archived') {
            abort(422, 'Archived layouts cannot be published.');
        }

        $userId = $request->user()?->id;

        DB::transaction(function () use ($layout, $userId) {
            HomepageLayout::where('slug', $layout->slug)
                ->where('id', '!=', $layout->id)
                ->get()
                ->each(function (HomepageLayout $other) {
                    $updates = ['is_active' => false];
                    if ($other->status === 'published') {
                        $updates['status'] = 'archived';
                    }
                    $other->update($updates);
                });

            $layout->status = 'published';
            $layout->is_active = true;
            $layout->published_at = now();
            if ($userId) {
                $layout->published_by = $userId;
            }
            $layout->save();
        });

        $layout->load('publishedBy');

        return response()->json($this->formatLayout($layout));
    }

    public function destroy(HomepageLayout $layout): JsonResponse
    {
        if ($layout->is_active) {
            abort(422, 'Cannot delete the active homepage layout.');
        }

        $layout->delete();

        return response()->json(['deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatLayout(HomepageLayout $layout): array
    {
        $resource = new HomepageLayoutResource($layout->loadMissing('publishedBy'));
        return $resource->resolve();
    }
}
