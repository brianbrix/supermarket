# Migration Guide: Spring Boot -> Laravel

## Overview
This document maps existing Java/Spring Boot concepts to their Laravel counterparts for the supermarket application.

| Domain | Spring (Current) | Laravel Target |
|--------|------------------|----------------|
| Product | `Product` JPA Entity | `App\\Models\\Product` Eloquent |
| Order | `Order` JPA Entity | `App\\Models\\Order` |
| OrderItem | `OrderItem` JPA Entity | `App\\Models\\OrderItem` |
| Repositories | Spring Data Interfaces | Eloquent query scopes / repository classes (optional) |
| Services | `OrderService`, etc. | Service classes or thin logic inside controllers + dedicated service layer |
| Controllers | `AdminController`, `ProductController` | `OrderAdminController`, `ProductController`, `PaymentAdminController`, `CategoryController`, `AuthController` |
| DTOs | `OrderResponse`, etc. | API Resources (`ProductResource`, `OrderResource`, `OrderItemResource`) |
| Pagination | Spring `Page<T>` | Laravel LengthAwarePaginator |
| Sorting | Pageable Sort | orderBy + whitelist validation |
| Security | Spring Security + JWT | Laravel Sanctum / Laravel Passport / custom JWT |

## Steps
1. Scaffold Laravel project (real):
   ```bash
   composer create-project laravel/laravel backend-php
   ```
2. Copy models & migrations from this scaffold or merge.
3. Run migrations:
   ```bash
   php artisan migrate
   ```
4. Seed data (write seeders equivalent to current SQL/import logic).
5. Implement authentication (recommend Sanctum if SPA, or JWT if parity required).
6. Add API Resources for consistent response shaping (DONE in scaffold).
7. Implement validation requests (FormRequest classes) for endpoints (status update DONE).
8. Introduce tests (PHPUnit + Pest) replicating existing behavior.
9. Implement factories for richer seed data.

## Sorting & Filtering Parity
- Orders: allowed fields `created_at,total_gross,status,id`
- Products: allowed fields `name,price,stock,id,created_at`

## TODO (Future Enhancements)
- Payment callback/webhook handling & signature verification.
- Proper enum casting (Laravel custom casts or enum types) for order status.
- Observers to maintain aggregate totals.
- Error handling standardization (exception handler mapping).
 - Authentication & authorization parity (roles: ADMIN, USER)
 - File uploads for product images (current Java equivalent?)
 - Harden category/product mutation authorization (restrict to ADMIN)

## Pagination Envelope Mapping

Spring Page<T> fields -> Laravel response:

| Spring | Laravel Envelope Key | Notes |
|--------|----------------------|-------|
| content | content | Array of Resource items |
| number | page | Zero-based index (we subtract 1 from Laravel currentPage) |
| size | size | perPage() |
| totalElements | totalElements | total() |
| totalPages | totalPages | lastPage() |
| numberOfElements | numberOfElements | count(items) |
| first | first | currentPage()==1 |
| last | last | currentPage()==lastPage() |
| sort | sort | Currently null placeholder |

## Validation
- `UpdateOrderStatusRequest` ensures status is one of allowed values. Add additional FormRequests for product creation/update, filtering, etc.

## Seeders
- `ProductSeeder` creates sample products (expects factories; create them after installing Laravel).
- `OrderSeeder` generates orders and items, computing totals (simplistic VAT assumption 16%).
- Add `PaymentSeeder` if synthetic payment data desired.

## Authentication
Implemented endpoints (after Sanctum install & middleware wiring):
- POST `/api/auth/register` – create user & return token
- POST `/api/auth/login` – login with username or email
- GET `/api/auth/me` – current user (auth:sanctum)
- POST `/api/auth/logout` – revoke current token

Sanctum install steps:
```bash
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```
Then add to `app/Http/Kernel.php` API middleware group: `\Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class` if using SPA cookies, or use bearer tokens issued above.

