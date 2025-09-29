<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliveryShopResource;
use App\Models\DeliveryShop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DeliveryShopAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->has('active')) {
            $rawActive = $request->query('active');
            if (is_string($rawActive)) {
                $normalized = filter_var($rawActive, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($normalized !== null) {
                    $request->merge(['active' => $normalized]);
                }
            }
        }

        $validated = $request->validate([
            'page' => 'nullable|integer|min:0',
            'size' => 'nullable|integer|min:1|max:200',
            'q' => 'nullable|string|max:120',
            'active' => 'nullable|boolean',
        ]);

        $page = $validated['page'] ?? 0;
        $size = min(200, max(1, $validated['size'] ?? 20));

        $query = DeliveryShop::query();
        if (array_key_exists('active', $validated)) {
            $query->where('is_active', (bool) $validated['active']);
        }
        if (!empty($validated['q'])) {
            $q = '%' . strtolower($validated['q']) . '%';
            $query->where(function ($w) use ($q) {
                $w->whereRaw('LOWER(name) LIKE ?', [$q])
                    ->orWhereRaw('LOWER(city) LIKE ?', [$q])
                    ->orWhereRaw('LOWER(region) LIKE ?', [$q]);
            });
        }

        $paginator = $query->orderBy('name')->paginate($size, ['*'], 'page', $page + 1);

        return response()->json([
            'content' => collect($paginator->items())->map(fn ($shop) => (new DeliveryShopResource($shop))->toArray($request))->all(),
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request);

        $record = DeliveryShop::create($data);

        return response()->json((new DeliveryShopResource($record))->toArray($request), 201);
    }

    public function update(Request $request, DeliveryShop $deliveryShop): JsonResponse
    {
        $data = $this->validatePayload($request, $deliveryShop->id);
        $deliveryShop->fill($data);
        $deliveryShop->save();

        return response()->json((new DeliveryShopResource($deliveryShop))->toArray($request));
    }

    public function destroy(DeliveryShop $deliveryShop): JsonResponse
    {
        $deliveryShop->delete();
        return response()->json(['deleted' => true]);
    }

    public function activate(DeliveryShop $deliveryShop): JsonResponse
    {
        $deliveryShop->is_active = true;
        $deliveryShop->save();
        return response()->json((new DeliveryShopResource($deliveryShop))->toArray(request()));
    }

    public function deactivate(DeliveryShop $deliveryShop): JsonResponse
    {
        $deliveryShop->is_active = false;
        $deliveryShop->save();
        return response()->json((new DeliveryShopResource($deliveryShop))->toArray(request()));
    }

    private function validatePayload(Request $request, ?int $shopId = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'slug' => ['nullable', 'string', 'max:191', Rule::unique('delivery_shops', 'slug')->ignore($shopId)],
            'description' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:191'],
            'isActive' => ['nullable', 'boolean'],
            'addressLine1' => ['nullable', 'string', 'max:191'],
            'addressLine2' => ['nullable', 'string', 'max:191'],
            'city' => ['nullable', 'string', 'max:120'],
            'region' => ['nullable', 'string', 'max:120'],
            'postalCode' => ['nullable', 'string', 'max:64'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'serviceRadiusKm' => ['nullable', 'numeric', 'min:0'],
            'openingHours' => ['nullable', 'array'],
            'deliveryWindowMinutes' => ['nullable', 'integer', 'min:0'],
        ]);

        $slug = $validated['slug'] ?? null;
        if (!$slug) {
            $slug = Str::slug($validated['name']);
        }

        return [
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'is_active' => array_key_exists('isActive', $validated) ? (bool) $validated['isActive'] : true,
            'address_line1' => $validated['addressLine1'] ?? null,
            'address_line2' => $validated['addressLine2'] ?? null,
            'city' => $validated['city'] ?? null,
            'region' => $validated['region'] ?? null,
            'postal_code' => $validated['postalCode'] ?? null,
            'lat' => $validated['lat'] ?? null,
            'lng' => $validated['lng'] ?? null,
            'service_radius_km' => $validated['serviceRadiusKm'] ?? null,
            'opening_hours' => $validated['openingHours'] ?? null,
            'delivery_window_minutes' => $validated['deliveryWindowMinutes'] ?? null,
        ];
    }
}
