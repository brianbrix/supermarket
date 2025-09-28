<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\SystemSettingService;

class SystemSettingController extends Controller
{
    public function __construct(private SystemSettingService $settings)
    {
    }

    public function index()
    {
        return response()->json($this->settings->all());
    }
}
