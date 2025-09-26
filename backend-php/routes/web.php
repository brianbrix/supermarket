<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

// Fallback to serve storage files if symlink isn't followed (artisan serve should follow symlinks, but this ensures dev works)
Route::get('/storage/{path}', function ($path) {
    $path = ltrim($path, '/');
    if (!Storage::disk('public')->exists($path)) {
        abort(404);
    }
    $mime = Storage::disk('public')->mimeType($path) ?: 'application/octet-stream';
    $stream = Storage::disk('public')->readStream($path);
    return new StreamedResponse(function() use ($stream) {
        fpassthru($stream);
    }, 200, [
        'Content-Type' => $mime,
        'Cache-Control' => 'public, max-age=31536000'
    ]);
})->where('path', '.*');
