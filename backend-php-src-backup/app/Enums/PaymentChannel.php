<?php

namespace App\Enums;

enum PaymentChannel: string
{
    case MPESA_STK_PUSH = 'MPESA_STK_PUSH';
    case MPESA_PAYBILL = 'MPESA_PAYBILL';
    case MPESA_TILL = 'MPESA_TILL';
    case MPESA_P2P = 'MPESA_P2P';
    case MPESA_POCHI = 'MPESA_POCHI';
    case AIRTEL_STK_PUSH = 'AIRTEL_STK_PUSH';
    case AIRTEL_COLLECTION = 'AIRTEL_COLLECTION';
}
