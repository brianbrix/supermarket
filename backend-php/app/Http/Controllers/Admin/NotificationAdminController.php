<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Services\AdminNotificationService;
use Illuminate\Http\Request;

class NotificationAdminController extends Controller
{
    public function __construct(private AdminNotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $filters = [
            'type' => $request->query('type'),
            'severity' => $request->query('severity'),
            'unread' => $request->query('unread'),
            'search' => $request->query('q'),
        ];
        $page = max(1, (int) $request->query('page', 1));
        $size = max(1, min(100, (int) $request->query('size', 20)));

        $this->notifications->syncDelayedOrders();

        $paginator = $this->notifications->list($filters, $page, $size);

        return response()->json([
            'content' => $paginator->items(),
            'page' => $paginator->currentPage(),
            'size' => $paginator->perPage(),
            'totalPages' => $paginator->lastPage(),
            'totalElements' => $paginator->total(),
            'numberOfElements' => $paginator->count(),
            'first' => $paginator->onFirstPage(),
            'last' => !$paginator->hasMorePages(),
            'unreadCount' => AdminNotification::query()->whereNull('read_at')->count(),
        ]);
    }

    public function markAllRead()
    {
        $updated = $this->notifications->markAllRead();

        return response()->json([
            'updated' => $updated,
        ]);
    }

    public function update(AdminNotification $notification, Request $request)
    {
        $data = $request->validate([
            'read' => ['required', 'boolean'],
        ]);

        $this->notifications->markRead($notification, $data['read']);

        return response()->json($notification->fresh());
    }
}
