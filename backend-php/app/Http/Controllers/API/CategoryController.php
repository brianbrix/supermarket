<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index() {
        $categories = Category::query()
            ->with('parent')
            ->orderBy('path')
            ->orderBy('name')
            ->get();

        $grouped = $categories->groupBy('parent_id');

        $buildTree = function ($parentId) use (&$buildTree, $grouped) {
            return $grouped->get($parentId, collect())->map(function ($cat) use (&$buildTree) {
                return [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'description' => $cat->description,
                    'slug' => $cat->slug,
                    'path' => $cat->path,
                    'depth' => $cat->depth,
                    'parentId' => $cat->parent_id,
                    'fullName' => $cat->full_name,
                    'children' => $buildTree($cat->id),
                ];
            })->values()->all();
        };

        return response()->json($buildTree(null));
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'parent_id' => ['nullable','integer','exists:categories,id']
        ]);
        $category = Category::create($data);
        return response()->json($category->fresh(), 201);
    }

    public function update(Request $request, Category $category) {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'parent_id' => ['nullable','integer','exists:categories,id']
        ]);
        if (array_key_exists('parent_id', $data)) {
            if ($data['parent_id'] === $category->id) {
                return response()->json(['message' => 'Category cannot reference itself as parent.'], 422);
            }
            if ($data['parent_id']) {
                $newParent = Category::find($data['parent_id']);
                if ($newParent && str_starts_with($newParent->path ?? '', ($category->path ?? '') . '/')) {
                    return response()->json(['message' => 'Cannot assign a descendant as parent.'], 422);
                }
            }
        }
        $category->update($data);
        return $category->fresh();
    }

    public function destroy(Category $category) {
        $parentId = $category->parent_id;
        // Detach child categories to the parent (or promote to root) before deletion
        $category->load('children');
        foreach ($category->children as $child) {
            $child->parent_id = $parentId;
            $child->save();
        }
        // Null out products referencing this category
        $category->products()->update(['category_id' => $parentId]);
        $category->delete();
        return response()->noContent();
    }
}
