<?php

namespace App\Enums;

enum Role: string
{
    case ADMIN = 'ADMIN';
    case USER = 'USER';

    public static function fromMixed(string $value): self
    {
        $upper = strtoupper($value);
        return match ($upper) {
            'ADMIN' => self::ADMIN,
            default => self::USER,
        };
    }
}
