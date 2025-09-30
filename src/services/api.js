// Centralized API client for backend integration
// NOTE: The backend serves static images at the root path (e.g. http://localhost:8081/images/filename.jpg)
// while API endpoints are under /api. When the backend returns an imageUrl like /images/xyz.png, the
// frontend (running on a different dev origin, e.g. http://localhost:5173) would otherwise request
// http://localhost:5173/images/xyz.png and 404. We therefore derive the API origin (scheme+host[:port])
// and prefix any leading-slash image paths before rendering.
const runtimeDefaultBase = (() => {
  if (import.meta.env?.DEV) {
    return 'http://localhost:8081/api';
  }
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const { protocol, hostname, port } = url;
    if (port === '8080') {
      return `${url.origin}/api`;
    }
    if (!port || port === '80' || port === '443') {
      return `${url.origin}/api`;
    }
    return `${protocol}//${hostname}:${port}/api`;
  }
  return '/api';
})();

const configuredBase = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === '""' || trimmed === "''") return '';
  return trimmed.replace(/^['"]|['"]$/g, '');
})();

const BASE_URL = configuredBase || runtimeDefaultBase;
// Derive origin by stripping a trailing /api (with optional slash) if present
const API_ORIGIN = BASE_URL.replace(/\/$/, '').replace(/\/api$/, '');

const NBSP = '\u00A0';

const slugify = (value) => {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

function toAbsoluteAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  if (path.startsWith('/')) return API_ORIGIN + path; // backend-root relative (e.g. /images/..)
  return API_ORIGIN + '/' + path; // fallback – relative without leading slash
}

function flattenCategoryTree(nodes, stack = []) {
  const list = [];
  nodes?.forEach(node => {
    const breadcrumb = [...stack, node.name];
    const resolvedSlug = slugify(node.slug ?? (typeof node.path === 'string' ? node.path.split('/').pop() : node.name));
    const resolvedPath = node.path ?? breadcrumb.map((part, idx) => {
        const slug = slugify(part);
        return slug || `category-${idx}`;
      }).join('/');
    list.push({
      id: node.id,
      name: node.name,
      fullName: node.fullName ?? breadcrumb.join(' > '),
      depth: node.depth ?? stack.length,
      parentId: node.parentId ?? null,
      slug: resolvedSlug,
      path: resolvedPath,
  label: `${NBSP.repeat(stack.length * 2)}${stack.length ? '↳ ' : ''}${node.name}`,
      breadcrumb,
      raw: node
    });
    if (node.children && node.children.length) {
      list.push(...flattenCategoryTree(node.children, [...stack, node.name]));
    }
  });
  return list;
}

let authTokenGetter = () => null;
export function configureAuthTokenGetter(fn){ authTokenGetter = fn; }

