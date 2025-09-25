<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\ProductController;
use App\Http\Controllers\Admin\OrderAdminController;
use App\Http\Controllers\Admin\PaymentAdminController;
use App\Http\Controllers\API\CategoryController;
use App\Http\Controllers\Admin\DashboardAdminController;
use App\Http\Controllers\Admin\AnalyticsAdminController;
use App\Http\Controllers\Admin\ProductAdminController;
use App\Http\Controllers\Admin\PaymentOptionAdminController;
use App\Http\Controllers\API\PaymentController;
use App\Http\Controllers\Auth\AuthController;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/search', [ProductController::class, 'search']);
Route::get('/categories', [CategoryController::class, 'index']);
// Payment public/order scoped endpoints
Route::post('/payments', [PaymentController::class, 'create']);
Route::post('/payments/mobile-money/initiate', [PaymentController::class, 'initiateMobileMoney']);
Route::post('/payments/manual/initiate', [PaymentController::class, 'initiateManual']);
Route::post('/payments/manual/reconcile', [PaymentController::class, 'reconcileManual']);
Route::get('/payments/order/{orderId}', [PaymentController::class, 'getByOrder']);
// Callback webhooks (no auth)
Route::post('/payments/mpesa/callback', [PaymentController::class, 'mpesaCallback']);
Route::post('/payments/airtel/callback', [PaymentController::class, 'airtelCallback']);

// Auth (public)
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Protected routes (apply sanctum middleware after installing Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

Route::middleware(['auth:sanctum','role:ADMIN'])->prefix('admin')->group(function () {
    Route::get('/orders', [OrderAdminController::class, 'index']);
    Route::put('/orders/{order}/status', [OrderAdminController::class, 'updateStatus']);
    Route::get('/payments', [PaymentAdminController::class, 'index']);
    Route::post('/payments/{payment}/confirm', [PaymentController::class, 'confirm']);
    Route::get('/dashboard/stats', [DashboardAdminController::class, 'stats']);
    Route::get('/dashboard/recent-orders', [DashboardAdminController::class, 'recentOrders']);
    Route::get('/analytics/overview', [AnalyticsAdminController::class, 'overview']);
    Route::get('/products', [ProductAdminController::class, 'index']);
    Route::post('/products', [ProductAdminController::class, 'store']);
    Route::put('/products/{product}', [ProductAdminController::class, 'update']);
    Route::delete('/products/{product}', [ProductAdminController::class, 'destroy']);
    Route::get('/payment-options', [PaymentOptionAdminController::class, 'index']);
    Route::post('/payment-options', [PaymentOptionAdminController::class, 'store']);
    Route::put('/payment-options/{paymentOption}', [PaymentOptionAdminController::class, 'update']);
    Route::post('/payment-options/{paymentOption}/activate', [PaymentOptionAdminController::class, 'activate']);
    Route::post('/payment-options/{paymentOption}/deactivate', [PaymentOptionAdminController::class, 'deactivate']);
    // Category mutations (restricted)
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
});
