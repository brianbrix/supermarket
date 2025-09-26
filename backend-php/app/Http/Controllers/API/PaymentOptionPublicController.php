<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\PaymentOption;

class PaymentOptionPublicController extends Controller
{
    public function index() {
        return PaymentOption::where('active', true)->orderBy('name')->get()->map(function($opt){
            $meta = $opt->meta ?? [];
            $channel = $meta['channel'] ?? ($meta['channels'][0] ?? $opt->code);
            $codeUp = strtoupper($opt->code ?? '');
            $chanUp = strtoupper($channel ?? '');
            $provRaw = strtoupper($opt->provider ?? '');
            $provider = (str_contains($codeUp,'MPESA') || str_contains($chanUp,'MPESA') || str_contains($provRaw,'MPESA') || str_contains($provRaw,'SAFARICOM')) ? 'MPESA'
                : ((str_contains($codeUp,'AIRTEL') || str_contains($chanUp,'AIRTEL') || str_contains($provRaw,'AIRTEL')) ? 'AIRTEL' : ($opt->provider ?: 'MPESA'));
            $short = $meta['shortDescription'] ?? ($meta['short_description'] ?? ($meta['description'] ?? null));
            return [
                'id' => $opt->id,
                'code' => $opt->code,
                'displayName' => $opt->name,
                'provider' => $provider,
                'channel' => $channel,
                'supportsStk' => (bool)($meta['supportsStk'] ?? true),
                'shortDescription' => $short,
                'instructionsMarkdown' => $meta['instructionsMarkdown'] ?? null,
                'paybillNumber' => $meta['paybillNumber'] ?? null,
                'tillNumber' => $meta['tillNumber'] ?? null,
                'businessShortCode' => $meta['businessShortCode'] ?? null,
                'recipientPhone' => $meta['recipientPhone'] ?? null,
                'accountReferenceTemplate' => $meta['accountReferenceTemplate'] ?? null,
            ];
        });
    }
}