## Payment API
Endpoints:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/payments` | Admin listing & filtering (status, method, channel, provider, from, to, q, sort, direction, size) |
| POST | `/api/payments` | Create or fetch base payment for order (idempotent) |
| POST | `/api/payments/mobile-money/initiate` | Initiate mobile money (STK or channel) payment |
| POST | `/api/payments/manual/initiate` | Create manual mobile money payment using configured PaymentOption |
| POST | `/api/payments/manual/reconcile` | Attempt manual reconciliation (simulate provider verification) |
| GET | `/api/payments/order/{orderId}` | Retrieve payment for specific order |
| POST | `/api/payments/mpesa/callback` | M-Pesa STK callback (webhook) |
| POST | `/api/payments/airtel/callback` | Airtel Money callback (webhook) |

Allowed sort: `created_at, amount, status, id`.

Stored Fields (Payment): `amount, currency, method, channel, provider, provider_ref, external_request_id, external_transaction_id, phone_number, raw_request_payload, raw_callback_payload`.

### STK Push Simulation Logic
During initiation for MPESA (channels: `MPESA_STK_PUSH`, or `MPESA_PAYBILL` / `MPESA_TILL` with `supports_stk=true`) a synthetic password & timestamp are generated and embedded in `raw_request_payload`. Airtel STK-like flows (`AIRTEL_STK_PUSH` or `AIRTEL_COLLECTION` + `supports_stk`) similarly set a prefixed `external_request_id`.

### Idempotency Rules
1. `createOrFetch`: returns existing payment for the order if any.
2. `initiateMobileMoney`: reuses existing INITIATED payment for same order + channel.
3. `initiateManual`: reuses existing INITIATED payment for same order + derived channel.
4. Callbacks ignore already terminal (SUCCESS / FAILED) payments.

### Callback Matching
M-Pesa: lookup by `checkoutRequestID` (external_request_id) then fallback to receipt number (`MpesaReceiptNumber`).

Airtel: lookup by `originalRequestId` then fallback to `transactionId`.

### Manual Reconciliation
Heuristic settlement: last 6 digits of phone match (if provided) AND amount matches (if provided) => mark SUCCESS and assign synthetic `MANUAL-{timestamp}` external_transaction_id if empty.

### Order Progression
When payment transitions to SUCCESS and order status is `PENDING`, it is advanced to `PROCESSING`.

### Future Hardening
* Signature / IP validation on callbacks.
* Polling for long INITIATED payments.
* Explicit `/api/payments/{id}/confirm` endpoint (optional) for direct admin confirmation.
* Provider credential management & secure secrets storage.

## Recommended Next Commands After Composer Setup
```bash
php artisan make:factory ProductFactory --model=Product
php artisan make:factory OrderFactory --model=Order
php artisan make:factory OrderItemFactory --model=OrderItem
php artisan migrate --seed
```

## Notes
This scaffold is intentionally minimal and not a full Laravel application until you run Composer and bring in vendor + bootstrap files.

## Roles & Authorization

Spring Security (original) likely distinguished between admin endpoints (e.g., `/admin/**`) and public catalog endpoints. In Laravel we replicate this using:

1. Sanctum for authenticating API users (Bearer tokens created at login/register).
2. A simple `role` string column on the `users` table (values: `ADMIN`, `USER`).
3. Custom middleware `EnsureRole` registered in `app/Http/Middleware/EnsureRole.php` and applied like: `Route::middleware(['auth:sanctum','role:ADMIN'])`.

### Seeding an Admin User
Seeder `AdminUserSeeder` creates a default admin account. After running migrations, execute:
```bash
php artisan db:seed --class=AdminUserSeeder
```
Credentials (change in seeder as needed):
```
email: admin@example.com
password: password
role: ADMIN
```

### Promoting a User Manually
```bash
php artisan tinker
>>> $u = \App\Models\User::where('email','user@example.com')->first();
>>> $u->role = 'ADMIN';
>>> $u->save();
```

### Testing Access (Expected Matrix)
| Context | /api/admin/orders | /api/products |
|---------|-------------------|---------------|
| Guest | 401 (unauthenticated) | 200 OK |
| Auth USER | 403 (forbidden) | 200 OK |
| Auth ADMIN | 200 OK | 200 OK |

### Recommended Hardening
- Move category mutation routes (POST/PUT/DELETE) into the admin middleware group.
- Introduce a PHP native enum `App\Enums\Role` to avoid string literals.
- Add helper method `isAdmin()` on the `User` model or a policy for finer control.
- Rate-limit sensitive auth endpoints (`login`, `register`) via `Route::middleware('throttle:login')`.
- Standardize error JSON shape: `{ "error": { "code": 403, "message": "Forbidden" } }`.

### Future: Policies / Gates
For granular authorization (per-resource checks), Laravel Policies can replace or complement the simple role middleware. Example:
```php
Gate::define('manage-orders', fn($user) => $user->role === 'ADMIN');
```

## Analytics & Dashboard

Frontend expects the following admin endpoints (now implemented):

| Endpoint | Purpose | Key Fields Returned |
|----------|---------|---------------------|
| GET `/api/admin/dashboard/stats` | High-level KPIs | `totalOrders,totalRevenue,averageOrderValue,pendingOrders,processingOrders,completedOrders,cancelledOrders,shippedOrders,totalProducts,totalAdmins,repeatCustomers,uniqueCustomers,repeatRate` |
| GET `/api/admin/dashboard/recent-orders?limit=5` | Recent order list | `id,customerName,status,totalGross,totalNet,vatAmount,itemsCount,createdAt` |
| GET `/api/admin/analytics/overview?revenueDays=30&lowStockThreshold=5` | Trends & extended analytics | `revenueTrendDaily,revenueTrendWeekly,revenueTrendMonthly,topSelling,lowStock,overallAov,dailyChangePct,...` |

### Average Order Value (AOV)
Calculated as: `totalRevenue / totalOrders` (using `total_gross`). Returns:
- `averageOrderValue` in `/dashboard/stats`
- `overallAov` in `/analytics/overview` (restricted to window range)

### Revenue Trends
- Daily: fixed-length array for the selected window (pads days with zero revenue).
- Weekly: grouped by week start (ISO Monday). `weeklyChangePct` compares current week-to-date against the previous full week.
- Monthly: grouped by calendar month. `monthlyChangePct` compares month-to-date vs the same day span in the previous month.
- Change percentages are independent; if prior period has zero revenue the pct is `null`.

### Top Selling & Low Stock
- `topSelling` ranks products by summed `order_items.quantity` within the window.
- `lowStock` lists products with `stock <= lowStockThreshold` (default 5).

### Future Enhancements
- Dedicated repeat customer rate & retention cohorts (requires customer identity persistence).
- Weighted AOV by channel & basket segmentation.
- Caching layer (Redis) for heavy traffic.
- Materialized reporting tables for very large datasets.

## Product Admin API
Endpoints (all require `ADMIN`):
- GET `/api/admin/products` (pagination + sort `id,name,price,stock,created_at` + `q` search)
- POST `/api/admin/products` (create)
- PUT `/api/admin/products/{id}` (partial update)
- DELETE `/api/admin/products/{id}` (soft deletion not implemented – hard delete)

Request body fields: `name (required)`, `description?`, `price (>=0)`, `stock (>=0)`, `unit?`, `category_id?`, `image_url?`.

## Payment Option Management
Purpose: Manage configurable payment rails (e.g., M-Pesa, Airtel, Card) separate from individual payment records.

Schema (`payment_options`): `code (unique)`, `name`, `provider?`, `type (MOBILE|CARD|BANK|OTHER)`, `active`, `fee_fixed`, `fee_percent`, `meta (JSON)`.

Endpoints:
- GET `/api/admin/payment-options` (`?active=true|false` filter)
- POST `/api/admin/payment-options`
- PUT `/api/admin/payment-options/{id}`
- POST `/api/admin/payment-options/{id}/activate`
- POST `/api/admin/payment-options/{id}/deactivate`

Seeder: `PaymentOptionSeeder` seeds MPESA, AIRTEL, CARD (inactive) defaults.

## Repeat Customer Metrics
Derived in analytics overview using `user_id` when present else phone fallback, counting identifiers with >1 orders across the analysis window (and its preceding window) to compute `repeatRate`.


