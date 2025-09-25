<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PaymentOption;

class PaymentOptionSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            ['code'=>'MPESA','name'=>'M-Pesa','provider'=>'Safaricom','type'=>'MOBILE','active'=>true,'fee_fixed'=>0,'fee_percent'=>0,'meta'=>['channels'=>['stk','qr']]],
            ['code'=>'AIRTEL','name'=>'Airtel Money','provider'=>'Airtel','type'=>'MOBILE','active'=>true,'fee_fixed'=>0,'fee_percent'=>0,'meta'=>['channels'=>['push']]],
            ['code'=>'CARD','name'=>'Card Payment','provider'=>'Generic','type'=>'CARD','active'=>false,'fee_fixed'=>5,'fee_percent'=>2.5,'meta'=>['gateway'=>'stripe']],
        ];
        foreach ($defaults as $row) {
            PaymentOption::updateOrCreate(['code'=>$row['code']], $row);
        }
    }
}
