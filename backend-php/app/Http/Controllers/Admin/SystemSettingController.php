<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\SystemSettingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SystemSettingController extends Controller
{
    public function __construct(private SystemSettingService $settings)
    {
    }

    public function index()
    {
        return response()->json($this->settings->listWithMeta());
    }

    public function upsert(Request $request)
    {
        $data = $request->validate([
            'settings' => ['required', 'array', 'min:1'],
            'settings.*.key' => ['required', 'string', 'max:191'],
            'settings.*.type' => ['sometimes', 'nullable', 'string', 'in:string,number,boolean,json'],
            'settings.*.value' => ['nullable'],
        ]);

        $saved = $this->settings->upsertMany($data['settings']);

        return response()->json($saved);
    }

    public function refreshCache()
    {
        Cache::flush();
        $this->settings->flushCache();

        return response()->json([
            'refreshed' => true,
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
