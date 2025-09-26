<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentOption;
use Illuminate\Http\Request;

class PaymentOptionAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = PaymentOption::query();
        if ($request->has('active')) {
            $active = filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($active !== null) $query->where('active',$active);
        }
        $items = $query->orderBy('code')->get()->map(function(PaymentOption $opt){
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
                'provider' => $provider,
                'channel' => $channel,
                'displayName' => $opt->name,
                'shortDescription' => $short,
                'instructionsMarkdown' => $meta['instructionsMarkdown'] ?? null,
                'paybillNumber' => $meta['paybillNumber'] ?? null,
                'tillNumber' => $meta['tillNumber'] ?? null,
                'businessShortCode' => $meta['businessShortCode'] ?? null,
                'recipientPhone' => $meta['recipientPhone'] ?? null,
                'accountReferenceTemplate' => $meta['accountReferenceTemplate'] ?? null,
                'supportsStk' => (bool)($meta['supportsStk'] ?? true),
                'active' => (bool)$opt->active,
                'sortOrder' => (int)($meta['sortOrder'] ?? 0),
                'metadataJson' => $meta['metadataJson'] ?? ''
            ];
        })->values();
        return response()->json($items);
    }

    public function store(Request $request)
    {
        // Accept admin UI camelCase fields
        $data = $request->validate([
            'provider' => ['required','string','in:MPESA,AIRTEL'],
            'channel' => ['required','string','max:64'],
            'displayName' => ['required','string','max:255'],
            'shortDescription' => ['nullable','string','max:255'],
            'instructionsMarkdown' => ['nullable','string'],
            'paybillNumber' => ['nullable','string','max:32'],
            'tillNumber' => ['nullable','string','max:32'],
            'businessShortCode' => ['nullable','string','max:32'],
            'recipientPhone' => ['nullable','string','max:32'],
            'accountReferenceTemplate' => ['nullable','string','max:64'],
            'supportsStk' => ['nullable','boolean'],
            'active' => ['nullable','boolean'],
            'sortOrder' => ['nullable','integer'],
            'metadataJson' => ['nullable','string'],
        ]);
        // Allow aliases like 'description' or 'short_description'
        $shortDesc = $data['shortDescription']
            ?? $request->input('short_description')
            ?? $request->input('description');
        $meta = [
            'channel' => $data['channel'],
            'shortDescription' => $shortDesc ?? null,
            'instructionsMarkdown' => $data['instructionsMarkdown'] ?? null,
            'paybillNumber' => $data['paybillNumber'] ?? null,
            'tillNumber' => $data['tillNumber'] ?? null,
            'businessShortCode' => $data['businessShortCode'] ?? null,
            'recipientPhone' => $data['recipientPhone'] ?? null,
            'accountReferenceTemplate' => $data['accountReferenceTemplate'] ?? null,
            'supportsStk' => (bool)($data['supportsStk'] ?? true),
            'sortOrder' => (int)($data['sortOrder'] ?? 0),
            'metadataJson' => $data['metadataJson'] ?? ''
        ];
        $code = strtoupper(($request->input('code') ?: ($data['provider'].'_'.$data['channel'])));
        $option = PaymentOption::create([
            'code' => $code,
            'name' => $data['displayName'],
            'provider' => $data['provider'],
            'type' => 'MOBILE',
            'active' => (bool)($data['active'] ?? true),
            'fee_fixed' => 0,
            'fee_percent' => 0,
            'meta' => $meta,
        ]);
        return response()->json([
            'id' => $option->id,
            'provider' => $option->provider,
            'channel' => $meta['channel'],
            'displayName' => $option->name,
            'shortDescription' => $meta['shortDescription'],
            'instructionsMarkdown' => $meta['instructionsMarkdown'],
            'paybillNumber' => $meta['paybillNumber'],
            'tillNumber' => $meta['tillNumber'],
            'businessShortCode' => $meta['businessShortCode'],
            'recipientPhone' => $meta['recipientPhone'],
            'accountReferenceTemplate' => $meta['accountReferenceTemplate'],
            'supportsStk' => $meta['supportsStk'],
            'active' => $option->active,
            'sortOrder' => $meta['sortOrder'],
            'metadataJson' => $meta['metadataJson']
        ], 201);
    }

    public function update(Request $request, PaymentOption $paymentOption)
    {
        $data = $request->validate([
            'provider' => ['sometimes','string','in:MPESA,AIRTEL'],
            'channel' => ['sometimes','string','max:64'],
            'displayName' => ['sometimes','string','max:255'],
            'shortDescription' => ['sometimes','nullable','string','max:255'],
            'instructionsMarkdown' => ['sometimes','nullable','string'],
            'paybillNumber' => ['sometimes','nullable','string','max:32'],
            'tillNumber' => ['sometimes','nullable','string','max:32'],
            'businessShortCode' => ['sometimes','nullable','string','max:32'],
            'recipientPhone' => ['sometimes','nullable','string','max:32'],
            'accountReferenceTemplate' => ['sometimes','nullable','string','max:64'],
            'supportsStk' => ['sometimes','boolean'],
            'active' => ['sometimes','boolean'],
            'sortOrder' => ['sometimes','integer'],
            'metadataJson' => ['sometimes','nullable','string'],
        ]);
        $meta = $paymentOption->meta ?? [];
        // Alias support for description fields
        if (!array_key_exists('shortDescription',$data)) {
            $alias = $request->input('short_description') ?? $request->input('description');
            if ($alias !== null) { $data['shortDescription'] = $alias; }
        }
        foreach (['channel','shortDescription','instructionsMarkdown','paybillNumber','tillNumber','businessShortCode','recipientPhone','accountReferenceTemplate','metadataJson'] as $k) {
            if (array_key_exists($k, $data)) { $meta[$k] = $data[$k]; }
        }
        if (array_key_exists('supportsStk',$data)) { $meta['supportsStk'] = (bool)$data['supportsStk']; }
        if (array_key_exists('sortOrder',$data)) { $meta['sortOrder'] = (int)$data['sortOrder']; }
        $update = [];
        if (array_key_exists('provider',$data)) $update['provider'] = $data['provider'];
        if (array_key_exists('displayName',$data)) $update['name'] = $data['displayName'];
        if (array_key_exists('active',$data)) $update['active'] = (bool)$data['active'];
        $update['meta'] = $meta;
        $paymentOption->update($update);
        // respond in admin shape
        return response()->json([
            'id' => $paymentOption->id,
            'provider' => $paymentOption->provider,
            'channel' => $meta['channel'] ?? ($meta['channels'][0] ?? $paymentOption->code),
            'displayName' => $paymentOption->name,
            'shortDescription' => $meta['shortDescription'] ?? null,
            'instructionsMarkdown' => $meta['instructionsMarkdown'] ?? null,
            'paybillNumber' => $meta['paybillNumber'] ?? null,
            'tillNumber' => $meta['tillNumber'] ?? null,
            'businessShortCode' => $meta['businessShortCode'] ?? null,
            'recipientPhone' => $meta['recipientPhone'] ?? null,
            'accountReferenceTemplate' => $meta['accountReferenceTemplate'] ?? null,
            'supportsStk' => (bool)($meta['supportsStk'] ?? true),
            'active' => (bool)$paymentOption->active,
            'sortOrder' => (int)($meta['sortOrder'] ?? 0),
            'metadataJson' => $meta['metadataJson'] ?? ''
        ]);
    }

    public function activate(PaymentOption $paymentOption)
    {
        $paymentOption->update(['active'=>true]);
        return response()->json($paymentOption);
    }

    public function deactivate(PaymentOption $paymentOption)
    {
        $paymentOption->update(['active'=>false]);
        return response()->json($paymentOption);
    }

    public function destroy(PaymentOption $paymentOption)
    {
        $paymentOption->delete();
        return response()->json(['deleted' => true]);
    }
}
