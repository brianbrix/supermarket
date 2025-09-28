<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductAdminController extends Controller
{
    public function index(Request $request)
    {
    // Eager load images so admin UI can render thumbnails / reorder without extra round-trips.
    $query = Product::query()->with(['category','images']);
        if ($search = $request->query('q')) {
            $query->where(function($q) use ($search){
                $q->where('name','like',"%$search%")->orWhere('description','like',"%$search%");
            });
        }
        $sort = $request->query('sort','id');
        $direction = strtolower($request->query('direction','desc')) === 'asc' ? 'asc':'desc';
        $allowedSort = ['id','name','price','stock','created_at'];
        if (!in_array($sort,$allowedSort)) $sort='id';
        $query->orderBy($sort,$direction);
        $size = (int)$request->query('size',20);
        $page = (int)$request->query('page',0);
        $paginator = $query->paginate($size,['*'],'page',$page+1);
        // Transform each product to include images array with id/url/position (public API uses a Resource, admin keeps inline)
        $items = array_map(function($p){
            $images = $p->images ? $p->images->map(function($img){
                return [
                    'id' => $img->id,
                    'url' => $img->url,
                    'position' => $img->position,
                ];
            })->values()->all() : [];
            return [
                'id' => $p->id,
                'name' => $p->name,
                'description' => $p->description,
                'price' => $p->price,
                'stock' => $p->stock,
                'unit' => $p->unit,
                'categoryId' => $p->category_id,
                'categoryName' => optional($p->category)->name,
                'imageUrl' => $p->image_url,
                'images' => $images,
                'createdAt' => $p->created_at?->toIso8601String(),
                'updatedAt' => $p->updated_at?->toIso8601String(),
            ];
        }, $paginator->items());

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
            'description' => ['nullable','string'],
            'price' => ['required','numeric','min:0'],
            'stock' => ['required','integer','min:0'],
            'unit' => ['nullable','string','max:50'],
            'category_id' => ['nullable','integer','exists:categories,id'],
            'image_url' => ['nullable','string','max:500'],
        ]);
        $product = Product::create($data);
        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'name' => ['sometimes','string','max:255'],
            'description' => ['sometimes','nullable','string'],
            'price' => ['sometimes','numeric','min:0'],
            'stock' => ['sometimes','integer','min:0'],
            'unit' => ['sometimes','nullable','string','max:50'],
            'category_id' => ['sometimes','nullable','integer','exists:categories,id'],
            'image_url' => ['sometimes','nullable','string','max:500'],
        ]);
        $product->update($data);
        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return response()->json(['deleted'=>true]);
    }
}
