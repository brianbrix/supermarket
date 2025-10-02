import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import '../../App.admin.css';

const SEVERITY_VARIANTS = {
  info: 'primary',
  warning: 'warning',
  danger: 'danger',
  success: 'success',
};

const TYPE_LABELS = {
  'order.new': 'New order',
  'order.high_value': 'High value order',
  'order.delay': 'Order delay',
  'inventory.low_stock': 'Low stock',
  'inventory.out_of_stock': 'Out of stock',
  'rating.new': 'New rating',
  'delivery.requested': 'Delivery requested',
};

const RATING_FILTER_OPTIONS = [
  { value: '', label: 'All ratings' },
  { value: 5, label: '5 ★' },
  { value: 4, label: '4 ★' },
  { value: 3, label: '3 ★' },
  { value: 2, label: '2 ★' },
  { value: 1, label: '1 ★' },
];

export default function AdminNotifications() {
  const { push } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pageMeta, setPageMeta] = useState({ page: 0, size: 20, totalPages: 0, totalElements: 0, first: true, last: true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ unreadOnly: true, type: '', severity: '' });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);

  const [activePanel, setActivePanel] = useState('notifications');

  const [productQuery, setProductQuery] = useState('');
  const debouncedProductQuery = useDebounce(productQuery, 300);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [ratingsMeta, setRatingsMeta] = useState({ page: 0, size: 10, totalPages: 0, totalElements: 0, first: true, last: true });
  const [ratingsPage, setRatingsPage] = useState(0);
  const [ratingsSize, setRatingsSize] = useState(10);
  const [ratingFilters, setRatingFilters] = useState({ onlyFlagged: false, rating: '' });
  const [ratingsError, setRatingsError] = useState(null);
  const [ratingSummary, setRatingSummary] = useState(null);

  const loadNotifications = useCallback(() => {
    setLoading(true);
    setError(null);
    api.admin.notifications
      .list({
        page,
        size,
        unread: filters.unreadOnly ? true : undefined,
        type: filters.type || undefined,
        severity: filters.severity || undefined,
        q: debouncedSearch || undefined,
      })
      .then((res) => {
        const items = Array.isArray(res?.content) ? res.content : [];
        setNotifications(items);
        setUnreadCount(res?.unreadCount ?? (items.filter((n) => !n.read_at).length ?? 0));
        const normalizedPage = Math.max(0, (res?.page ?? 1) - 1);
        setPageMeta({
          page: normalizedPage,
          size: res?.size ?? size,
          totalPages: res?.totalPages ?? 0,
          totalElements: res?.totalElements ?? items.length,
          numberOfElements: res?.numberOfElements ?? items.length,
          first: res?.first ?? normalizedPage === 0,
          last: res?.last ?? (res?.totalPages ? normalizedPage + 1 >= res.totalPages : true),
        });
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load notifications');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, size, filters.unreadOnly, filters.type, filters.severity, debouncedSearch]);

  const loadRatings = useCallback((productId) => {
    if (!productId) return;
    setRatingLoading(true);
    setRatingsError(null);
    api.admin.products.ratings
      .list(productId, {
        page: ratingsPage,
        size: ratingsSize,
        rating: ratingFilters.rating,
        onlyFlagged: ratingFilters.onlyFlagged,
      })
      .then((res) => {
        const items = Array.isArray(res?.content) ? res.content : [];
        setRatings(items);
        setRatingsMeta({
          page: res?.page ?? 0,
          size: res?.size ?? ratingsSize,
          totalPages: res?.totalPages ?? 0,
          totalElements: res?.totalElements ?? items.length,
          numberOfElements: res?.numberOfElements ?? items.length,
          first: res?.first ?? (res?.page ?? 0) <= 0,
          last: res?.last ?? false,
        });
      })
      .then(() => api.products.ratings.summary(productId))
      .then((summary) => setRatingSummary(summary))
      .catch((err) => {
        setRatingsError(err?.message || 'Failed to load ratings');
        setRatings([]);
        setRatingsMeta((prev) => ({ ...prev, totalElements: 0, totalPages: 0, numberOfElements: 0 }));
        setRatingSummary(null);
      })
      .finally(() => {
        setRatingLoading(false);
      });
  }, [ratingsPage, ratingsSize, ratingFilters.rating, ratingFilters.onlyFlagged]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!selectedProduct) return;
    loadRatings(selectedProduct.id);
  }, [selectedProduct, loadRatings]);

  useEffect(() => {
    if (!debouncedProductQuery || debouncedProductQuery.trim().length < 2) {
      setProductSuggestions([]);
      return;
    }
    let cancelled = false;
    setProductLookupLoading(true);
    api.admin.products
      .list(0, 6, { q: debouncedProductQuery, sort: 'name', direction: 'asc', active: null })
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res?.content) ? res.content : res;
        setProductSuggestions(items?.slice(0, 6) ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setProductSuggestions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setProductLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedProductQuery]);


  const unreadByType = useMemo(() => {
    return notifications
      .filter((n) => !n.read_at)
      .reduce((acc, item) => {
        const key = item.type || 'other';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
  }, [notifications]);

  const severityOptions = useMemo(() => ([
    { value: '', label: 'Any severity' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'danger', label: 'Critical' },
    { value: 'success', label: 'Success' },
  ]), []);

  const typeOptions = useMemo(() => ([
    { value: '', label: 'All types' },
    ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
  ]), []);

  const handleToggleRead = useCallback((notification) => {
    if (!notification) return;
    const currentlyUnread = !notification.read_at;
    api.admin.notifications
      .markRead(notification.id, currentlyUnread)
      .then((res) => {
        setNotifications((prev) => prev.map((item) => (item.id === notification.id ? res : item)));
        setUnreadCount((prev) => Math.max(0, prev + (currentlyUnread ? -1 : 1)));
      })
      .catch((err) => {
        push(err?.message || 'Failed to update notification', 'error');
      });
  }, [push]);

  const handleMarkAllRead = useCallback(() => {
    api.admin.notifications
      .markAllRead()
      .then(() => {
        push('Marked all notifications as read.', 'info');
        setPage(0);
        loadNotifications();
      })
      .catch((err) => {
        push(err?.message || 'Failed to mark notifications as read', 'error');
      });
  }, [loadNotifications, push]);

  const selectProduct = useCallback((product) => {
    if (!product) return;
    setProductQuery(product.name || '');
    setProductSuggestions([]);
    setSelectedProduct(product);
    setRatingsPage(0);
  }, []);

  const toggleFlagged = useCallback((rating) => {
    if (!rating) return;
    const nextState = !rating.isFlagged;
    api.admin.products.ratings
      .update(rating.id, { is_flagged: nextState })
      .then((res) => {
        setRatings((prev) => prev.map((item) => (item.id === rating.id ? res : item)));
      })
      .catch((err) => {
        push(err?.message || 'Failed to update rating', 'error');
      });
  }, [push]);

  const deleteRating = useCallback((rating) => {
    if (!rating) return;
    if (!window.confirm('Delete this rating? This action cannot be undone.')) return;
    api.admin.products.ratings
      .delete(rating.id)
      .then(() => {
        push('Rating deleted.', 'info');
        loadRatings(selectedProduct?.id);
      })
      .catch((err) => {
        push(err?.message || 'Failed to delete rating', 'error');
      });
  }, [push, loadRatings, selectedProduct]);

  const ratingStats = useMemo(() => {
    if (!ratingSummary) return [];
    return Object.entries(ratingSummary.distribution ?? {}).map(([stars, count]) => ({
      stars: Number(stars),
      count: Number(count),
    }));
  }, [ratingSummary]);

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4 gap-3">
        <div>
          <h1 className="h4 mb-1">Notifications & Feedback</h1>
          <p className="text-muted mb-0">Stay on top of critical store activity and customer sentiment.</p>
        </div>
        <div className="btn-group" role="group" aria-label="Toggle panel">
          <button type="button" className={`btn btn-sm ${activePanel === 'notifications' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setActivePanel('notifications')}>
            Notifications
          </button>
          <button type="button" className={`btn btn-sm ${activePanel === 'feedback' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setActivePanel('feedback')}>
            Ratings &amp; Feedback
          </button>
        </div>
      </div>

      {activePanel === 'notifications' && (
        <section className="mb-5">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between">
                    <h2 className="h6 mb-0">Unread</h2>
                    <span className="badge bg-success-subtle text-success fw-semibold">{unreadCount}</span>
                  </div>
                  <p className="text-muted small mb-0">New events awaiting your attention.</p>
                </div>
              </div>
            </div>
            <div className="col-md-9">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {Object.entries(TYPE_LABELS).map(([type, label]) => (
                      <span key={type} className="badge bg-body-tertiary text-muted border">
                        {label}
                        <span className="ms-1 fw-semibold">{unreadByType[type] ?? 0}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <FilterBar>
            <FilterBar.Field label="Search" width="col-12 col-md-4">
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Search notification text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </FilterBar.Field>
            <FilterBar.Field label="Type" width="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filters.type} onChange={(e) => { setFilters((prev) => ({ ...prev, type: e.target.value })); setPage(0); }}>
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterBar.Field>
            <FilterBar.Field label="Severity" width="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filters.severity} onChange={(e) => { setFilters((prev) => ({ ...prev, severity: e.target.value })); setPage(0); }}>
                {severityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterBar.Field>
            <FilterBar.Field label="Unread only" width="col-12 col-md-2">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="filterUnread"
                  checked={filters.unreadOnly}
                  onChange={(e) => { setFilters((prev) => ({ ...prev, unreadOnly: e.target.checked })); setPage(0); }}
                />
                <label className="form-check-label" htmlFor="filterUnread">Unread</label>
              </div>
            </FilterBar.Field>
            <FilterBar.Extra>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => {
                  setFilters({ unreadOnly: false, type: '', severity: '' });
                  setSearch('');
                  setPage(0);
                }}>Reset</button>
                <button type="button" className="btn btn-sm btn-success" onClick={handleMarkAllRead} disabled={unreadCount === 0}>Mark all read</button>
              </div>
            </FilterBar.Extra>
          </FilterBar>

          {loading ? (
            <p className="text-muted">Loading notifications…</p>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="alert alert-light border">No notifications found for the current filters.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th style={{ minWidth: '140px' }}>Time</th>
                    <th>Title</th>
                    <th>Details</th>
                    <th style={{ width: '120px' }}>Severity</th>
                    <th style={{ width: '90px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((item) => (
                    <tr key={item.id} className={item.read_at ? '' : 'table-light'}>
                      <td>
                        <div className="d-flex flex-column">
                          <span>{formatDate(item.created_at)}</span>
                          <small className="text-muted">{TYPE_LABELS[item.type] ?? item.type ?? 'Notification'}</small>
                        </div>
                      </td>
                      <td className="fw-semibold">{item.title}</td>
                      <td>
                        <p className="mb-1 small text-body-secondary">{item.message || '—'}</p>
                        {renderContext(item)}
                      </td>
                      <td>
                        <span className={`badge bg-${SEVERITY_VARIANTS[item.severity] || 'secondary'}`}>{item.severity || 'info'}</span>
                      </td>
                      <td className="text-end">
                        <button type="button" className={`btn btn-sm ${item.read_at ? 'btn-outline-secondary' : 'btn-success'}`} onClick={() => handleToggleRead(item)}>
                          {item.read_at ? 'Unread' : 'Read'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <PaginationBar
            {...pageMeta}
            size={size}
            onPageChange={(next) => setPage(Math.max(0, next))}
            sizes={[10, 20, 50]}
            onPageSizeChange={(nextSize) => { setSize(nextSize); setPage(0); }}
            alwaysVisible
          />
        </section>
      )}

      {activePanel === 'feedback' && (
        <section className="mb-4">
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-lg-6">
                  <label className="form-label small text-uppercase fw-semibold">Find product</label>
                  <div className="position-relative">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Search products by name"
                      value={productQuery}
                      onChange={(e) => { setProductQuery(e.target.value); }}
                    />
                    {productLookupLoading && <span className="spinner-border spinner-border-sm position-absolute top-50 end-0 translate-middle-y me-3 text-success" role="status" aria-hidden="true"></span>}
                    {productSuggestions.length > 0 && (
                      <ul className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 5 }}>
                        {productSuggestions.map((product) => (
                          <li key={product.id} className="list-group-item list-group-item-action" role="button" onClick={() => selectProduct(product)}>
                            <div className="d-flex justify-content-between">
                              <span>{product.name}</span>
                              {product.stock != null && <span className="text-muted small">Stock: {product.stock}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="col-6 col-lg-3">
                  <label className="form-label small text-uppercase fw-semibold">Rating</label>
                  <select className="form-select" value={ratingFilters.rating} onChange={(e) => { setRatingFilters((prev) => ({ ...prev, rating: e.target.value })); setRatingsPage(0); }}>
                    {RATING_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-lg-3 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="flaggedFilter" checked={ratingFilters.onlyFlagged} onChange={(e) => { setRatingFilters((prev) => ({ ...prev, onlyFlagged: e.target.checked })); setRatingsPage(0); }} />
                    <label className="form-check-label" htmlFor="flaggedFilter">Flagged only</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedProduct ? (
            <div className="card">
              <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h2 className="h6 mb-0">{selectedProduct.name}</h2>
                  {ratingSummary && (
                    <small className="text-muted">{ratingSummary.count} reviews · Average {Number(ratingSummary.average || 0).toFixed(2)} ★</small>
                  )}
                </div>
                <div className="d-flex gap-2 align-items-center">
                  {ratingStats.map((entry) => (
                    <span key={entry.stars} className="badge bg-body-tertiary text-muted border">
                      {entry.stars}★
                      <span className="ms-1 fw-semibold">{entry.count}</span>
                    </span>
                  ))}
                  <Link to={`/product/${selectedProduct.id}`} className="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener noreferrer">View product</Link>
                </div>
              </div>
              <div className="card-body p-0">
                {ratingLoading ? (
                  <p className="text-muted px-3 py-4 mb-0">Loading ratings…</p>
                ) : ratingsError ? (
                  <div className="alert alert-danger m-3">{ratingsError}</div>
                ) : ratings.length === 0 ? (
                  <div className="alert alert-light border m-3">No ratings match the current filters.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: '70px' }}>Rating</th>
                          <th>Title &amp; Comment</th>
                          <th style={{ width: '160px' }}>Customer</th>
                          <th style={{ width: '120px' }}>Submitted</th>
                          <th style={{ width: '150px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratings.map((rating) => (
                          <tr key={rating.id}>
                            <td>
                              <span className="badge bg-warning-subtle text-warning fw-semibold">{rating.rating} ★</span>
                              {rating.isVerified && <span className="badge bg-success-subtle text-success ms-2">Verified</span>}
                            </td>
                            <td>
                              <div className="fw-semibold mb-1">{rating.title || '—'}</div>
                              <p className="mb-0 small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{rating.comment || 'No comment provided.'}</p>
                            </td>
                            <td>
                              <div className="d-flex flex-column">
                                <span>{rating.customerName || rating.user?.name || 'Anonymous'}</span>
                                {rating.user?.email && <small className="text-muted">{rating.user.email}</small>}
                              </div>
                            </td>
                            <td>{formatDate(rating.createdAt)}</td>
                            <td>
                              <div className="btn-group btn-group-sm" role="group">
                                <button type="button" className={`btn ${rating.isFlagged ? 'btn-outline-warning' : 'btn-outline-secondary'}`} onClick={() => toggleFlagged(rating)}>
                                  {rating.isFlagged ? 'Unflag' : 'Flag'}
                                </button>
                                <button type="button" className="btn btn-outline-danger" onClick={() => deleteRating(rating)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="card-footer">
                <PaginationBar
                  {...ratingsMeta}
                  size={ratingsSize}
                  onPageChange={(next) => setRatingsPage(Math.max(0, next))}
                  sizes={[5, 10, 20]}
                  onPageSizeChange={(next) => { setRatingsSize(next); setRatingsPage(0); }}
                />
              </div>
            </div>
          ) : (
            <div className="alert alert-info">Search for a product to review customer feedback.</div>
          )}
        </section>
      )}
    </div>
  );
}

function renderContext(notification) {
  const data = notification?.data;
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <dl className="row row-cols-2 g-1 small text-muted">
      {entries.map(([key, value]) => (
        <div className="col" key={key}>
          <dt className="text-uppercase text-muted" style={{ fontSize: '0.65rem' }}>{formatKey(key)}</dt>
          <dd className="mb-0">{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function formatDate(value) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  } catch (err) {
    return value;
  }
}
