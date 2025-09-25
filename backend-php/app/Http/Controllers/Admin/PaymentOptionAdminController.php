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
        return response()->json($query->orderBy('code')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => ['required','string','max:50','unique:payment_options,code'],
            'name' => ['required','string','max:255'],
            'provider' => ['nullable','string','max:255'],
            'type' => ['required','in:MOBILE,CARD,BANK,OTHER'],
            'active' => ['boolean'],
            'fee_fixed' => ['numeric','min:0'],
            'fee_percent' => ['numeric','min:0'],
            'meta' => ['array'],
        ]);
        $option = PaymentOption::create($data);
        return response()->json($option, 201);
    }

    public function update(Request $request, PaymentOption $paymentOption)
    {
        $data = $request->validate([
            'name' => ['sometimes','string','max:255'],
            'provider' => ['sometimes','nullable','string','max:255'],
            'type' => ['sometimes','in:MOBILE,CARD,BANK,OTHER'],
            'active' => ['sometimes','boolean'],
            'fee_fixed' => ['sometimes','numeric','min:0'],
            'fee_percent' => ['sometimes','numeric','min:0'],
            'meta' => ['sometimes','array'],
        ]);
        $paymentOption->update($data);
        return response()->json($paymentOption);
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
}
