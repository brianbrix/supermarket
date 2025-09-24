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
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    let errText;
    try { errText = await res.text(); } catch { errText = res.statusText; }
    throw new Error(`API ${res.status}: ${errText}`);
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
  products: {
    list: (page=0,size=20) => request(`/products?page=${page}&size=${size}`),
    get: (id) => request(`/products/${id}`),
    byCategory: (cat) => request(`/products/category/${encodeURIComponent(cat)}`),
    search: ({ q, categoryId, minPrice, maxPrice, inStock, page=0, size=20 } = {}) => {
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
    orders: (page=0,size=20) => request(`/user/orders?page=${page}&size=${size}`)
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
      }
    },
    orders: {
      list: (page=0,size=20) => request(`/admin/orders?page=${page}&size=${size}`),
      updateStatus: (id, status) => request(`/admin/orders/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' })
    },
    products: {
      create: (payload) => request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      delete: (id) => request(`/admin/products/${id}`, { method: 'DELETE' })
    },
    payments: {
      list: (page=0,size=20) => request(`/admin/payments?page=${page}&size=${size}`)
    },
    categories: {
      paged: (page=0,size=20) => request(`/admin/categories?page=${page}&size=${size}`),
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
