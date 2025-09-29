<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\ProductController;
use App\Http\Controllers\Admin\OrderAdminController;
use App\Http\Controllers\Admin\PaymentAdminController;
use App\Http\Controllers\API\CategoryController;
use App\Http\Controllers\Admin\DashboardAdminController;
use App\Http\Controllers\Admin\AnalyticsAdminController;
use App\Http\Controllers\Admin\ProductAdminController;
use App\Http\Controllers\Admin\CategoryAdminController;
use App\Http\Controllers\Admin\PaymentOptionAdminController;
use App\Http\Controllers\Admin\SystemSettingController as AdminSystemSettingController;
use App\Http\Controllers\API\PaymentController;
use App\Http\Controllers\API\OrderController;
use App\Http\Controllers\API\PaymentOptionPublicController;
use App\Http\Controllers\Admin\AnalyticsExtraController;
use App\Http\Controllers\Admin\UserAdminController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\API\SystemSettingController as PublicSystemSettingController;
use App\Http\Controllers\API\CouponController;
use App\Http\Controllers\Admin\CouponAdminController;
use App\Http\Controllers\API\UserPreferenceController;
use App\Http\Controllers\API\DeliveryController;
use App\Http\Controllers\API\GeocodingController;
use App\Http\Controllers\Admin\DeliveryShopAdminController;
use App\Http\Controllers\Admin\DeliveryAdminController;

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/price-range', [ProductController::class, 'priceRange']);
Route::get('/products/search', [ProductController::class, 'search']);
Route::get('/products/{product}/related', [ProductController::class, 'related'])->whereNumber('product');
Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');
Route::get('/products/category/{category}', [ProductController::class, 'byCategory']);
Route::get('/categories', [CategoryController::class, 'index']);
// Orders (public/user scope – authenticated user association optional)
Route::get('/orders', [OrderController::class, 'index']);
Route::get('/orders/{order}', [OrderController::class, 'show']);
Route::post('/orders', [OrderController::class, 'store']);
Route::get('/user/orders', [OrderController::class, 'index']); // alias expected by frontend
// Payment public/order scoped endpoints
Route::post('/payments', [PaymentController::class, 'create']);
Route::post('/payments/mobile-money/initiate', [PaymentController::class, 'initiateMobileMoney']);
Route::post('/payments/manual/initiate', [PaymentController::class, 'initiateManual']);
Route::post('/payments/manual/reconcile', [PaymentController::class, 'reconcileManual']);
Route::get('/payments/order/{orderId}', [PaymentController::class, 'getByOrder']);
Route::post('/payments/order/{orderId}/fail', [PaymentController::class, 'failByOrder']);
Route::get('/payments/options', [PaymentOptionPublicController::class, 'index']);
Route::get('/settings', [PublicSystemSettingController::class, 'index']);
Route::post('/coupons/preview', [CouponController::class, 'preview']);
Route::get('/delivery/shops', [DeliveryController::class, 'shops']);
Route::post('/delivery/quote', [DeliveryController::class, 'quote']);
Route::get('/geo/search', [GeocodingController::class, 'search'])->middleware('throttle:30,1');
// Callback webhooks (no auth)
Route::post('/payments/mpesa/callback', [PaymentController::class, 'mpesaCallback']);
Route::post('/payments/airtel/callback', [PaymentController::class, 'airtelCallback']);

// Auth (public)
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login'])->name('login');

// Protected routes (apply sanctum middleware after installing Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::get('/user/me', [AuthController::class, 'me']); // alias for frontend expectation
    Route::get('/user/preferences', [UserPreferenceController::class, 'show']);
    Route::put('/user/preferences', [UserPreferenceController::class, 'update']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    // Product image management (non-admin alias paths for existing frontend calls)
    Route::get('/products/{product}/images', [\App\Http\Controllers\Admin\ProductImageController::class, 'index']);
    Route::post('/products/{product}/image', [\App\Http\Controllers\Admin\ProductImageController::class, 'store']);
    Route::post('/products/{product}/images', [\App\Http\Controllers\Admin\ProductImageController::class, 'storeMany']);
    Route::delete('/products/{product}/images/{image}', [\App\Http\Controllers\Admin\ProductImageController::class, 'destroy']);

});

