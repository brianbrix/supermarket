<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class OrderController extends Controller
{
    public function index(Request $request) {
        $query = Order::query()->with(['items.product']);
        if (Auth::check()) {
            $query->where('user_id', Auth::id());
        }
        $paginator = $query->orderByDesc('id')->paginate(min(100,(int)$request->get('size',20)));
        return response()->json([
            'content' => $paginator->items(),
            'page' => $paginator->currentPage()-1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage()===1,
            'last' => $paginator->currentPage()===$paginator->lastPage(),
        ]);
    }

    public function show(Order $order) {
        $order->load(['items.product']);
        return $order;
    }

    public function store(Request $request) {
        $data = $request->validate([
            'customerName' => 'required|string|max:255',
            'customerPhone' => 'required|string|max:32',
            'items' => 'required|array|min:1',
            'items.*.productId' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1'
        ]);

        $vatRate = 0.16; // Align with frontend constant
        return DB::transaction(function() use ($data, $vatRate) {
            $grossTotal = 0; $netTotal = 0; $vatTotal = 0;
            $order = Order::create([
                'customer_name' => $data['customerName'],
                'customer_phone' => $data['customerPhone'],
                'status' => 'PENDING',
                'user_id' => Auth::id(),
                'total_gross' => 0,
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
            $order->update([
                'total_gross' => round($grossTotal,2),
                'total_net' => round($netTotal,2),
                'vat_amount' => round($vatTotal,2)
            ]);
            $order->load(['items.product']);
            return response()->json($order, 201);
        });
    }
}
