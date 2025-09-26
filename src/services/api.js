// Centralized API client for backend integration
// NOTE: The backend serves static images at the root path (e.g. http://localhost:8081/images/filename.jpg)
// while API endpoints are under /api. When the backend returns an imageUrl like /images/xyz.png, the
// frontend (running on a different dev origin, e.g. http://localhost:5173) would otherwise request
// http://localhost:5173/images/xyz.png and 404. We therefore derive the API origin (scheme+host[:port])
// and prefix any leading-slash image paths before rendering.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';
// Derive origin by stripping a trailing /api (with optional slash) if present
const API_ORIGIN = BASE_URL.replace(/\/$/, '').replace(/\/api$/, '');

function toAbsoluteAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  if (path.startsWith('/')) return API_ORIGIN + path; // backend-root relative (e.g. /images/..)
  return API_ORIGIN + '/' + path; // fallback – relative without leading slash
}

let authTokenGetter = () => null;
export function configureAuthTokenGetter(fn){ authTokenGetter = fn; }

async function request(path, options = {}) {
  const token = authTokenGetter();
  const headers = {
    'Accept': 'application/json',
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    let raw = '';
    try { raw = await res.text(); } catch { raw = res.statusText; }
    // Attempt JSON parse even on error
    let parsed;
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    const message = parsed?.message || parsed?.error || raw || res.statusText;
    const error = new Error(message);
    error.status = res.status;
    error.payload = parsed || raw;
    throw error;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  auth: {
    login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    me: () => request('/user/me'),
    changePassword: (payload) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),
    requestPasswordReset: (email) => request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
    confirmPasswordReset: (payload) => request('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(payload) })
  },
  payments: {
    initiateMobileMoney: (payload) => request('/payments/mobile-money/initiate', { method: 'POST', body: JSON.stringify(payload) }),
    initiateManual: (payload) => request('/payments/manual/initiate', { method: 'POST', body: JSON.stringify(payload) }),
    reconcileManual: (payload) => request('/payments/manual/reconcile', { method: 'POST', body: JSON.stringify(payload) }),
    byOrder: (orderId) => request(`/payments/order/${orderId}`),
    options: () => request('/payments/options')
  },
  products: {
    list: (page=0,size=10) => request(`/products?page=${page}&size=${size}`),
    get: (id) => request(`/products/${id}`),
    priceRange: (categoryId) => {
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
      return request(`/products/price-range${qs}`);
    },
    byCategory: (cat) => request(`/products/category/${encodeURIComponent(cat)}`),
    search: ({ q, categoryId, minPrice, maxPrice, inStock, page=0, size=10 } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (categoryId) params.set('categoryId', categoryId);
      if (minPrice != null) params.set('minPrice', minPrice);
      if (maxPrice != null) params.set('maxPrice', maxPrice);
      if (inStock != null) params.set('inStock', inStock);
      params.set('page', page);
      params.set('size', size);
      const qs = params.toString();
      return request(`/products/search${qs ? `?${qs}` : ''}`);
    },
    uploadImage: (id, file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request(`/products/${id}/image`, { method: 'POST', body: fd });
    },
    uploadImages: (id, files) => {
      const fd = new FormData();
      [...files].forEach(f => fd.append('files', f));
      return request(`/products/${id}/images`, { method: 'POST', body: fd });
    },
    deleteImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}`, { method: 'DELETE' })
  },
  categories: {
    list: () => request('/categories')
  },
  orders: {
    create: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
    list: () => request('/orders'),
    get: (id) => request(`/orders/${id}`)
  },
  user: {
    orders: (page=0,size=10) => request(`/user/orders?page=${page}&size=${size}`)
  },
  admin: {
    stats: () => request('/admin/dashboard/stats'),
    recentOrders: (limit=10) => request(`/admin/dashboard/recent-orders?limit=${limit}`),
    analytics: {
      overview: ({ lowStockThreshold = 5, revenueDays = 30 } = {}) => {
        const params = new URLSearchParams();
        if (lowStockThreshold != null) params.set('lowStockThreshold', lowStockThreshold);
        if (revenueDays != null) params.set('revenueDays', revenueDays);
        return request(`/admin/analytics/overview?${params.toString()}`);
      },
      aov: ({ granularity = 'DAILY', periods } = {}) => {
        const params = new URLSearchParams();
        if (granularity) params.set('granularity', granularity);
        if (periods != null) params.set('periods', periods);
        const qs = params.toString();
        return request(`/admin/analytics/aov${qs ? `?${qs}` : ''}`);
      },
      unified: ({ from, to, granularity='DAILY', statuses=[], includeRefunded=false, includeCancelled=false } = {}) => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (granularity) params.set('granularity', granularity);
        statuses.forEach(s => params.append('statuses', s));
        if (includeRefunded) params.set('includeRefunded','true');
        if (includeCancelled) params.set('includeCancelled','true');
        const qs = params.toString();
        return request(`/admin/analytics/unified${qs?`?${qs}`:''}`);
      },
      advanced: ({ from, to } = {}) => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        return request(`/admin/analytics/advanced${qs?`?${qs}`:''}`);
      }
    },
    orders: {
      list: (page=0,size=10, filters={}) => {
        const params = new URLSearchParams();
        params.set('page', page); params.set('size', size);
        const { q, status, from, to, minTotal, maxTotal, sort='createdAt', direction='desc' } = filters;
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        if (from) params.set('from', from); // ISO string expected
        if (to) params.set('to', to);
        if (minTotal != null) params.set('minTotal', minTotal);
        if (maxTotal != null) params.set('maxTotal', maxTotal);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/orders?${params.toString()}`);
      },
      updateStatus: (id, status) => request(`/admin/orders/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' })
    },
    products: {
      create: (payload) => request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      delete: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
      list: (page=0,size=10, filters={}) => {
        const params = new URLSearchParams();
        params.set('page', page); params.set('size', size);
        const { q, categoryId, minPrice, maxPrice, inStock, sort='name', direction='asc' } = filters;
        if (q) params.set('q', q);
        if (categoryId) params.set('categoryId', categoryId);
        if (minPrice != null) params.set('minPrice', minPrice);
        if (maxPrice != null) params.set('maxPrice', maxPrice);
        if (inStock != null) params.set('inStock', inStock);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/products?${params.toString()}`);
      }
    },
    payments: {
      list: (page=0,size=10, filters={}) => {
        const params = new URLSearchParams();
        params.set('page', page); params.set('size', size);
        const { q, status, method, from, to, minAmount, maxAmount, sort, direction } = filters;
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        if (method) params.set('method', method);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (minAmount != null) params.set('minAmount', minAmount);
        if (maxAmount != null) params.set('maxAmount', maxAmount);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/payments?${params.toString()}`);
      },
      options: {
        list: (page=0,size=20) => {
          // Support pagination if backend implements it; fallback gracefully if not.
          const params = new URLSearchParams();
          params.set('page', page); params.set('size', size);
          return request(`/admin/payment-options?${params.toString()}`);
        },
        create: (payload) => request('/admin/payment-options', { method:'POST', body: JSON.stringify(payload)}),
        update: (id,payload) => request(`/admin/payment-options/${id}`, { method:'PUT', body: JSON.stringify(payload)}),
        delete: (id) => request(`/admin/payment-options/${id}`, { method:'DELETE' })
      }
    },
    categories: {
      paged: (page=0,size=10) => request(`/admin/categories?page=${page}&size=${size}`),
      // Flexible signature:
      //   search(qString, page?, size?, sort?, direction?)
      //   search({ q, page, size, sort, direction })
      // This prevents mistakes like passing an object as the first param and
      // getting q=[object Object] in the URL.
      search: (arg, page=0, size=10, sort='name', direction='asc') => {
        let q; let p = page; let s = size; let so = sort; let dir = direction;
        if (typeof arg === 'object' && arg !== null && !(arg instanceof Date)) {
          // Options object form
            q = arg.q;
            p = arg.page ?? page;
            s = arg.size ?? size;
            so = arg.sort ?? sort;
            dir = arg.direction ?? direction;
        } else {
          q = arg; // primitive q (string/undefined)
        }
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        params.set('page', p); params.set('size', s);
        if (so) params.set('sort', so);
        if (dir) params.set('direction', dir);
        return request(`/admin/categories/search?${params.toString()}`);
      },
      create: (payload) => request('/admin/categories', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      delete: (id) => request(`/admin/categories/${id}`, { method: 'DELETE' })
    }
  }
};

export function mapProductResponse(p) {
  // Prefer structured images (with id/url/position), fallback to legacy list of URLs.
  let imageMeta = Array.isArray(p.images) ? p.images : [];
  if (imageMeta.length === 0) {
    const legacyUrls = Array.isArray(p.imageUrls) ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
    imageMeta = legacyUrls.map((u, idx) => ({ id: null, url: u, position: idx }));
  }
  // Sort by position just in case
  imageMeta = [...imageMeta].sort((a,b)=>(a.position??0)-(b.position??0));
  const images = imageMeta.map(im => toAbsoluteAssetUrl(im.url));
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    unit: p.unit || '',
    category: p.categoryName || 'Other',
    image: images[0] || '',
    images, // array of absolute URLs for existing components
    imageObjects: imageMeta.map(im => ({ ...im, absoluteUrl: toAbsoluteAssetUrl(im.url) })), // expose metadata + absolute
    description: p.description || '',
    stock: p.stock != null ? p.stock : undefined,
    categoryId: p.categoryId
  };
}

import mpesaLogo from '../assets/mpesa.svg';
import airtelLogo from '../assets/airtel.svg';

export const paymentBranding = {
  MPESA: { color: '#1A7F37', bg: '#e6f5ec', logoText: 'M-Pesa', logo: mpesaLogo, ring: '#32b768' },
  AIRTEL: { color: '#e60000', bg: '#fdeaea', logoText: 'Airtel', logo: airtelLogo, ring: '#ff4d4d' }
};