Route::middleware(['auth:sanctum','role:ADMIN'])->prefix('admin')->group(function () {
    Route::get('/orders', [OrderAdminController::class, 'index']);
    Route::put('/orders/{order}/status', [OrderAdminController::class, 'updateStatus']);
    Route::get('/payments', [PaymentAdminController::class, 'index']);
    Route::put('/payments/{payment}/status', [PaymentAdminController::class, 'updateStatus']);
    Route::post('/payments/{payment}/confirm', [PaymentController::class, 'confirm']);
    Route::get('/dashboard/stats', [DashboardAdminController::class, 'stats']);
    Route::get('/dashboard/recent-orders', [DashboardAdminController::class, 'recentOrders']);
    Route::get('/analytics/overview', [AnalyticsAdminController::class, 'overview']);
    Route::get('/analytics/aov', [AnalyticsExtraController::class, 'aov']);
    Route::get('/analytics/unified', [AnalyticsExtraController::class, 'unified']);
    Route::get('/analytics/advanced', [AnalyticsExtraController::class, 'advanced']);
    Route::get('/coupons', [CouponAdminController::class, 'index']);
    Route::post('/coupons', [CouponAdminController::class, 'store']);
    Route::put('/coupons/{coupon}', [CouponAdminController::class, 'update']);
    Route::delete('/coupons/{coupon}', [CouponAdminController::class, 'destroy']);
    Route::post('/coupons/{coupon}/activate', [CouponAdminController::class, 'activate']);
    Route::post('/coupons/{coupon}/deactivate', [CouponAdminController::class, 'deactivate']);
    Route::get('/users', [UserAdminController::class, 'index']);
    Route::post('/users/{user}/activate', [UserAdminController::class, 'activate']);
    Route::post('/users/{user}/deactivate', [UserAdminController::class, 'deactivate']);
    Route::get('/users/{user}/orders', [UserAdminController::class, 'orders']);
    Route::get('/products', [ProductAdminController::class, 'index']);
    Route::post('/products', [ProductAdminController::class, 'store']);
    Route::put('/products/{product}', [ProductAdminController::class, 'update']);
    Route::delete('/products/{product}', [ProductAdminController::class, 'destroy']);
    // Product images
    Route::get('/products/{product}/images', [\App\Http\Controllers\Admin\ProductImageController::class, 'index']);
    Route::post('/products/{product}/image', [\App\Http\Controllers\Admin\ProductImageController::class, 'store']);
    Route::post('/products/{product}/images', [\App\Http\Controllers\Admin\ProductImageController::class, 'storeMany']);
    Route::delete('/products/{product}/images/{image}', [\App\Http\Controllers\Admin\ProductImageController::class, 'destroy']);
    Route::get('/payment-options', [PaymentOptionAdminController::class, 'index']);
    Route::get('/payments/options', [PaymentOptionAdminController::class, 'index']); // alias path to satisfy frontend
    Route::post('/payment-options', [PaymentOptionAdminController::class, 'store']);
    Route::put('/payment-options/{paymentOption}', [PaymentOptionAdminController::class, 'update']);
    Route::delete('/payment-options/{paymentOption}', [PaymentOptionAdminController::class, 'destroy']);
    Route::post('/payment-options/{paymentOption}/activate', [PaymentOptionAdminController::class, 'activate']);
    Route::post('/payment-options/{paymentOption}/deactivate', [PaymentOptionAdminController::class, 'deactivate']);

    // Full alias set under /admin/payments/options for existing frontend expectations
    Route::get('/payments/options', [PaymentOptionAdminController::class, 'index']);
    Route::post('/payments/options', [PaymentOptionAdminController::class, 'store']);
    Route::put('/payments/options/{paymentOption}', [PaymentOptionAdminController::class, 'update']);
    Route::delete('/payments/options/{paymentOption}', [PaymentOptionAdminController::class, 'destroy']);
    Route::get('/system-settings', [AdminSystemSettingController::class, 'index']);
    Route::post('/system-settings', [AdminSystemSettingController::class, 'upsert']);
    // Category mutations (restricted)
    // Read endpoints for admin UI (paged + search)
    Route::get('/categories', [CategoryAdminController::class, 'index']);
    Route::get('/categories/search', [CategoryAdminController::class, 'search']);
    // Write endpoints
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

    Route::get('/delivery/shops', [DeliveryShopAdminController::class, 'index']);
    Route::post('/delivery/shops', [DeliveryShopAdminController::class, 'store']);
    Route::put('/delivery/shops/{deliveryShop}', [DeliveryShopAdminController::class, 'update']);
    Route::delete('/delivery/shops/{deliveryShop}', [DeliveryShopAdminController::class, 'destroy']);
    Route::post('/delivery/shops/{deliveryShop}/activate', [DeliveryShopAdminController::class, 'activate']);
    Route::post('/delivery/shops/{deliveryShop}/deactivate', [DeliveryShopAdminController::class, 'deactivate']);

    Route::get('/deliveries', [DeliveryAdminController::class, 'index']);
    Route::get('/deliveries/{delivery}', [DeliveryAdminController::class, 'show']);
    Route::put('/deliveries/{delivery}/status', [DeliveryAdminController::class, 'updateStatus']);
});
