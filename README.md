# KenSuper Monorepo (React + Laravel)

Modern Kenyan supermarket experience powered by a Vite/React SPA (`/src`) and a Laravel 10 API (`/backend-php`). This repository now ships with performance-focused front-end tweaks, cached recommendation queries, and a production-ready Docker Compose stack (frontend, backend, PostgreSQL, Redis).

## 🚀 Key improvements in this update
- **Route-based code splitting** – all major pages (admin, account, product detail, checkout) load on demand via `React.lazy`, shrinking the initial bundle served to shoppers.
- **Fine-grained vendor chunking** – Vite build outputs separate vendor bundles per package, keeping revalidation efficient and letting HTTP/2 multiplex parallel downloads.
- **On-demand PDF generation** – `pdfmake` loads only when a shopper exports a receipt, trimming the critical path payload by ~2 MB.
- **Cached price bounds & related products** – Laravel now remembers expensive queries (category price ranges and related-product scoring) with Redis-backed caches to ease database load.
- **Containerized stack** – Docker Compose spins up the web app, API, PostgreSQL 15, and Redis 7 with a single command.

## 📁 Repository structure (partial)
```
.
├── docker-compose.yml
├── docker/
│   ├── frontend/
│   │   ├── Dockerfile      # Multi-stage Vite → Nginx build
│   │   └── nginx.conf
│   └── backend/
│       └── Dockerfile      # Laravel worker using php:8.2-cli
├── src/                    # React storefront + admin UI
└── backend-php/            # Laravel API + Sanctum auth + PostgreSQL persistence
```

## 🛠 Prerequisites (manual setup)
- Node.js 20.19+ or 22.x (`nvm install 22 && nvm use 22` recommended)
- PHP 8.2 with Composer 2
- PostgreSQL 15+
- Redis 7 (optional locally, required for cache parity with Docker stack)

## 🧪 Manual development workflow
### Frontend
```bash
cd supermarket
npm install
npm run dev
```
Default dev server: <http://localhost:5173>. Configure the API origin via `.env`:
```
VITE_API_BASE_URL=http://localhost:8081/api
VITE_BRAND_NAME=KenSuper
```

### Backend (Laravel)
```bash
cd supermarket/backend-php
composer install
php artisan migrate --seed
php artisan serve --host=0.0.0.0 --port=8081
```
Copy `.env.example` to `.env` (or reuse `.env.docker`) and update database credentials. Redis improves cache hit rate but file cache works for local prototyping.

Common optimization-friendly commands:
- `php artisan optimize` – cache config/routes/views after adjusting `.env`
- `php artisan test` – PHPUnit suite (requires configured database)

## 🐳 Docker Compose quickstart
1. Ensure Docker Desktop (or equivalent) is running.
2. (Optional) Update `backend-php/.env.docker` with custom secrets/database values. A safe default `APP_KEY` is already present; override via environment if desired.
3. (Optional) Launch the shared Traefik gateway as a standalone stack:
   ```bash
   cd supermarket/docker/traefik
   docker compose up -d
   ```
   > **Note:** The helper script described below automatically runs this compose file for you. Use this manual step only if you want to manage Traefik separately.
4. Build and launch the full stack with Docker Compose (frontend, backend, Postgres, Redis, Traefik helper):
   ```bash
   cd supermarket
   docker compose up --build
   ```
   Or use the helper script (handles the external Traefik network and optional build):
   ```bash
   ./scripts/start-services.sh            # build + start (includes Traefik companion)
   ./scripts/start-services.sh --no-build
   ./scripts/start-services.sh --no-traefik
   ```
   > The helper script ensures the `${TRAEFIK_NETWORK}` external network exists before launching the Traefik stack.
   - Frontend SPA (+ proxied API): <http://localhost:8080>
   - Backend API direct port: <http://localhost:8081/api>
   - PostgreSQL: localhost:5433 (user/password: `supermarket`)
   - Redis: localhost:6379
   - Traefik dashboard (basic auth protected): <http://localhost/traefik>
5. Apply database migrations inside the backend container (first run only):
   ```bash
   docker compose exec backend php artisan migrate --force
   ```

### Compose environment knobs
- `VITE_API_BASE_URL` build arg overrides the API origin baked into the SPA. Runtime defaults detect port `8080` and automatically target `http://<host>:8081/api`, so you can usually leave this unset unless pointing at an external API host.
   - With the built-in reverse proxy, leaving this unset makes the SPA call `<origin>/api`, which nginx forwards to the backend container.
- `VITE_BASE_PATH` adjusts the public path when serving the SPA behind a reverse proxy prefix (e.g. `/shop/`).
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` bubble through to both services to keep credentials consistent.
- `TRAEFIK_NETWORK` identifies the external network shared with your Traefik reverse proxy (defaults to `traefik_proxy`).
- `TRAEFIK_ACME_VOLUME` customizes the persistent volume name used by the Traefik companion stack for certificate storage.
- Set `APP_KEY` in your shell before `docker compose up` to rotate the Laravel encryption key without editing tracked files.

### Traefik dashboard access (optional helper)
- Default credential: `admin` / `change-me`
- Update the hash in `docker/traefik/dashboard-users.htpasswd` using `htpasswd` or `openssl passwd -apr1 <new-password>` and redeploy.
- When you’re ready to front the stack with real domains, add Traefik routers (or another reverse proxy) that map your hostnames to ports 8080 (frontend) and 8081 (API).

### Quick smoke test checklist
1. Visit <http://localhost:8080> – the storefront should load (200 status, no mixed content warnings).
2. Add a product to the cart and continue to checkout to confirm API calls reach <http://localhost:8080/api> (nginx proxies to the backend).
3. (Optional) Navigate to <http://localhost/traefik>, authenticate with the default credential, and confirm any custom routers you configure for domain mappings.
4. (Optional) When you map real domains, update Traefik (or your proxy) to route the hostnames to ports 8080 and 8081 respectively, then re-run the smoke test.

## ✅ Verification checklist
- `npm run build` (front-end) – confirms route-based chunking and pdfmake code splitting
- `php artisan config:cache` (backend) – validates compiled configuration after env changes
- `docker compose up --build` – container images build cleanly and services start

## 📓 Release notes
- Lazily load pdfmake in `Checkout.jsx` via dynamic `import()` (see `getPdfMake()` helper) to defer the 2 MB dependency until a receipt is exported.
- Big query caching landed in `backend-php/app/Http/Controllers/API/ProductController.php` using `Cache::remember()` with Redis keys tied to product update timestamps.
- Vite config now emits smaller vendor bundles (`vendor-react`, `vendor-router`, etc.) using a per-package `manualChunks` splitter.
- Added Dockerfiles for both tiers plus a top-level `.dockerignore` to trim build contexts.

## ⚠️ Known gaps / next steps
- Automated backend tests are currently skipped in CI; enable once Pest/PHPUnit fixtures are restored for PostgreSQL.
- `pdfmake` still produces a ~2 MB async chunk; consider replacing with a lighter generator if mobile download size remains a concern.
- The Laravel image runs `php artisan serve` for simplicity. Swap to `php-fpm` + Nginx for hardened production deployments.

Feel free to extend, localize, and build on top of these optimizations. Karibu! 🇰🇪
