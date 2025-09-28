<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Http\Resources\UserAdminResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class UserAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->withCount('orders');

        if ($search = trim((string)$request->query('q', ''))) {
            $query->where(function ($builder) use ($search) {
                $builder->where('username', 'ilike', "%$search%")
                        ->orWhere('email', 'ilike', "%$search%")
                        ->orWhere('first_name', 'ilike', "%$search%")
                        ->orWhere('last_name', 'ilike', "%$search%");
            });
        }

        if ($role = $request->query('role')) {
            $query->where('role', strtoupper($role));
        }

        if ($request->has('active')) {
            $active = filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($active !== null) {
                $query->where('active', $active);
            }
        }

        if ($from = $request->query('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('created_at', '<=', $to);
        }

        $allowedSort = ['created_at', 'updated_at', 'last_login', 'username', 'orders_count'];
        $sort = $request->query('sort', 'created_at');
        if (!in_array($sort, $allowedSort, true)) {
            $sort = 'created_at';
        }
        $direction = strtolower($request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $direction);

        $size = max(1, min(100, (int)$request->query('size', 20)));
        $page = max(0, (int)$request->query('page', 0));

        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);
        $data = UserAdminResource::collection($paginator->items());

        return $this->pageResponse($paginator, $data);
    }

    public function activate(Request $request, User $user)
    {
        if (!$user->active) {
            $user->forceFill(['active' => true])->save();
        }

        return new UserAdminResource($user->fresh()->loadCount('orders'));
    }

    public function deactivate(Request $request, User $user)
    {
        $acting = $request->user();
        if ($acting && $acting->id === $user->id) {
            return response()->json([
                'message' => 'You cannot deactivate your own account while logged in.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($user->active) {
            $user->forceFill(['active' => false])->save();
        }

        return new UserAdminResource($user->fresh()->loadCount('orders'));
    }

    public function orders(Request $request, User $user)
    {
        $query = $user->orders()->with(['items.product']);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($from = $request->query('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('created_at', '<=', $to);
        }

        $sort = $request->query('sort', 'created_at');
        $direction = strtolower($request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSort = ['created_at', 'total_gross', 'status', 'id'];
        if (!in_array($sort, $allowedSort, true)) {
            $sort = 'created_at';
        }
        $query->orderBy($sort, $direction);

        $size = max(1, min(100, (int)$request->query('size', 20)));
        $page = max(0, (int)$request->query('page', 0));
        $paginator = $query->paginate($size, ['*'], 'page', $page + 1);

        $orders = OrderResource::collection($paginator->items());
        return $this->pageResponse($paginator, $orders);
    }

    private function pageResponse($paginator, $data)
    {
        return response()->json([
            'content' => $data,
            'page' => $paginator->currentPage() - 1,
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => count($paginator->items()),
            'first' => $paginator->currentPage() === 1,
            'last' => $paginator->currentPage() === $paginator->lastPage(),
            'sort' => null,
        ]);
    }
}
