## KenSuper Monorepo – Front-end & Spring Boot Backend

This repository now contains BOTH the React front-end and the Spring Boot backend (API + admin utilities) in a single mono-repo structure:

```
supermarket/
  backend/   # Spring Boot (Maven, Java 21, Spring Boot 3.5.x)
  src/       # React front-end source
```

The original lightweight UI (React + Vite) has been integrated with a real backend providing products, categories, orders, admin analytics and media uploads. Focus remains on a Kenyan retail context (KES currency, local product examples).

### Features
- Product listing (static sample data: unga, sukuma wiki, maziwa, mandazi)
- Search by name/description + category + price range filter
- Add to cart, adjust quantity, remove, clear (with toast notifications)
- Multi-step checkout: details → simulated M-Pesa/Airtel payment → confirmation
- Kenyan phone number validation & inline form errors
- Optional query param `?returnTo=checkout` (add item then auto-navigate to checkout)
- Cart summary with KES formatting
- Simple routing: Home / Products / Cart / About / Checkout
  - State persisted to localStorage (cart + theme)
  - Checkout progress persisted in sessionStorage (resume if you refresh)
  - Visual step indicator for checkout progress
  - Per-field (on-blur) validation feedback
  - Order confirmation: download text + PDF export + mock email trigger
  - Dark mode toggle (respects system preference + persisted)
  - Service abstraction layer (`orderService.js`) for payment + email mocks (future API hook)

### Tech
- React 19
- Vite 7
- React Router DOM 6
- jsPDF (PDF export)
- Context API (Cart / Toast / Theme)

### Architecture & Services
`orderService.js` encapsulates order-related async operations (currently mocked):
- `generateOrderRef()` – deterministic per-session order reference
- `initiatePayment({ method, amount })` – simulates mobile money payment (returns `paymentRef`)
- `sendEmailMock(order)` – placeholder for future email integration

Themes handled via `ThemeContext`:
- Persists selection to `localStorage`
- Applies `data-theme` attribute on `<html>` for CSS variable switching
- Defaults to system `prefers-color-scheme` on first load

### Prerequisites
Node.js 20.19+ or 22.12+ (Vite 7 & some deps require modern Node). If you see engine warnings or startup errors on Node 16/18, upgrade using nvm:
```
nvm install 22
nvm use 22
```

