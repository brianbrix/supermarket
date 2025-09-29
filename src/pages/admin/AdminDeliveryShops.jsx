import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import DeliveryShopFormModal from '../../components/admin/DeliveryShopFormModal.jsx';
import '../../App.admin.css';

const INITIAL_PAGE_META = { page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true, numberOfElements: 0 };

export default function AdminDeliveryShops() {
  const [shops, setShops] = useState([]);
  const [pageMeta, setPageMeta] = useState(INITIAL_PAGE_META);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftFilters, setDraftFilters] = useState({ q: '', active: '' });
  const [appliedFilters, setAppliedFilters] = useState({ q: '', active: '' });
  const debounceRef = useRef();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  useEffect(() => {
    loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size, appliedFilters.q, appliedFilters.active]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAppliedFilters(prev => ({ ...prev, q: draftFilters.q.trim() }));
      setPage(0);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [draftFilters.q]);

  function updateFilter(name, value) {
    setDraftFilters(prev => ({ ...prev, [name]: value }));
    if (name === 'active') {
      setAppliedFilters(prev => ({ ...prev, active: value }));
      setPage(0);
    }
  }

  function resetFilters() {
    setDraftFilters({ q: '', active: '' });
    setAppliedFilters({ q: '', active: '' });
    setPage(0);
  }

  async function loadShops() {
    setLoading(true);
    setError(null);
    const params = { page, size };
    if (appliedFilters.q) params.q = appliedFilters.q;
    if (appliedFilters.active !== '') {
      params.active = appliedFilters.active === 'true' ? '1' : appliedFilters.active === 'false' ? '0' : appliedFilters.active;
    }
    try {
      const resp = await api.admin.deliveryShops.list(params);
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
      setPageMeta(metaFromResponse(resp));
    } catch (err) {
      console.error('Failed to load delivery shops', err);
      setError(err.message || 'Could not load delivery shops');
      setShops([]);
      setPageMeta({ ...INITIAL_PAGE_META, page, size });
    } finally {
      setLoading(false);
    }
  }

  function metaFromResponse(resp) {
    if (!resp || typeof resp !== 'object') return { ...INITIAL_PAGE_META, page, size };
    return {
      page: resp.page ?? page,
      size: resp.size ?? size,
      totalElements: resp.totalElements ?? resp.total ?? (Array.isArray(resp.content) ? resp.content.length : resp.numberOfElements ?? 0),
      totalPages: resp.totalPages ?? resp.total_pages ?? 1,
      numberOfElements: resp.numberOfElements ?? (Array.isArray(resp.content) ? resp.content.length : resp.numberOfElements ?? 0),
      first: resp.first ?? (resp.page === 0),
      last: resp.last ?? false,
    };
  }

  function openCreate() {
    setEditingShop(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(shop) {
    setEditingShop(shop);
    setModalError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (modalSaving) return;
    setModalOpen(false);
    setEditingShop(null);
    setModalError(null);
  }

  async function handleModalSubmit(payload) {
    setModalSaving(true);
    setModalError(null);
    try {
      if (editingShop?.id) {
        const updated = await api.admin.deliveryShops.update(editingShop.id, payload);
        setShops(prev => prev.map(shop => shop.id === editingShop.id ? normalizeShop(updated) : shop));
      } else {
        const created = await api.admin.deliveryShops.create(payload);
        setShops(prev => [normalizeShop(created), ...prev]);
      }
      setModalSaving(false);
      setModalOpen(false);
      setEditingShop(null);
      setTimeout(() => loadShops(), 0);
    } catch (err) {
      console.error('Failed to save delivery shop', err);
      setModalError(err.message || 'Could not save delivery shop');
      setModalSaving(false);
    }
  }

  async function handleToggleActive(shop) {
    if (!shop?.id) return;
    try {
      const action = shop.isActive ? api.admin.deliveryShops.deactivate : api.admin.deliveryShops.activate;
      const updated = await action(shop.id);
      setShops(prev => prev.map(item => item.id === shop.id ? normalizeShop(updated) : item));
    } catch (err) {
      console.error('Failed to toggle delivery shop', err);
      setError(err.message || 'Could not update shop status');
    }
  }

  async function handleDelete(shop) {
    if (!shop?.id) return;
    const confirmation = window.confirm(`Delete delivery shop "${shop.name}"? This cannot be undone.`);
    if (!confirmation) return;
    try {
      await api.admin.deliveryShops.remove(shop.id);
      setShops(prev => prev.filter(item => item.id !== shop.id));
      setTimeout(() => loadShops(), 0);
    } catch (err) {
      console.error('Failed to delete delivery shop', err);
      setError(err.message || 'Could not delete delivery shop');
    }
  }

  const appliedFilterCount = [appliedFilters.q, appliedFilters.active !== '' ? appliedFilters.active : null].filter(Boolean).length;

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Delivery Shops</h1>
        <div className="ms-auto d-flex gap-2">
          <Link className="btn btn-outline-secondary btn-sm" to="/admin/deliveries"><i className="bi bi-truck me-1"></i>Manage Deliveries</Link>
          <button type="button" className="btn btn-success btn-sm" onClick={openCreate}><i className="bi bi-plus-lg me-1"></i>New Shop</button>
        </div>
      </div>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-4">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search by name, city or region"
            value={draftFilters.q}
            onChange={e => updateFilter('q', e.target.value)}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Status" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={draftFilters.active}
            onChange={e => updateFilter('active', e.target.value)}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </FilterBar.Field>
        <FilterBar.Reset onClick={resetFilters} disabled={appliedFilterCount === 0} />
      </FilterBar>
      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
      {loading ? (
        <p>Loading shops…</p>
      ) : shops.length === 0 ? (
        <div className="alert alert-info" role="status">No delivery shops found. Try adjusting your filters or create a new shop.</div>
      ) : (
        <div className="table-responsive small">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Radius</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shops.map(shop => (
                <tr key={shop.id}>
                  <td className="fw-semibold">{shop.name ?? `Shop #${shop.id}`}</td>
                  <td>
                    {[shop.addressLine1, shop.city, shop.region].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <span>{shop.phone || '—'}</span>
                      <span className="text-muted small">{shop.email || ''}</span>
                    </div>
                  </td>
                  <td>{shop.serviceRadiusKm != null ? `${shop.serviceRadiusKm} km` : '—'}</td>
                  <td>
                    {shop.isActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}
                  </td>
                  <td className="text-end text-nowrap" style={{ minWidth: '210px' }}>
                    <button type="button" className="btn btn-outline-primary btn-sm me-1" onClick={() => openEdit(shop)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm me-1" onClick={() => handleToggleActive(shop)}>
                      {shop.isActive ? <><i className="bi bi-eye-slash"></i><span className="ms-1">Deactivate</span></> : <><i className="bi bi-eye"></i><span className="ms-1">Activate</span></>}
                    </button>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(shop)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
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
      <DeliveryShopFormModal
        open={modalOpen}
        shop={editingShop}
        saving={modalSaving}
        error={modalError}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}

function normalizeShop(raw) {
  if (!raw) return raw;
  if (typeof raw === 'object') return raw;
  return raw;
}
