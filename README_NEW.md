## Shop – Minimal Supermarket Front-end

A lightweight demo supermarket UI built with React + Vite. Focused on simplicity and local (Kenyan) context: staple products, KES currency formatting, and a very small feature set.

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

### Run Dev Server
```
npm install
npm run dev
```
Visit the printed local URL (default http://localhost:5173 ).

### Build & Preview
```
npm run build
npm run preview
```

### Structure
```
src/
  components/ (Navbar, Footer, ProductCard, ProgressSteps)
  pages/ (Home, Products, Cart, About, Checkout)
  context/ (CartContext, ToastContext, ThemeContext)
  services/ (orderService.js)
  data/ (products.js)
  utils/ (currency.js)
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

---
Feel free to adapt and extend. Karibu! 🇰🇪

### Environment Variables

Create a `.env` (or `.env.local`) with:

```
VITE_API_BASE_URL=http://localhost:8081/api
```

If your backend also serves uploaded images under a path like `/images`, the frontend will automatically turn any relative `imageUrl` (e.g. `/images/123.png`) from API responses into an absolute URL using the same origin as `VITE_API_BASE_URL`. This prevents 404s caused by the browser trying to load images from the Vite dev server origin instead of the backend.
