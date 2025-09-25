<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index() {
        return Category::orderBy('name')->get();
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string'
        ]);
        return response()->json(Category::create($data), 201);
    }

    public function update(Request $request, Category $category) {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string'
        ]);
        $category->update($data);
        return $category;
    }

    public function destroy(Category $category) {
        $category->delete();
        return response()->noContent();
    }
}