const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedCategoryTree = null;
let cachedCategoryList = null;
let categoryCacheTimestamp = 0;
let categoryListPromise = null;

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
  homepage: {
    get: (slug) => {
      const unwrap = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);
      if (!slug) {
        return request('/homepage').then(unwrap);
      }
      const normalized = String(slug).trim();
      return request(`/homepage/${encodeURIComponent(normalized)}`).then(unwrap);
    }
  },
  settings: {
    get: () => request('/settings')
  },
  auth: {
    login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
    register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
    me: () => request('/user/me'),
    changePassword: (payload) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) }),
    requestPasswordReset: (email) => request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
    confirmPasswordReset: (payload) => request('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(payload) })
  },
  payments: {
    create: (payload) => request('/payments', { method: 'POST', body: JSON.stringify(payload) }),
    initiateMobileMoney: (payload) => request('/payments/mobile-money/initiate', { method: 'POST', body: JSON.stringify(payload) }),
    initiateManual: (payload) => request('/payments/manual/initiate', { method: 'POST', body: JSON.stringify(payload) }),
    reconcileManual: (payload) => request('/payments/manual/reconcile', { method: 'POST', body: JSON.stringify(payload) }),
    byOrder: (orderId) => request(`/payments/order/${orderId}`),
    markFailed: (orderId, payload) => request(`/payments/order/${orderId}/fail`, { method: 'POST', body: JSON.stringify(payload ?? {}) }),
    options: () => request('/payments/options')
  },
  delivery: {
    shops: ({ includeInactive = false, lat, lng } = {}) => {
      const params = new URLSearchParams();
      if (includeInactive) params.set('includeInactive', 'true');
      if (lat != null) params.set('lat', lat);
      if (lng != null) params.set('lng', lng);
      const qs = params.toString();
      return request(`/delivery/shops${qs ? `?${qs}` : ''}`);
    },
    quote: ({ lat, lng, cartTotal, shopId } = {}) => request('/delivery/quote', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, cartTotal, shopId })
    }),
    geoSearch: (q, { limit = 5 } = {}) => {
      if (!q || String(q).trim().length < 3) {
        return Promise.resolve({ query: q, results: [] });
      }
      const params = new URLSearchParams();
      params.set('q', q);
      if (limit != null) params.set('limit', limit);
      return request(`/geo/search?${params.toString()}`);
    }
  },
  products: {
    list: (page=0,size=10) => request(`/products?page=${page}&size=${size}`),
    get: (id) => request(`/products/${id}`).then(res => res?.data ?? res),
    priceRange: (categoryId) => {
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
      return request(`/products/price-range${qs}`);
    },
    byCategory: (cat) => request(`/products/category/${encodeURIComponent(cat)}`),
    related: (id, { limit = 6 } = {}) => {
      const params = new URLSearchParams();
      if (limit != null) params.set('limit', limit);
      const qs = params.toString();
      return request(`/products/${id}/related${qs ? `?${qs}` : ''}`);
    },
    search: ({ q, brand, brands, brandId, brandIds, brandSlug, brandSlugs, categoryId, minPrice, maxPrice, inStock, scope, promoTag, tag, tags, trendingDays, ids, page = 0, size = 10 } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (scope) params.set('scope', scope);
      const tagCandidates = [];
      if (Array.isArray(tags)) {
        tags.filter(Boolean).forEach(value => tagCandidates.push(value));
      }
      if (tag) tagCandidates.push(tag);
      if (promoTag) tagCandidates.push(promoTag);
      const appendedTagSlugs = new Set();
      tagCandidates
        .map(value => (value == null ? '' : String(value).trim()))
        .filter(value => value.length > 0)
        .forEach(value => {
          if (appendedTagSlugs.has(value)) return;
          appendedTagSlugs.add(value);
          params.append('tags[]', value);
        });
      if (promoTag) params.set('promoTag', promoTag);
      if (brand) params.set('brand', brand);
      if (Array.isArray(brands)) {
        brands.filter(Boolean).forEach(b => params.append('brands[]', b));
      }
      if (brandId) params.set('brandId', brandId);
      if (Array.isArray(brandIds)) {
        brandIds.filter(Boolean).forEach(value => params.append('brandIds[]', value));
      }
      if (brandSlug) params.set('brandSlug', slugify(brandSlug));
      if (Array.isArray(brandSlugs)) {
        brandSlugs
          .map(value => slugify(value))
          .filter(Boolean)
          .forEach(slug => params.append('brandSlugs[]', slug));
      }
      if (categoryId) params.set('categoryId', categoryId);
      if (minPrice != null) params.set('minPrice', minPrice);
      if (maxPrice != null) params.set('maxPrice', maxPrice);
      if (inStock != null) params.set('inStock', inStock);
      if (trendingDays != null) params.set('trendingDays', trendingDays);
      if (Array.isArray(ids)) {
        ids.filter(id => id !== null && id !== undefined && id !== '').forEach(id => {
          params.append('ids[]', id);
        });
      }
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
    deleteImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
    ratings: {
      list: (productId, { page = 0, size = 10 } = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', Math.max(1, Math.min(50, size)));
        return request(`/products/${productId}/ratings?${params.toString()}`);
      },
      summary: (productId) => request(`/products/${productId}/ratings/summary`),
      create: (productId, payload) => request(`/products/${productId}/ratings`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  },
  brands: {
    list: ({ categoryId, q, active = true, limit = 200 } = {}) => {
      const params = new URLSearchParams();
      if (categoryId) params.set('categoryId', categoryId);
      if (q) params.set('q', q);
      if (active !== undefined && active !== null) params.set('active', active ? 'true' : 'false');
      if (limit != null) params.set('limit', Math.min(Math.max(Number(limit) || 0, 1), 500));
      const qs = params.toString();
      return request(`/brands${qs ? `?${qs}` : ''}`).then(res => res?.data ?? res ?? []);
    }
  },
  categories: {
    list: () => {
      const now = Date.now();
      if (cachedCategoryList && (now - categoryCacheTimestamp) < CATEGORY_CACHE_TTL_MS) {
        return Promise.resolve(cachedCategoryList);
      }
      if (categoryListPromise) {
        return categoryListPromise.then(tree => flattenCategoryTree(tree));
      }
      categoryListPromise = request('/categories')
        .then(tree => {
          cachedCategoryTree = tree;
          cachedCategoryList = flattenCategoryTree(tree);
          categoryCacheTimestamp = Date.now();
          return tree;
        })
        .finally(() => {
          categoryListPromise = null;
        });
      return categoryListPromise.then(() => cachedCategoryList);
    },
    tree: () => {
      const now = Date.now();
      if (cachedCategoryTree && (now - categoryCacheTimestamp) < CATEGORY_CACHE_TTL_MS) {
        return Promise.resolve(cachedCategoryTree);
      }
      if (categoryListPromise) {
        return categoryListPromise.then(() => cachedCategoryTree);
      }
      categoryListPromise = request('/categories')
        .then(tree => {
          cachedCategoryTree = tree;
          cachedCategoryList = flattenCategoryTree(tree);
          categoryCacheTimestamp = Date.now();
          return tree;
        })
        .finally(() => {
          categoryListPromise = null;
        });
      return categoryListPromise;
    }
  },
  orders: {
    create: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
    list: () => request('/orders'),
    get: (id) => request(`/orders/${id}`)
  },
  coupons: {
    preview: ({ code, cartTotal, customerPhone } = {}) => request('/coupons/preview', {
      method: 'POST',
      body: JSON.stringify({ code, cartTotal, customerPhone })
    })
  },
  user: {
    orders: (page=0,size=10) => request(`/user/orders?page=${page}&size=${size}`),
    preferences: {
      get: () => request('/user/preferences'),
      update: (payload) => request('/user/preferences', { method: 'PUT', body: JSON.stringify(payload) })
    }
  },
  admin: {
    stats: () => request('/admin/dashboard/stats'),
    recentOrders: (limit=10) => request(`/admin/dashboard/recent-orders?limit=${limit}`),
    analytics: {
      overview: ({ rangeDays = 30, from, to } = {}) => {
        const params = new URLSearchParams();
        if (rangeDays != null) params.set('rangeDays', rangeDays);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        return request(`/admin/analytics/overview${qs ? `?${qs}` : ''}`);
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
    users: {
      list: (page = 0, size = 20, filters = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', size);
        const { q, role, active, from, to, sort = 'created_at', direction = 'desc' } = filters;
        if (q) params.set('q', q);
        if (role) params.set('role', role);
        if (active !== undefined && active !== null && active !== '') params.set('active', active);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/users?${params.toString()}`);
      },
      activate: (userId) => request(`/admin/users/${userId}/activate`, { method: 'POST' }),
      deactivate: (userId) => request(`/admin/users/${userId}/deactivate`, { method: 'POST' }),
      orders: (userId, { page = 0, size = 10, status, from, to, sort = 'created_at', direction = 'desc' } = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', size);
        if (status) params.set('status', status);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/users/${userId}/orders?${params.toString()}`);
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
        const { q, brand, categoryId, minPrice, maxPrice, inStock, sort='name', direction='asc' } = filters;
        if (q) params.set('q', q);
        if (brand) params.set('brand', brand);
        if (categoryId) params.set('categoryId', categoryId);
        if (minPrice != null) params.set('minPrice', minPrice);
        if (maxPrice != null) params.set('maxPrice', maxPrice);
        if (inStock != null) params.set('inStock', inStock);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/products?${params.toString()}`);
      }
    },
    brands: {
      list: ({ page = 0, size = 20, q, categoryId, active, sort = 'name', direction = 'asc' } = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', size);
        if (q) params.set('q', q);
        if (categoryId) params.set('categoryId', categoryId);
        if (active !== undefined && active !== null && active !== '') params.set('active', active);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/brands?${params.toString()}`);
      },
      create: (payload) => request('/admin/brands', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(`/admin/brands/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      delete: (id) => request(`/admin/brands/${id}`, { method: 'DELETE' })
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
      updateStatus: (paymentId, status) => request(`/admin/payments/${paymentId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
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
      deliveryShops: {
        list: ({ page = 0, size = 20, q, active, lat, lng } = {}) => {
          const params = new URLSearchParams();
          params.set('page', page);
          params.set('size', size);
          if (q) params.set('q', q);
          if (active !== undefined && active !== null) params.set('active', active);
          if (lat != null) params.set('lat', lat);
          if (lng != null) params.set('lng', lng);
          return request(`/admin/delivery/shops?${params.toString()}`);
        },
        create: (payload) => request('/admin/delivery/shops', { method: 'POST', body: JSON.stringify(payload) }),
        update: (id, payload) => request(`/admin/delivery/shops/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        remove: (id) => request(`/admin/delivery/shops/${id}`, { method: 'DELETE' }),
        activate: (id) => request(`/admin/delivery/shops/${id}/activate`, { method: 'POST' }),
        deactivate: (id) => request(`/admin/delivery/shops/${id}/deactivate`, { method: 'POST' })
      },
      deliveries: {
        list: ({ page = 0, size = 20, status, shopId, from, to } = {}) => {
          const params = new URLSearchParams();
          params.set('page', page);
          params.set('size', size);
          if (status) params.set('status', status);
          if (shopId) params.set('shopId', shopId);
          if (from) params.set('from', from);
          if (to) params.set('to', to);
          return request(`/admin/deliveries?${params.toString()}`);
        },
        get: (id) => request(`/admin/deliveries/${id}`),
        updateStatus: (id, payload) => request(`/admin/deliveries/${id}/status`, { method: 'PUT', body: JSON.stringify(payload) })
      },
    coupons: {
      list: ({ page = 0, size = 20, search, status, active, startsFrom, endsTo, sort, direction } = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', size);
        if (search) params.set('q', search);
        if (active !== undefined && active !== null && active !== '') {
          params.set('active', String(active));
        } else if (status) {
          const normalized = String(status).toLowerCase();
          if (normalized === 'active') params.set('active', 'true');
          else if (normalized === 'inactive') params.set('active', 'false');
          else params.set('status', status);
        }
        if (startsFrom) params.set('startsFrom', startsFrom);
        if (endsTo) params.set('endsTo', endsTo);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/coupons?${params.toString()}`);
      },
      create: (payload) => request('/admin/coupons', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(`/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      delete: (id) => request(`/admin/coupons/${id}`, { method: 'DELETE' }),
      activate: (id) => request(`/admin/coupons/${id}/activate`, { method: 'POST' }),
      deactivate: (id) => request(`/admin/coupons/${id}/deactivate`, { method: 'POST' })
    },
    systemSettings: {
      list: () => request('/admin/system-settings'),
      save: (settings) => request('/admin/system-settings', { method: 'POST', body: JSON.stringify({ settings }) }),
      uploadAsset: (file, { type } = {}) => {
        const fd = new FormData();
        fd.append('file', file);
        if (type) fd.append('type', type);
        return request('/admin/system-settings/assets', { method: 'POST', body: fd });
      }
    },
    productTags: {
      list: ({ page = 0, size = 20, q, sort = 'name', direction = 'asc' } = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', size);
        if (q) params.set('q', q);
        if (sort) params.set('sort', sort);
        if (direction) params.set('direction', direction);
        return request(`/admin/product-tags?${params.toString()}`);
      },
      create: (payload) => request('/admin/product-tags', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id, payload) => request(`/admin/product-tags/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      delete: (id) => request(`/admin/product-tags/${id}`, { method: 'DELETE' })
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
    },
    homepageLayouts: {
      list: ({ page = 0, size = 20, q, slug, status, active } = {}) => {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('size', size);
        if (q) params.set('q', q);
        if (slug) params.set('slug', slug);
        if (status) params.set('status', status);
        if (active != null) params.set('active', active ? 'true' : 'false');
        const qs = params.toString();
        return request(`/admin/homepage/layouts${qs ? `?${qs}` : ''}`);
      },
      create: (payload) => request('/admin/homepage/layouts', { method: 'POST', body: JSON.stringify(payload) }),
      get: (id) => request(`/admin/homepage/layouts/${id}`),
      update: (id, payload) => request(`/admin/homepage/layouts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      publish: (id) => request(`/admin/homepage/layouts/${id}/publish`, { method: 'POST' }),
      remove: (id) => request(`/admin/homepage/layouts/${id}`, { method: 'DELETE' }),
      uploadMedia: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return request('/admin/homepage/media', { method: 'POST', body: fd });
      }
    }
  }
};

export function mapProductResponse(raw) {
  const p = raw?.data ?? raw;
  if (!p) return {
    id: null,
    name: '',
    price: 0,
    unit: '',
    category: '',
    image: '',
    images: [],
    imageObjects: [],
    description: '',
    stock: undefined,
    categoryId: undefined,
    tags: [],
    tagSlugs: []
  };
  // Prefer structured images (with id/url/position), fallback to legacy list of URLs.
  let imageMeta = Array.isArray(p.images) ? p.images : [];
  if (imageMeta.length === 0) {
    const legacyUrls = Array.isArray(p.imageUrls) ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
    imageMeta = legacyUrls.map((u, idx) => ({ id: null, url: u, position: idx }));
  }
  // Sort by position just in case
  imageMeta = [...imageMeta].sort((a,b)=>(a.position??0)-(b.position??0));
  const images = imageMeta.map(im => toAbsoluteAssetUrl(im.url));
  const ratingAverage = Number.isFinite(Number(p.ratingAverage ?? p.rating?.average))
    ? Number(p.ratingAverage ?? p.rating?.average)
    : 0;
  const ratingCount = Number.isFinite(Number(p.ratingCount ?? p.rating?.count))
    ? Number(p.ratingCount ?? p.rating?.count)
    : 0;
  const ratingLastSubmittedAt = p.ratingLastSubmittedAt ?? p.rating?.lastSubmittedAt ?? null;
  const tags = Array.isArray(p.tags)
    ? p.tags.map(tag => ({
        id: tag.id ?? null,
        name: tag.name ?? '',
        slug: tag.slug ?? '',
        description: tag.description ?? ''
      }))
    : [];
  const tagSlugs = Array.isArray(p.tagSlugs)
    ? p.tagSlugs.filter(Boolean).map(slug => String(slug))
    : tags.map(tag => tag.slug).filter(Boolean);
  return {
    id: p.id,
    name: p.name,
    brand: (p.brandName ?? p.brand ?? p.brand_name ?? '') || '',
    brandId: p.brandId ?? p.brand_id ?? null,
    brandName: p.brandName ?? p.brand ?? p.brand_name ?? '',
    brandSlug: p.brandSlug ?? p.brand_slug ?? null,
    price: Number(p.price),
    unit: p.unit || '',
    category: p.categoryName || 'Other',
    image: images[0] || '',
    images, // array of absolute URLs for existing components
    imageObjects: imageMeta.map(im => ({ ...im, absoluteUrl: toAbsoluteAssetUrl(im.url) })), // expose metadata + absolute
    description: p.description || '',
    stock: p.stock != null ? p.stock : undefined,
    categoryId: p.categoryId,
    ratingAverage,
    ratingCount,
    ratingLastSubmittedAt,
    tags,
    tagSlugs
  };
}

import mpesaLogo from '../assets/mpesa.svg';
import airtelLogo from '../assets/airtel.svg';

export const paymentBranding = {
  MPESA: { color: '#1A7F37', bg: '#e6f5ec', logoText: 'M-Pesa', logo: mpesaLogo, ring: '#32b768' },
  AIRTEL: { color: '#e60000', bg: '#fdeaea', logoText: 'Airtel', logo: airtelLogo, ring: '#ff4d4d' }
};
