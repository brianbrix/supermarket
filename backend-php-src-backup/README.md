# Laravel Backend (Migration Draft)

This directory contains an initial Laravel-style structure (without vendor) to migrate the existing Spring Boot backend to PHP/Laravel.

## Status
Scaffold only (no full framework here). For a real app you must run `laravel new` or `composer create-project laravel/laravel backend-php` outside then move/merge code, or run inside this folder once composer is available.

## Next Steps (Expanded)
1. Install Laravel via Composer:
	```bash
	cd backend-php
	composer create-project laravel/laravel .
	composer install
	cp .env.example .env
	php artisan key:generate
	```
2. Configure `.env` database credentials.
3. Run migrations & (later) seeders:
	```bash
	php artisan migrate
	php artisan db:seed --class=ProductSeeder
	php artisan db:seed --class=OrderSeeder
	```
4. Create model factories (after install):
	```bash
	php artisan make:factory ProductFactory --model=Product
	php artisan make:factory OrderFactory --model=Order
	php artisan make:factory OrderItemFactory --model=OrderItem
	```
5. Implement authentication (Laravel Sanctum recommended for SPA). 
6. Add remaining endpoints (payments, user profile, etc.).
7. Add API Resources already included: `ProductResource`, `OrderResource`, `OrderItemResource`.
8. Align pagination envelope with existing frontend (already implemented in controllers).

## Pagination Envelope
Matches existing Spring Boot format:
```
{
  "content": [...],
  "page": 0,
  "size": 20,
  "totalPages": 5,
  "totalElements": 94,
  "numberOfElements": 20,
  "first": true,
  "last": false,
  "sort": null
}
```

## Resources Implemented
- `ProductResource` (includes images & category name)
- `OrderResource` (includes items)
- `OrderItemResource`

## Validation
- `UpdateOrderStatusRequest` enforces allowed statuses. Extend similarly for products & categories.

## Docs
See `docs/MIGRATION.md` for detailed mapping & roadmap.
