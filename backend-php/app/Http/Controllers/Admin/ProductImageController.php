<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductImageResource;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImageController extends Controller
{
    public function index(Product $product)
    {
        $product->load('images');
        return ProductImageResource::collection($product->images);
    }

    public function store(Product $product, Request $request)
    {
        $request->validate([
            'file' => ['required','file','image','mimes:jpg,jpeg,png,webp','max:3072'], // 3MB
        ]);
        return $this->persistAndRespond($product, $request->file('file'));
    }

    public function storeMany(Product $product, Request $request)
    {
        // Accept both FormData patterns: files[] (HTML convention) and repeated 'files'
        // Some frontend code may append('files', file) instead of 'files[]'. This method normalizes both.
        $files = $request->file('files');

        // If a single file was provided under 'file', treat as multi-upload of one.
        if (!$files && $request->hasFile('file')) {
            $files = [$request->file('file')];
        }

        // Normalize to array (Laravel returns single UploadedFile if not array input)
        if ($files instanceof \Illuminate\Http\UploadedFile) {
            $files = [$files];
        }

        if (!is_array($files)) {
            $files = array_filter((array)$files);
        }

        if (empty($files)) {
            return response()->json([
                'success' => false,
                'message' => 'No files uploaded',
                'errors' => [ 'files' => ['At least one image file is required'] ]
            ], 422);
        }

        $errors = [];
        $allowedMimes = ['image/jpeg','image/png','image/jpg','image/webp'];
        foreach ($files as $idx => $file) {
            if (!$file->isValid()) {
                $errors["files.$idx"][] = 'Upload failed';
                continue;
            }
            $mime = $file->getMimeType();
            if (!in_array($mime, $allowedMimes)) {
                $errors["files.$idx"][] = 'Unsupported image type';
            }
            if ($file->getSize() > 3 * 1024 * 1024) { // 3MB
                $errors["files.$idx"][] = 'File exceeds 3MB limit';
            }
        }

        if (!empty($errors)) {
            return response()->json([
                'success' => false,
                'message' => 'One or more files were invalid',
                'errors' => $errors
            ], 422);
        }

        $created = [];
        foreach ($files as $file) {
            $created[] = $this->persistAndRespond($product, $file, false);
        }
        return ProductImageResource::collection(collect($created));
    }

    public function destroy(Product $product, ProductImage $image)
    {
        if ($image->product_id !== $product->id) {
            return response()->json(['success'=>false,'message'=>'Image does not belong to product'], 422);
        }
        // Attempt to delete file (ignore failures)
        if ($image->url && Str::startsWith($image->url, '/storage/')) {
            $relative = Str::after($image->url, '/storage/');
            Storage::disk('public')->delete($relative);
        }
        $image->delete();
        return response()->json(['deleted'=>true]);
    }

    private function persistAndRespond(Product $product, $uploadedFile, bool $wrapResource = true)
    {
        $path = $uploadedFile->store('products/'.$product->id, 'public');
        $position = (int)ProductImage::where('product_id',$product->id)->max('position');
        $image = ProductImage::create([
            'product_id' => $product->id,
            // Use Storage::url to respect filesystem config (APP_URL) and keep consistency.
            'url' => Storage::url($path),
            'position' => $position + 1,
        ]);
        return $wrapResource ? new ProductImageResource($image) : $image;
    }
}
