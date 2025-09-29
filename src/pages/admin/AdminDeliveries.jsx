import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import DeliveryDetailModal from '../../components/admin/DeliveryDetailModal.jsx';
import { DELIVERY_STATUSES } from '../../config/deliveryStatuses.js';
import { captureApiError, formatApiError } from '../../utils/errors.js';
import '../../App.admin.css';

const INITIAL_PAGE_META = { page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true, numberOfElements: 0 };

export default function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [pageMeta, setPageMeta] = useState(INITIAL_PAGE_META);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shops, setShops] = useState([]);
  const [draftFilters, setDraftFilters] = useState({ status: '', shopId: '', from: '', to: '' });
  const [appliedFilters, setAppliedFilters] = useState({ status: '', shopId: '', from: '', to: '' });
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedDeliveryLoading, setSelectedDeliveryLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const debounceRef = useRef();
  const firstDebounceRef = useRef(true);
  const didInitialLoadRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await api.admin.deliveryShops.list({ size: 200, active: true });
        if (!active) return;
        const list = Array.isArray(resp?.content)
          ? resp.content
          : Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp?.items)
              ? resp.items
              : Array.isArray(resp)
                ? resp
                : [];
        setShops(list);
      } catch (err) {
        console.warn('Failed to load delivery shops', err);
        setShops([]);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      loadDeliveries();
      return;
    }
    loadDeliveries();
  }, [page, size, appliedFilters]);

  useEffect(() => {
    if (firstDebounceRef.current) {
      firstDebounceRef.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAppliedFilters({ ...draftFilters });
      setPage(0);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [draftFilters.status, draftFilters.shopId, draftFilters.from, draftFilters.to]);

  function loadDeliveries() {
    setLoading(true);
    setError(null);
    const payload = {};
    if (appliedFilters.status) payload.status = appliedFilters.status;
    if (appliedFilters.shopId) payload.shopId = appliedFilters.shopId;
    if (appliedFilters.from) payload.from = appliedFilters.from;
    if (appliedFilters.to) payload.to = appliedFilters.to;
    api.admin.deliveries.list({ page, size, ...payload })
      .then(resp => {
        const list = Array.isArray(resp?.content)
          ? resp.content
          : Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp?.items)
              ? resp.items
              : Array.isArray(resp)
                ? resp
                : [];
        setDeliveries(list);
        setPageMeta(metaFromResponse(resp));
        setLoading(false);
      })
      .catch(err => {
        captureApiError(err);
        setError(formatApiError(err, 'Could not load deliveries'));
        setDeliveries([]);
        setPageMeta(INITIAL_PAGE_META);
        setLoading(false);
      });
  }

  function metaFromResponse(resp) {
    if (!resp || typeof resp !== 'object') return { ...INITIAL_PAGE_META, page, size };
    const derived = {
      page: resp.page ?? page,
      size: resp.size ?? size,
      totalElements: resp.totalElements ?? resp.total ?? (Array.isArray(resp.content) ? resp.content.length : resp.numberOfElements ?? 0),
      totalPages: resp.totalPages ?? resp.total_pages ?? 1,
      numberOfElements: resp.numberOfElements ?? (Array.isArray(resp.content) ? resp.content.length : resp.numberOfElements ?? 0),
      first: resp.first ?? (resp.page === 0),
      last: resp.last ?? false
    };
    return derived;
  }

  function updateFilter(name, value) {
    setDraftFilters(prev => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    const base = { status: '', shopId: '', from: '', to: '' };
    setDraftFilters(base);
    setAppliedFilters(base);
    setPage(0);
    loadDeliveries();
  }

  async function handleStatusChange(delivery, status) {
    if (!delivery?.id) return;
    try {
      setDeliveries(prev => prev.map(d => d.id === delivery.id ? { ...d, status } : d));
      const updated = await api.admin.deliveries.updateStatus(delivery.id, { status });
      setDeliveries(prev => prev.map(d => d.id === delivery.id ? mergeDelivery(d, updated) : d));
      if (selectedDelivery?.id === delivery.id) {
        setSelectedDelivery(prev => prev ? mergeDelivery(prev, updated) : prev);
      }
    } catch (err) {
      captureApiError(err);
      setError(formatApiError(err, 'Could not update delivery status'));
      loadDeliveries();
    }
  }

  async function openDelivery(delivery) {
    if (!delivery?.id) return;
    setSelectedDelivery(delivery);
    try {
      setSelectedDeliveryLoading(true);
      const full = await api.admin.deliveries.get(delivery.id);
      setSelectedDelivery(prev => mergeDelivery(prev ?? delivery, full));
    } catch (err) {
      captureApiError(err);
      setError(formatApiError(err, 'Could not fetch delivery details'));
    } finally {
      setSelectedDeliveryLoading(false);
    }
  }

  async function handleModalSave(payload) {
    if (!selectedDelivery?.id) return;
    setModalSaving(true);
    try {
      const updated = await api.admin.deliveries.updateStatus(selectedDelivery.id, payload);
      setDeliveries(prev => prev.map(d => d.id === selectedDelivery.id ? mergeDelivery(d, updated) : d));
      setSelectedDelivery(prev => mergeDelivery(prev, updated));
      setModalSaving(false);
      setSelectedDelivery(null);
    } catch (err) {
      captureApiError(err);
      setError(formatApiError(err, 'Could not save delivery changes'));
      setModalSaving(false);
    }
  }

  const appliedFilterCount = useMemo(() => Object.values(appliedFilters).filter(Boolean).length, [appliedFilters]);

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Admin: Deliveries</h1>
        <Link to="/admin/delivery-shops" className="btn btn-outline-secondary btn-sm ms-auto">
          <i className="bi bi-geo-alt me-1"></i>Delivery Shops
        </Link>
      </div>
      <FilterBar>
        <FilterBar.Field label="Status" width="col-6 col-md-3">
          <select className="form-select form-select-sm" value={draftFilters.status} onChange={e => updateFilter('status', e.target.value)}>
            <option value="">All</option>
            {DELIVERY_STATUSES.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Shop" width="col-6 col-md-3">
          <select className="form-select form-select-sm" value={draftFilters.shopId} onChange={e => updateFilter('shopId', e.target.value)}>
            <option value="">All shops</option>
            {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name ?? `Shop #${shop.id}`}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="From" width="col-6 col-md-3">
          <input type="date" className="form-control form-control-sm" value={draftFilters.from ? draftFilters.from.substring(0, 10) : ''} onChange={e => updateFilter('from', e.target.value ? new Date(e.target.value).toISOString() : '')} />
        </FilterBar.Field>
        <FilterBar.Field label="To" width="col-6 col-md-3">
          <input type="date" className="form-control form-control-sm" value={draftFilters.to ? draftFilters.to.substring(0, 10) : ''} onChange={e => updateFilter('to', e.target.value ? new Date(e.target.value).toISOString() : '')} />
        </FilterBar.Field>
        <FilterBar.Reset onClick={clearFilters} disabled={appliedFilterCount === 0} />
      </FilterBar>
      {loading ? (
        <p>Loading deliveries…</p>
      ) : error ? (
        <div className="alert alert-danger" role="alert">{error}</div>
      ) : deliveries.length === 0 ? (
        <div className="alert alert-info" role="status">No deliveries found for the selected filters.</div>
      ) : (
        <div className="table-responsive small">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Shop</th>
                <th>Status</th>
                <th>Driver</th>
                <th>ETA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(delivery => {
                const order = delivery.order ?? {};
                const shop = delivery.shop ?? {};
                return (
                  <tr key={delivery.id}>
                    <td>#{delivery.id}</td>
                    <td>{delivery.createdAt ? new Date(delivery.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="fw-semibold">{order.orderNumber ?? (order.id != null ? `#${order.id}` : 'Order')}</span>
                        {order.id && <span className="text-muted">Order #{order.id}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <span>{order.customerName ?? '—'}</span>
                        <span className="text-muted small">{order.customerPhone ?? ''}</span>
                      </div>
                    </td>
                    <td>{shop.name ?? '—'}</td>
                    <td style={{ minWidth: '160px' }}>
                      <div className="d-flex flex-column gap-1">
                        <StatusBadge status={delivery.status} />
                        <select className="form-select form-select-sm" value={delivery.status} onChange={e => handleStatusChange(delivery, e.target.value)}>
                          {DELIVERY_STATUSES.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <span>{delivery.driverName ?? '—'}</span>
                        <span className="text-muted small">{delivery.driverPhone ?? ''}</span>
                      </div>
                    </td>
                    <td>{delivery.eta ? new Date(delivery.eta).toLocaleString() : '—'}</td>
                    <td className="text-end" style={{ minWidth: '110px' }}>
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openDelivery(delivery)}>
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar
            {...pageMeta}
            size={size}
            onPageChange={setPage}
            alwaysVisible
            sizes={[10, 20, 50, 100]}
            onPageSizeChange={newSize => {
              setSize(newSize);
              setPage(0);
            }}
          />
        </div>
      )}
      <DeliveryDetailModal
        delivery={selectedDelivery}
        loading={selectedDeliveryLoading}
        saving={modalSaving}
        onClose={() => { if (!modalSaving) setSelectedDelivery(null); }}
        onSubmit={handleModalSave}
      />
    </div>
  );
}

function mergeDelivery(current, next) {
  const nextData = normalizeDelivery(next);
  const currentData = normalizeDelivery(current);
  return { ...currentData, ...nextData };
}

function normalizeDelivery(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return raw;
}
