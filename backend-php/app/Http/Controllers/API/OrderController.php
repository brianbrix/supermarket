<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliveryResource;
use App\Http\Resources\DeliveryShopResource;
use App\Models\Order;
use App\Models\Delivery;
use App\Models\DeliveryShop;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Services\AdminNotificationService;
use App\Services\CouponService;
use App\Services\DeliveryCostService;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function index(Request $request) {
    $query = Order::query()->with(['items.product','latestPayment','deliveryShop','delivery.shop']);
        // Prefer Sanctum token user; fallback to default guard if present
        $authUser = $request->user('sanctum') ?? Auth::user();
        if ($authUser) {
            $query->where('user_id', $authUser->id);
        }
        $paginator = $query->orderByDesc('id')->paginate(min(100,(int)$request->get('size',20)));
        $content = $paginator->getCollection()->map(function (Order $order) {
            $latest = $order->latestPayment;
            return [
                'id' => $order->id,
                'customerName' => $order->customer_name,
                'customerPhone' => $order->customer_phone,
                'status' => $order->status,
                'orderNumber' => $order->order_number,
                'totalGross' => (float)$order->total_gross,
                'totalBeforeDiscount' => (float)($order->total_gross + $order->discount_amount),
                'discountAmount' => (float)$order->discount_amount,
                'couponCode' => $order->coupon_code,
                'totalNet' => (float)$order->total_net,
                'vatAmount' => (float)$order->vat_amount,
                'createdAt' => optional($order->created_at)->toIso8601String(),
                'updatedAt' => optional($order->updated_at)->toIso8601String(),
                'deliveryType' => $order->delivery_type,
                'deliveryStatus' => $order->delivery_status,
                'deliveryCost' => $order->delivery_cost !== null ? (float)$order->delivery_cost : null,
                'deliveryDistanceKm' => $order->delivery_distance_km !== null ? (float)$order->delivery_distance_km : null,
                'deliveryAddress' => [
                    'line1' => $order->delivery_address_line1,
                    'line2' => $order->delivery_address_line2,
                    'city' => $order->delivery_city,
                    'region' => $order->delivery_region,
                    'postalCode' => $order->delivery_postal_code,
                    'lat' => $order->delivery_lat,
                    'lng' => $order->delivery_lng,
                ],
                'deliveryContact' => [
                    'phone' => $order->delivery_contact_phone,
                    'email' => $order->delivery_contact_email,
                    'notes' => $order->delivery_notes,
                ],
                'paymentStatus' => $latest?->status,
                'paymentMethod' => $latest?->method,
                'paymentProgress' => $latest ? [
                    'id' => $latest->id,
                    'status' => $latest->status,
                    'method' => $latest->method,
                    'provider' => $latest->provider,
                    'channel' => $latest->channel,
                    'amount' => (float)$latest->amount,
                    'createdAt' => optional($latest->created_at)->toIso8601String(),
                    'updatedAt' => optional($latest->updated_at)->toIso8601String(),
                    'externalRequestId' => $latest->external_request_id,
                    'externalTransactionId' => $latest->external_transaction_id,
                ] : null,
                'items' => $order->items->map(function (OrderItem $item) {
                    return [
                        'id' => $item->id,
                        'productId' => $item->product_id,
                        'productName' => $item->product->name ?? $item->product_name ?? '',
                        'quantity' => (int)$item->quantity,
                        'unitPriceGross' => (float)$item->unit_price_gross,
                        'unitPriceNet' => (float)$item->unit_price_net,
                        'vatAmount' => (float)$item->vat_amount,
                    ];
                })->values()->all(),
                'deliveryShop' => $order->deliveryShop ? (new DeliveryShopResource($order->deliveryShop))->toArray(request()) : null,
                'deliveryRecord' => $order->delivery ? (new DeliveryResource($order->delivery->loadMissing('shop')))->toArray(request()) : null,
            ];
        })->values()->all();

        return response()->json([
            'content' => $content,
            'page' => $paginator->currentPage()-1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($content),
            'first' => $paginator->currentPage()===1,
            'last' => $paginator->currentPage()===$paginator->lastPage(),
        ]);
    }

    public function show(Order $order) {
    $order->load(['items.product', 'deliveryShop', 'delivery.shop']);
        $order->setAttribute('discountAmount', (float)$order->discount_amount);
        $order->setAttribute('couponCode', $order->coupon_code);
        $order->setAttribute('totalBeforeDiscount', (float)($order->total_gross + $order->discount_amount));
        return new OrderResource($order);
    }

    public function store(Request $request, CouponService $couponService, DeliveryCostService $deliveryCostService, AdminNotificationService $notifications) {
        // accept both camelCase and snake_case just in case
        $request->merge([
            'customer_name' => $request->input('customer_name') ?? $request->input('customerName'),
            'customer_phone' => $request->input('customer_phone') ?? $request->input('customerPhone'),
            'coupon_code' => $request->input('coupon_code') ?? $request->input('couponCode'),
            'delivery_type' => $request->input('delivery_type') ?? $request->input('deliveryType') ?? 'pickup',
            'delivery_shop_id' => $request->input('delivery_shop_id') ?? $request->input('deliveryShopId'),
            'delivery_address_line1' => $request->input('delivery_address_line1') ?? $request->input('deliveryAddressLine1'),
            'delivery_address_line2' => $request->input('delivery_address_line2') ?? $request->input('deliveryAddressLine2'),
            'delivery_city' => $request->input('delivery_city') ?? $request->input('deliveryCity'),
            'delivery_region' => $request->input('delivery_region') ?? $request->input('deliveryRegion'),
            'delivery_postal_code' => $request->input('delivery_postal_code') ?? $request->input('deliveryPostalCode'),
            'delivery_contact_phone' => $request->input('delivery_contact_phone') ?? $request->input('deliveryContactPhone'),
            'delivery_contact_email' => $request->input('delivery_contact_email') ?? $request->input('deliveryContactEmail'),
            'delivery_notes' => $request->input('delivery_notes') ?? $request->input('deliveryNotes'),
            'delivery_lat' => $request->input('delivery_lat') ?? $request->input('deliveryLat'),
            'delivery_lng' => $request->input('delivery_lng') ?? $request->input('deliveryLng'),
        ]);
        $data = $request->validate([
            'customerName' => 'required|string|max:255',
            'customerPhone' => 'required|string|max:32',
            'items' => 'required|array|min:1',
            'items.*.productId' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'couponCode' => 'nullable|string|max:64',
            'delivery_type' => 'nullable|string|in:pickup,delivery,PICKUP,DELIVERY',
            'delivery_shop_id' => 'nullable|integer|exists:delivery_shops,id',
            'delivery_address_line1' => 'nullable|string|max:191',
            'delivery_address_line2' => 'nullable|string|max:191',
            'delivery_city' => 'nullable|string|max:120',
            'delivery_region' => 'nullable|string|max:120',
            'delivery_postal_code' => 'nullable|string|max:64',
            'delivery_contact_phone' => 'nullable|string|max:32',
            'delivery_contact_email' => 'nullable|email|max:191',
            'delivery_notes' => 'nullable|string|max:1000',
            'delivery_lat' => 'nullable|numeric|between:-90,90',
            'delivery_lng' => 'nullable|numeric|between:-180,180',
        ]);

        $normalizedDeliveryType = strtoupper($request->input('delivery_type', 'PICKUP'));
        if (!in_array($normalizedDeliveryType, Order::DELIVERY_TYPES, true)) {
            $normalizedDeliveryType = 'PICKUP';
        }

        if ($normalizedDeliveryType === 'DELIVERY') {
            if (!$request->filled('delivery_shop_id')) {
                throw ValidationException::withMessages([
                    'deliveryShopId' => 'Please select a delivery shop.',
                ]);
            }
            if (!$request->filled('delivery_address_line1')) {
                throw ValidationException::withMessages([
                    'deliveryAddressLine1' => 'Delivery address line 1 is required.',
                ]);
            }
            if (!$request->filled('delivery_lat') || !$request->filled('delivery_lng')) {
                throw ValidationException::withMessages([
                    'deliveryLat' => 'Delivery location coordinates are required for cost estimation.',
                ]);
            }
        }

        $vatRate = 0.16; // Align with frontend constant
        $deliveryType = $normalizedDeliveryType;

        return DB::transaction(function() use ($data, $vatRate, $request, $couponService, $deliveryType, $deliveryCostService, $notifications) {
            $grossTotal = 0; $netTotal = 0; $vatTotal = 0;
            $authUser = $request->user('sanctum') ?? Auth::user();
            $order = Order::create([
                'customer_name' => $data['customerName'],
                'customer_phone' => $data['customerPhone'],
                'status' => 'PENDING',
                'user_id' => $authUser?->id,
                'total_gross' => 0,
                'discount_amount' => 0,
                'total_net' => 0,
                'vat_amount' => 0,
            ]);
            $touchedProducts = [];
            foreach ($data['items'] as $line) {
                $product = Product::lockForUpdate()->findOrFail($line['productId']);
                if ($product->stock !== null && $product->stock < $line['quantity']) {
                    abort(422, 'Insufficient stock for product '.$product->id);
                }
                // Basic pricing assumption: product->price is VAT-inclusive gross
                $unitGross = (float)$product->price;
                $unitNet = $unitGross / (1+$vatRate);
                $unitVat = $unitGross - $unitNet;
                $lineGross = $unitGross * $line['quantity'];
                $lineNet = $unitNet * $line['quantity'];
                $lineVat = $unitVat * $line['quantity'];
                $grossTotal += $lineGross; $netTotal += $lineNet; $vatTotal += $lineVat;
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $line['quantity'],
                    'unit_price_gross' => $unitGross,
                    'unit_price_net' => $unitNet,
                    'vat_amount' => $unitVat,
                ]);
                if ($product->stock !== null) {
                    $product->stock -= $line['quantity'];
                    $product->save();
                    $touchedProducts[$product->id] = $product->fresh();
                }
            }

            $coupon = null;
            $discountAmount = 0.0;
            $couponCode = $request->input('couponCode') ?? $request->input('coupon_code');
            if ($couponCode) {
                [$coupon, $discountAmount] = $couponService->validateForCart(
                    $couponCode,
                    (float)$grossTotal,
                    $authUser,
                    $data['customerPhone'] ?? null
                );
            }

            $grossTotal = round($grossTotal, 2);
            $netTotal = round($netTotal, 2);
            $vatTotal = round($vatTotal, 2);

            $discountAmount = min(round($discountAmount, 2), $grossTotal);
            $ratio = $grossTotal > 0 ? ($discountAmount / $grossTotal) : 0;
            $netDiscount = round($netTotal * $ratio, 2);
            $vatDiscount = round($vatTotal * $ratio, 2);

            $grossAfter = round($grossTotal - $discountAmount, 2);
            $netAfter = round(max($netTotal - $netDiscount, 0), 2);
            $vatAfter = round(max($vatTotal - $vatDiscount, 0), 2);

            $deliveryAttributes = [
                'delivery_type' => $deliveryType,
                'delivery_status' => null,
                'delivery_shop_id' => null,
                'delivery_requested_at' => null,
                'delivery_dispatched_at' => null,
                'delivery_completed_at' => null,
                'delivery_address_line1' => null,
                'delivery_address_line2' => null,
                'delivery_city' => null,
                'delivery_region' => null,
                'delivery_postal_code' => null,
                'delivery_lat' => null,
                'delivery_lng' => null,
                'delivery_distance_km' => null,
                'delivery_cost' => null,
                'delivery_contact_phone' => null,
                'delivery_contact_email' => null,
                'delivery_notes' => null,
            ];

            $createdDelivery = null;

            if ($deliveryType === 'DELIVERY') {
                $shop = DeliveryShop::query()->active()->findOrFail($request->input('delivery_shop_id'));
                $destinationLat = (float)$request->input('delivery_lat');
                $destinationLng = (float)$request->input('delivery_lng');
                $quote = $deliveryCostService->calculate($shop, $destinationLat, $destinationLng, $grossAfter);
                $config = $deliveryCostService->config();
                $maxRadius = $shop->service_radius_km ?? $config['default_radius'];
                if ($maxRadius > 0 && $quote['distanceKm'] > $maxRadius) {
                    throw ValidationException::withMessages([
                        'deliveryLat' => 'Delivery address is outside the service radius for the selected shop.',
                    ]);
                }

                $now = now();
                $deliveryAttributes = array_merge($deliveryAttributes, [
                    'delivery_status' => 'REQUESTED',
                    'delivery_shop_id' => $shop->id,
                    'delivery_requested_at' => $now,
                    'delivery_address_line1' => $request->input('delivery_address_line1'),
                    'delivery_address_line2' => $request->input('delivery_address_line2'),
                    'delivery_city' => $request->input('delivery_city'),
                    'delivery_region' => $request->input('delivery_region'),
                    'delivery_postal_code' => $request->input('delivery_postal_code'),
                    'delivery_lat' => $destinationLat,
                    'delivery_lng' => $destinationLng,
                    'delivery_distance_km' => $quote['distanceKm'],
                    'delivery_cost' => $quote['cost'],
                    'delivery_contact_phone' => $request->input('delivery_contact_phone') ?: $data['customerPhone'],
                    'delivery_contact_email' => $request->input('delivery_contact_email'),
                    'delivery_notes' => $request->input('delivery_notes'),
                ]);

                $createdDelivery = Delivery::create([
                    'order_id' => $order->id,
                    'delivery_shop_id' => $shop->id,
                    'status' => 'REQUESTED',
                    'history' => [
                        [
                            'status' => 'REQUESTED',
                            'timestamp' => $now->toIso8601String(),
                            'notes' => 'Delivery requested at checkout',
                        ],
                    ],
                ]);
            }

            $order->update([
                'total_gross' => $grossAfter,
                'discount_amount' => $discountAmount,
                'total_net' => $netAfter,
                'vat_amount' => $vatAfter,
                'coupon_id' => $coupon?->id,
                'coupon_code' => $coupon?->code,
            ] + $deliveryAttributes);

            if ($coupon && $discountAmount > 0) {
                $couponService->recordRedemption($coupon, $discountAmount, $order->fresh(), $authUser, $data['customerPhone'] ?? null);
            }

            $order->load(['items.product', 'deliveryShop', 'delivery.shop']);
            $order->setAttribute('orderNumber', $order->order_number);
            $order->setAttribute('discountAmount', $discountAmount);
            $order->setAttribute('couponCode', $coupon?->code);
            $order->setAttribute('totalBeforeDiscount', round($grossAfter + $discountAmount, 2));
            if ($createdDelivery) {
                $order->setRelation('delivery', $createdDelivery->fresh('shop'));
            }

            try {
                $notifications->notifyNewOrder($order);
                $notifications->notifyHighValueOrder($order);
                $notifications->notifyDeliveryRequest($order);
                foreach ($touchedProducts as $product) {
                    $notifications->notifyLowStock($product);
                }
            } catch (\Throwable $e) {
                report($e);
            }
            return response()->json($order, 201);
        });
    }
}
