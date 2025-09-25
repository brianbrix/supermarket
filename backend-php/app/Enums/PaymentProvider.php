<?php

namespace App\Enums;

enum PaymentProvider: string
{
    case MPESA = 'MPESA';
    case AIRTEL = 'AIRTEL';
}
