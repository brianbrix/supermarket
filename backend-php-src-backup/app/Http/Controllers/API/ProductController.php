<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;

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
        $sort = $request->get('sort', 'name');
        $direction = strtolower($request->get('direction', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowed = ['name','price','stock','id','created_at'];
        if (!in_array($sort, $allowed, true)) { $sort = 'name'; }
        $query = Product::query()->with(['category','images']);
        if ($q) {
            $query->where('name','ilike',"%$q%")
                  ->orWhere('description','ilike',"%$q%");
        }
        $pageSize = min(100, (int)$request->get('size', 20));
        $paginator = $query->orderBy($sort, $direction)->paginate($pageSize);
        return $this->pageResponse($paginator, ProductResource::collection($paginator->items()));
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
