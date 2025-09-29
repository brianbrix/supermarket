<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = Category::query()->withCount('products')->with('parent');
        // Sorting
        $sort = $request->query('sort','path');
        $direction = strtolower($request->query('direction','asc')) === 'desc' ? 'desc' : 'asc';
        $allowedSort = ['id','name','created_at','path','depth'];
        if (!in_array($sort, $allowedSort)) { $sort = 'name'; }
        if ($sort === 'name') {
            $query->orderBy('path')->orderBy('name', $direction);
        } else {
            $query->orderBy($sort, $direction);
        }

        // Pagination (frontend uses zero-based page)
        $size = max(1, (int)$request->query('size', 20));
        $page = max(0, (int)$request->query('page', 0));
        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);

        $items = array_map(function($c){
            return [
                'id' => $c->id,
                'name' => $c->name,
                'description' => $c->description,
                'productCount' => $c->products_count,
                'parentId' => $c->parent_id,
                'parentName' => $c->parent?->name,
                'fullName' => $c->full_name,
                'path' => $c->path,
                'depth' => $c->depth,
                'createdAt' => $c->created_at?->toIso8601String(),
                'updatedAt' => $c->updated_at?->toIso8601String(),
            ];
        }, $paginator->items());

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

    public function search(Request $request)
    {
        $q = trim((string)$request->query('q', ''));
    $query = Category::query()->withCount('products')->with('parent');
        if ($q !== '') {
            $query->where(function($w) use ($q){
                $w->where('name','like',"%$q%")
                  ->orWhere('description','like',"%$q%");
            });
        }

        // Sorting and pagination same as index
        $sort = $request->query('sort','path');
        $direction = strtolower($request->query('direction','asc')) === 'desc' ? 'desc' : 'asc';
        $allowedSort = ['id','name','created_at','path','depth'];
        if (!in_array($sort, $allowedSort)) { $sort = 'name'; }
        if ($sort === 'name') {
            $query->orderBy('path')->orderBy('name', $direction);
        } else {
            $query->orderBy($sort, $direction);
        }

        $size = max(1, (int)$request->query('size', 20));
        $page = max(0, (int)$request->query('page', 0));
        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);

        $items = array_map(function($c){
            return [
                'id' => $c->id,
                'name' => $c->name,
                'description' => $c->description,
                'productCount' => $c->products_count,
                'parentId' => $c->parent_id,
                'parentName' => $c->parent?->name,
                'fullName' => $c->full_name,
                'path' => $c->path,
                'depth' => $c->depth,
                'createdAt' => $c->created_at?->toIso8601String(),
                'updatedAt' => $c->updated_at?->toIso8601String(),
            ];
        }, $paginator->items());

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
}
