<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Services\CouponService;

class OrderController extends Controller
{
    public function index(Request $request) {
        $query = Order::query()->with(['items.product','latestPayment']);
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
        $order->load(['items.product']);
        $order->setAttribute('discountAmount', (float)$order->discount_amount);
        $order->setAttribute('couponCode', $order->coupon_code);
        $order->setAttribute('totalBeforeDiscount', (float)($order->total_gross + $order->discount_amount));
        return $order;
    }

    public function store(Request $request, CouponService $couponService) {
        // accept both camelCase and snake_case just in case
        $request->merge([
            'customer_name' => $request->input('customer_name') ?? $request->input('customerName'),
            'customer_phone' => $request->input('customer_phone') ?? $request->input('customerPhone'),
            'coupon_code' => $request->input('coupon_code') ?? $request->input('couponCode'),
        ]);
        $data = $request->validate([
            'customerName' => 'required|string|max:255',
            'customerPhone' => 'required|string|max:32',
            'items' => 'required|array|min:1',
            'items.*.productId' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'couponCode' => 'nullable|string|max:64'
        ]);

        $vatRate = 0.16; // Align with frontend constant
        return DB::transaction(function() use ($data, $vatRate, $request, $couponService) {
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

            $order->update([
                'total_gross' => $grossAfter,
                'discount_amount' => $discountAmount,
                'total_net' => $netAfter,
                'vat_amount' => $vatAfter,
                'coupon_id' => $coupon?->id,
                'coupon_code' => $coupon?->code,
            ]);

            if ($coupon && $discountAmount > 0) {
                $couponService->recordRedemption($coupon, $discountAmount, $order->fresh(), $authUser, $data['customerPhone'] ?? null);
            }

            $order->load(['items.product']);
            $order->setAttribute('orderNumber', $order->order_number);
            $order->setAttribute('discountAmount', $discountAmount);
            $order->setAttribute('couponCode', $coupon?->code);
            $order->setAttribute('totalBeforeDiscount', round($grossAfter + $discountAmount, 2));
            return response()->json($order, 201);
        });
    }
}
