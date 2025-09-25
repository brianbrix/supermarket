<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\PaymentOption;

class PaymentOptionPublicController extends Controller
{
    public function index() {
        return PaymentOption::where('active', true)->orderBy('name')->get()->map(function($opt){
            return [
                'id' => $opt->id,
                'code' => $opt->code,
                'displayName' => $opt->name,
                'provider' => $opt->provider,
                'channel' => $opt->type, // re-using type as channel if needed
                'supportsStk' => in_array($opt->provider, ['MPESA','AIRTEL']),
                'shortDescription' => $opt->meta['shortDescription'] ?? null,
            ];
        });
    }
}
