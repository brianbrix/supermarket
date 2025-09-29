<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliveryResource;
use App\Models\Delivery;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeliveryAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|integer|min:0',
            'size' => 'nullable|integer|min:1|max:200',
            'status' => ['nullable', Rule::in(Delivery::STATUSES)],
            'shopId' => 'nullable|integer|exists:delivery_shops,id',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $page = $validated['page'] ?? 0;
        $size = min(200, max(1, $validated['size'] ?? 20));

    $query = Delivery::query()->with(['shop', 'order.deliveryShop']);
        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (!empty($validated['shopId'])) {
            $query->where('delivery_shop_id', $validated['shopId']);
        }
        if (!empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }
        if (!empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $paginator = $query->orderByDesc('created_at')->paginate($size, ['*'], 'page', $page + 1);

            return response()->json([
                'content' => collect($paginator->items())->map(fn ($delivery) => (new DeliveryResource($delivery))->toArray($request))->all(),
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
        ]);
    }

    public function show(Delivery $delivery): JsonResponse
    {
        $delivery->load(['shop', 'order.items', 'order.deliveryShop']);
        return new DeliveryResource($delivery);
    }

    public function updateStatus(Request $request, Delivery $delivery): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Delivery::STATUSES)],
            'driverName' => ['nullable', 'string', 'max:191'],
            'driverPhone' => ['nullable', 'string', 'max:32'],
            'eta' => ['nullable', 'date'],
            'internalNotes' => ['nullable', 'string'],
        ]);

        $delivery->fill([
            'status' => $data['status'],
            'driver_name' => $data['driverName'] ?? $delivery->driver_name,
            'driver_phone' => $data['driverPhone'] ?? $delivery->driver_phone,
            'eta' => $data['eta'] ?? $delivery->eta,
            'internal_notes' => $data['internalNotes'] ?? $delivery->internal_notes,
        ]);

        $history = $delivery->history ?? [];
        $history[] = [
            'status' => $data['status'],
            'timestamp' => now()->toIso8601String(),
            'notes' => $data['internalNotes'] ?? null,
        ];
        $delivery->history = $history;
        $delivery->save();

        $order = $delivery->order;
        if ($order) {
            $orderUpdates = [
                'delivery_status' => $data['status'],
            ];
            if ($data['status'] === 'ASSIGNED' && $order->delivery_dispatched_at === null) {
                $orderUpdates['delivery_dispatched_at'] = now();
            }
            if ($data['status'] === 'EN_ROUTE' && $order->delivery_dispatched_at === null) {
                $orderUpdates['delivery_dispatched_at'] = now();
            }
            if ($data['status'] === 'DELIVERED') {
                $orderUpdates['delivery_completed_at'] = now();
            }
            if ($data['status'] === 'CANCELLED') {
                $orderUpdates['delivery_completed_at'] = now();
            }
            if ($data['driverPhone'] ?? null) {
                $orderUpdates['delivery_contact_phone'] = $data['driverPhone'];
            }
            $order->fill($orderUpdates);
            $order->save();
        }

        $delivery->load(['shop', 'order.deliveryShop']);
        return new DeliveryResource($delivery);
    }
}