### Run Front-end Dev Server
```
npm install
npm run dev
```
Visit the printed local URL (default http://localhost:5173 ).

### Build & Preview (Front-end)
```
npm run build
npm run preview
```

### Repository Structure
```
backend/
  pom.xml
  src/main/java/... (controllers, services, repositories, dto, domain)
  src/main/resources/
  uploads/ (runtime image storage)
src/
  components/
  pages/
  context/
  services/
  data/
  utils/
```

### Future Ideas
- Real backend / API integration (replace service mocks)
- Authentication & real payment integration
- Real product images
- Inventory & stock levels
- Order history & user accounts
- Comprehensive unit & accessibility tests
- PWA offline cart support

### Notes
Cart data is client-side only (localStorage). Replace sample data with live API when ready.

## Backend (Spring Boot) Overview

Java 21 + Spring Boot 3.5.x. Main app class: `backend/src/main/java/com/example/supermarket/SupermarketBackendApplication.java`.

### Run Backend
From repo root:
```
cd backend
mvn spring-boot:run
```
Profiles: set `-Dspring.profiles.active=dev` as needed. Ensure PostgreSQL connection props are configured (env vars or `application.properties`).

### Build Backend Jar
```
cd backend
mvn clean package -DskipTests
java -jar target/supermarket-backend-0.0.1-SNAPSHOT.jar
```

### Environment Variable for Front-end
Create `.env` in repo root:
```
VITE_API_BASE_URL=http://localhost:8080/api
```

The frontend now integrates with a Spring Boot backend providing real products, categories, orders and admin utilities.

### Product Search Endpoint
`GET /api/products/search`

Query params (all optional):
- `q` – free text (name/description partial, case-insensitive)
- `categoryId` – numeric category id
- `minPrice`, `maxPrice` – inclusive bounds
- `inStock` – set to `true` to restrict to products with stock > 0

Example:
```
/api/products/search?q=milk&minPrice=100&maxPrice=500&inStock=true
```

### Stock Handling
- Each product has an integer `stock`.
- Orders atomically decrement stock; insufficient stock rejects the order.
- UI shows badges (Out / N left) and disables add-to-cart at zero.
- Cart quantities clamp to available stock and warn via toast if exceeded.

### Admin (Demo, Unsecured)
Routes under `/api/admin` allow product CRUD, order listing & status updates, category CRUD, and dashboard stats. In production these must be secured (JWT/session, role checks) and possibly separated into public vs admin category endpoints.

### Image Upload
`POST /api/products/{id}/image` multipart field `file` – updates product `imageUrl` served from `/images/*`.

### Categories
Fetched from `GET /api/admin/categories` (public for demo). Each item: `{ id, name }`.

### New Frontend Admin Screens
- `/admin/products` – search, create/edit (with stock & optional image), delete.
- `/admin/orders` – list orders and update status via dropdown.

### Debounced Filtering UI
The home page now uses debounced queries for text (500ms) and range/stock/category filters, calling the backend search endpoint instead of filtering client-side.

---
> NOTE: Ensure environment variable `VITE_API_BASE_URL` points to the backend origin (e.g. `http://localhost:8080/api`).

### Monorepo Notes
- Backend build artifacts (`backend/target`) & runtime uploads are gitignored.
- No git submodules remain; everything lives in this single repo.
- To upgrade dependencies, treat each side independently (npm / Maven).

---
Feel free to adapt and extend. Karibu! 🇰🇪

## Payments & Mobile Money Configuration

The backend now models payments with a flexible `Payment` entity plus configurable `PaymentOption` records an admin can manage. These options drive the checkout experience for mobile money automation.

### Core Concepts
- STK Push is treated as a capability (flag) layered on top of base channels rather than a distinct channel to configure.
- Supported providers: `MPESA`, `AIRTEL`.
- Supported configurable channels (after recent simplification):
  - `MPESA_PAYBILL`
  - `MPESA_TILL`
  - `MPESA_P2P` (manual peer transfer – user sends to a phone number; no automated push)
  - `MPESA_POCHI`
  - `AIRTEL_COLLECTION`
- Legacy shortcut channels (`MPESA_STK_PUSH`, `AIRTEL_STK_PUSH`) are still present in the enum for backward compatibility but should NOT be added as new options; prefer a base channel with `supportsStk = true`.
- Removed: manual "send money" convenience channels (`MPESA_SEND_MONEY`, `AIRTEL_SEND_MONEY`). These flows are now considered part of the broader Cash On Delivery (COD) operational process instead of a separate configurable payment option.

### STK Capability (`supportsStk`)
Set `supportsStk=true` on a base channel when you want the backend to initiate an automated push (e.g. M-Pesa STK) instead of requiring the customer to key in a PayBill/Till manually. Applicable channels:
`MPESA_PAYBILL`, `MPESA_TILL`, `AIRTEL_COLLECTION` (and legacy `*_STK_PUSH` if still in existing data).

### Required Fields by Channel
| Channel | Required Fields | Notes |
|---------|-----------------|-------|
| MPESA_PAYBILL | paybillNumber, (auto accountReferenceTemplate defaults to `ORDER-{orderId}` if blank) | May set `supportsStk=true` for automatic push |
| MPESA_TILL | tillNumber, (auto accountReferenceTemplate defaults if provided blank) | May set `supportsStk=true` |
| MPESA_P2P | recipientPhone | Manual send instructions only (no STK) |
| MPESA_POCHI | recipientPhone | Manual send |
| AIRTEL_COLLECTION | (none mandatory) | May set `supportsStk=true` |

Fields on a `PaymentOption`:
- `displayName` – UI label (e.g. "M-Pesa PayBill (Auto)").
- `shortDescription` – concise badge/summary text.
- `instructionsMarkdown` – multi-step guidance; supports Markdown (lists, bold, etc.). Provide manual steps when `supportsStk=false`.
- `paybillNumber` / `tillNumber` / `recipientPhone` – channel specific identifiers.
- `accountReferenceTemplate` – tokens: `{orderId}`, `{userId}`, `{total}`; resolved at initiation for structured statements.
- `supportsStk` – enable automated STK push on eligible channels.
- `sortOrder` – integer for display sorting.
- `active` – whether exposed to checkout consumers.
- `metadataJson` – arbitrary JSON string for future extensions (branding hints, regional tags, etc.).

### Admin Management
`/admin/payment-options` UI lets an authorized admin create/update/delete options. The channel selector excludes removed send money types and legacy `*_STK_PUSH` shortcuts.

### Checkout Behavior
- Frontend fetches active options and renders them with provider branding.
- If `supportsStk=true`, initiation hits the automated push path (backend sets external request id & waits for callback / simulated flow).
- If `supportsStk=false`, the instructions are shown and the payment record remains `INITIATED` until reconciled by callback/manual process.

### Migration Notes
If you had data rows using `MPESA_SEND_MONEY` or `AIRTEL_SEND_MONEY`, they should be retired. Keep historical Payments intact (enum constants removed from code; existing DB rows may need data migration to COD notes or archived). Consider running a DB update to map those historic rows to `method=CASH_ON_DELIVERY` with an audit note if necessary.

## Documentation Change Log
- 2025-09-25: Removed configurable send money channels; clarified STK capability and updated required field matrix.

## Continuous Integration (CI)
A lightweight GitHub Actions workflow (`.github/workflows/ci.yml`) builds both backend and frontend on pushes and pull requests to `dev` and `main`:
- Backend job: JDK 21, Maven dependency cache, `mvn -DskipTests clean package` then `mvn test`.
- Frontend job: Node 20 with npm cache, `npm ci` then `npm run build`.
- Artifacts uploaded:
  - `backend-jar` – Spring Boot re-packaged JAR
  - `frontend-dist` – Production-ready Vite build output

Extend ideas:
- Add lint step (`npm run lint`, `mvn -q verify` with extra plugins)
- Add Docker image build & push (use `actions/setup-buildx-action` + `docker/build-push-action`)
- Add test matrix (multiple Java or Node versions) if compatibility becomes a concern
- Integrate security scanning (Dependabot alerts, `mvn -DskipTests org.owasp:dependency-check:check`, `npm audit --audit-level=high`)
