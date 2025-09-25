<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case INITIATED = 'INITIATED';
    case PENDING = 'PENDING'; // legacy / placeholder
    case SUCCESS = 'SUCCESS';
    case FAILED = 'FAILED';
    case REFUNDED = 'REFUNDED';
}
