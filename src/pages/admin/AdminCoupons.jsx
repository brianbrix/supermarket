import { useEffect, useMemo, useState } from 'react';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { api } from '../../services/api.js';
import { formatCurrency } from '../../utils/currency.js';
import { useToast } from '../../context/ToastContext.jsx';

const defaultPageMeta = {
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 1,
  first: true,
  last: true
};

const makeEmptyForm = () => ({
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  usageLimit: '',
  usageLimitPerUser: '',
  startsAt: '',
  endsAt: '',
  isActive: true
});

function toDateTimeLocal(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - tzOffset * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function fromDateTimeLocal(localValue) {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function describeDiscount(coupon) {
  if (!coupon) return '';
  if (coupon.discountType === 'FIXED') {
    return `${formatCurrency(coupon.discountValue)} off`;
  }
  let suffix = '';
  if (coupon.maxDiscountAmount != null) {
    suffix = ` (max ${formatCurrency(coupon.maxDiscountAmount)})`;
  }
  return `${coupon.discountValue}% off${suffix}`;
}

function computeLifecycle(coupon) {
  if (!coupon) return 'UNKNOWN';
  const now = Date.now();
  const startsAt = coupon.startsAt ? new Date(coupon.startsAt).getTime() : null;
  const endsAt = coupon.endsAt ? new Date(coupon.endsAt).getTime() : null;
  if (!coupon.isActive) return 'INACTIVE';
  if (startsAt && startsAt > now) return 'UPCOMING';
  if (endsAt && endsAt < now) return 'EXPIRED';
  if (coupon.usageLimit != null && coupon.timesRedeemed >= coupon.usageLimit) return 'EXHAUSTED';
  return 'ACTIVE';
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [pageMeta, setPageMeta] = useState(defaultPageMeta);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftSearch, setDraftSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  const toast = useToast();

  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(draftSearch.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(handle);
  }, [draftSearch]);

  useEffect(() => {
    setAppliedStatus(statusFilter);
    setPage(0);
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.admin.coupons.list({
      page,
      size,
      search: appliedSearch || undefined,
      status: appliedStatus || undefined,
      sort: 'created_at',
      direction: 'desc'
    })
      .then(response => {
        if (cancelled) return;
        const rawContent = Array.isArray(response?.content)
          ? response.content
          : Array.isArray(response)
            ? response
            : [];
        const mapped = rawContent.map(item => ({
          ...item,
          lifecycle: computeLifecycle(item)
        }));
        setCoupons(mapped);
        const pageValue = Number(response?.page);
        const sizeValue = Number(response?.size);
        const totalElementsValue = Number(response?.totalElements);
        const totalPagesValue = Number(response?.totalPages);
        const meta = {
          page: Number.isFinite(pageValue) ? pageValue : page,
          size: Number.isFinite(sizeValue) ? sizeValue : size,
          totalElements: Number.isFinite(totalElementsValue) ? totalElementsValue : mapped.length,
          totalPages: Number.isFinite(totalPagesValue)
            ? totalPagesValue
            : Math.max(1, Math.ceil(mapped.length / ((Number.isFinite(sizeValue) ? sizeValue : size) || 1))),
          first: typeof response?.first === 'boolean' ? response.first : page <= 0,
          last: typeof response?.last === 'boolean'
            ? response.last
            : (Number.isFinite(totalPagesValue) ? page >= totalPagesValue - 1 : true)
        };
        setPageMeta(meta);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load coupons.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, size, appliedSearch, appliedStatus, reloadTick]);

  const derivedCoupons = useMemo(() => coupons.map(c => ({ ...c, lifecycle: computeLifecycle(c) })), [coupons]);

  function resetFormState() {
    setForm(makeEmptyForm());
    setFormError(null);
    setEditingId(null);
  }

  function beginCreateFlow() {
    resetFormState();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function handleEdit(coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code || '',
      name: coupon.name || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'PERCENT',
      discountValue: coupon.discountValue != null ? String(coupon.discountValue) : '',
      maxDiscountAmount: coupon.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : '',
      minOrderAmount: coupon.minOrderAmount != null ? String(coupon.minOrderAmount) : '',
      usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      usageLimitPerUser: coupon.usageLimitPerUser != null ? String(coupon.usageLimitPerUser) : '',
      startsAt: toDateTimeLocal(coupon.startsAt),
      endsAt: toDateTimeLocal(coupon.endsAt),
      isActive: Boolean(coupon.isActive)
    });
    setFormError(null);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function resetFilters() {
    setDraftSearch('');
    setStatusFilter('');
    setAppliedSearch('');
    setAppliedStatus('');
    setPage(0);
  }

  async function handleToggleActive(coupon) {
    setActioningId(coupon.id);
    try {
      if (coupon.isActive) {
        await api.admin.coupons.deactivate(coupon.id);
        await import('../../utils/swal.js').then(m => m.success(`Coupon ${coupon.code} deactivated`));
      } else {
        await api.admin.coupons.activate(coupon.id);
        await import('../../utils/swal.js').then(m => m.success(`Coupon ${coupon.code} activated`));
      }
      setReloadTick(t => t + 1);
    } catch (err) {
      toast.push(err?.message || 'Unable to update coupon status.', 'error');
    } finally {
      setActioningId(null);
    }
  }

  async function handleDelete(coupon) {
  const ok = await import('../../utils/swal.js').then(m => m.confirm({ title: `Delete coupon ${coupon.code}?`, text: 'This cannot be undone.', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }));
  if (!ok) return;
    setActioningId(coupon.id);
    try {
      await api.admin.coupons.delete(coupon.id);
      await import('../../utils/swal.js').then(m => m.success(`Coupon ${coupon.code} deleted`));
      if (editingId === coupon.id) {
        resetFormState();
      }
      setReloadTick(t => t + 1);
    } catch (err) {
      toast.push(err?.message || 'Failed to delete coupon.', 'error');
    } finally {
      setActioningId(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const trimmedCode = form.code.trim().toUpperCase();
      const trimmedName = form.name.trim();
      if (!trimmedCode) throw new Error('Coupon code is required.');
      if (!trimmedName) throw new Error('Coupon name is required.');
      const discountValueNum = Number(form.discountValue);
      if (!Number.isFinite(discountValueNum) || discountValueNum <= 0) {
        throw new Error('Discount value must be a positive number.');
      }
      if (form.discountType === 'PERCENT' && discountValueNum > 100) {
        throw new Error('Percentage discount cannot exceed 100%.');
      }
      const payload = {
        code: trimmedCode,
        name: trimmedName,
        description: form.description?.trim() || null,
        discount_type: form.discountType,
        discount_value: discountValueNum,
        max_discount_amount: form.maxDiscountAmount !== '' ? Number(form.maxDiscountAmount) : null,
        min_order_amount: form.minOrderAmount !== '' ? Number(form.minOrderAmount) : 0,
        usage_limit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
        usage_limit_per_user: form.usageLimitPerUser !== '' ? Number(form.usageLimitPerUser) : null,
        is_active: Boolean(form.isActive),
        starts_at: form.startsAt ? fromDateTimeLocal(form.startsAt) : null,
        ends_at: form.endsAt ? fromDateTimeLocal(form.endsAt) : null
      };
      if (payload.max_discount_amount != null && !Number.isFinite(payload.max_discount_amount)) {
        throw new Error('Max discount must be a valid number.');
      }
      if (payload.min_order_amount != null && !Number.isFinite(payload.min_order_amount)) {
        throw new Error('Minimum order amount must be a valid number.');
      }
      if (payload.usage_limit != null && (!Number.isInteger(payload.usage_limit) || payload.usage_limit < 0)) {
        throw new Error('Usage limit must be zero or a positive integer.');
      }
      if (payload.usage_limit_per_user != null && (!Number.isInteger(payload.usage_limit_per_user) || payload.usage_limit_per_user < 0)) {
        throw new Error('Usage limit per user must be zero or a positive integer.');
      }
      if (payload.ends_at && payload.starts_at && new Date(payload.ends_at) < new Date(payload.starts_at)) {
        throw new Error('End date cannot be before start date.');
      }

      if (editingId) {
        await api.admin.coupons.update(editingId, payload);
        await import('../../utils/swal.js').then(m => m.success('Coupon updated successfully.'));
      } else {
        await api.admin.coupons.create(payload);
        await import('../../utils/swal.js').then(m => m.success('Coupon created successfully.'));
      }
      resetFormState();
      setReloadTick(t => t + 1);
    } catch (err) {
      setFormError(err?.message || 'Failed to save coupon.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 m-0">Admin: Coupons</h1>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setReloadTick(t => t + 1)}>Refresh</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={beginCreateFlow}>New Coupon</button>
        </div>
      </div>

      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-4">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search code or name"
            value={draftSearch}
            onChange={e => setDraftSearch(e.target.value)}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Status" width="col-6 col-md-2">
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterBar.Field>
        <FilterBar.Reset
          onClick={resetFilters}
          disabled={!draftSearch && !statusFilter}
        />
      </FilterBar>

      <div className="row">
        <div className="col-12 col-xl-7 mb-4 mb-xl-0">
          {loading ? (
            <p className="text-muted">Loading coupons…</p>
          ) : error ? (
            <div className="alert alert-danger" role="alert">{error}</div>
          ) : derivedCoupons.length === 0 ? (
            <div className="alert alert-info" role="status">No coupons found.</div>
          ) : (
            <div className="table-responsive small">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Discount</th>
                    <th>Min Order</th>
                    <th>Usage</th>
                    <th>Starts</th>
                    <th>Ends</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {derivedCoupons.map(coupon => (
                    <tr key={coupon.id} className={coupon.lifecycle === 'EXPIRED' || coupon.lifecycle === 'INACTIVE' ? 'table-light' : ''}>
                      <td className="fw-semibold">{coupon.code}</td>
                      <td>{coupon.name}</td>
                      <td>{describeDiscount(coupon)}</td>
                      <td>{coupon.minOrderAmount ? formatCurrency(coupon.minOrderAmount) : '—'}</td>
                      <td>
                        <span className="d-block">{coupon.timesRedeemed ?? 0} used</span>
                        {coupon.usageLimit != null && (
                          <span className="text-muted small">Limit {coupon.usageLimit}</span>
                        )}
                      </td>
                      <td>{formatDateTime(coupon.startsAt)}</td>
                      <td>{formatDateTime(coupon.endsAt)}</td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <StatusBadge status={coupon.lifecycle} />
                          {!coupon.isActive && <span className="badge text-bg-secondary">Inactive</span>}
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm" role="group">
                          <button type="button" className="btn btn-outline-primary" onClick={() => handleEdit(coupon)}>Edit</button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            disabled={actioningId === coupon.id}
                            onClick={() => handleToggleActive(coupon)}
                          >
                            {actioningId === coupon.id ? '…' : coupon.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            disabled={actioningId === coupon.id}
                            onClick={() => handleDelete(coupon)}
                          >
                            {actioningId === coupon.id ? '...' : 'Delete'}
                          </button>
                        </div>
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
                sizes={[10, 20, 50]}
                onPageSizeChange={newSize => {
                  setSize(newSize);
                  setPage(0);
                }}
              />
            </div>
          )}
        </div>

        <div className="col-12 col-xl-5">
          <div className="card">
            <div className="card-body">
              <h2 className="h6 mb-3">{editingId ? 'Edit Coupon' : 'Create Coupon'}</h2>
              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
              <form className="vstack gap-3" onSubmit={handleSubmit}>
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-code" className="form-label">Code</label>
                    <input
                      id="coupon-code"
                      name="code"
                      value={form.code}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder="SUMMER10"
                      required
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-name" className="form-label">Name</label>
                    <input
                      id="coupon-name"
                      name="name"
                      value={form.name}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder="Summer promo"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="coupon-description" className="form-label">Description</label>
                  <textarea
                    id="coupon-description"
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    className="form-control"
                    rows={2}
                    placeholder="Optional note for admins"
                  ></textarea>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-type" className="form-label">Discount Type</label>
                    <select
                      id="coupon-type"
                      name="discountType"
                      value={form.discountType}
                      onChange={handleFormChange}
                      className="form-select"
                    >
                      <option value="PERCENT">Percent</option>
                      <option value="FIXED">Fixed Amount</option>
                    </select>
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-value" className="form-label">Value</label>
                    <input
                      id="coupon-value"
                      name="discountValue"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.discountValue}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder={form.discountType === 'PERCENT' ? '10' : '500'}
                      required
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-max" className="form-label">Max Discount</label>
                    <input
                      id="coupon-max"
                      name="maxDiscountAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.maxDiscountAmount}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder="Optional"
                    />
                    <small className="text-muted">Required for some percent discounts.</small>
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-min" className="form-label">Min Order Amount</label>
                    <input
                      id="coupon-min"
                      name="minOrderAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.minOrderAmount}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-usage" className="form-label">Usage Limit</label>
                    <input
                      id="coupon-usage"
                      name="usageLimit"
                      type="number"
                      min="0"
                      step="1"
                      value={form.usageLimit}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-user-limit" className="form-label">Per User Limit</label>
                    <input
                      id="coupon-user-limit"
                      name="usageLimitPerUser"
                      type="number"
                      min="0"
                      step="1"
                      value={form.usageLimitPerUser}
                      onChange={handleFormChange}
                      className="form-control"
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-start" className="form-label">Starts At</label>
                    <input
                      id="coupon-start"
                      name="startsAt"
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={handleFormChange}
                      className="form-control"
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="coupon-end" className="form-label">Ends At</label>
                    <input
                      id="coupon-end"
                      name="endsAt"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={handleFormChange}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="coupon-active"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleFormChange}
                  />
                  <label className="form-check-label" htmlFor="coupon-active">Coupon is active</label>
                </div>

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save Coupon'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary" onClick={resetFormState} disabled={submitting}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
