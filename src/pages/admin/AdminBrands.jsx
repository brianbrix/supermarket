import { useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import FilterBar from '../../components/FilterBar.jsx';
import { api } from '../../services/api.js';

const defaultMeta = {
  page: 0,
  size: 20,
  totalPages: 0,
  totalElements: 0,
  first: true,
  last: true
};

const makeEmptyForm = () => ({
  name: '',
  slug: '',
  description: '',
  active: true,
  categoryIds: []
});

const slugify = (value) => {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export default function AdminBrands() {
  const [items, setItems] = useState([]);
  const [pageMeta, setPageMeta] = useState(defaultMeta);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const debounceRef = useRef();
  const selectMenuPortalTarget = typeof document !== 'undefined' ? document.body : undefined;

  useEffect(() => {
    let cancelled = false;
    api.categories.list()
      .then((list) => {
        if (cancelled) return;
        setCategories(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((prev) => prev ?? (err.message ?? 'Failed to load categories'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchApplied(searchDraft.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchDraft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = {
      page,
      size: 20
    };
    if (searchApplied) params.q = searchApplied;
    if (categoryFilter) params.categoryId = categoryFilter;
    if (activeFilter) params.active = activeFilter;

    api.admin.brands.list(params)
      .then((res) => {
        if (cancelled) return;
        const content = res?.content ?? [];
        setItems(content);
        setPageMeta(res ?? defaultMeta);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? 'Failed to load brands');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, searchApplied, categoryFilter, activeFilter, reloadToken]);

  const categoryOptions = useMemo(() => {
    return categories.map((cat) => ({
      value: String(cat.id),
      label: cat.label ?? cat.fullName ?? cat.name ?? `Category ${cat.id}`
    }));
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => {
      const label = cat.label ?? cat.fullName ?? cat.name ?? `Category ${cat.id}`;
      map.set(String(cat.id), label);
    });
    return map;
  }, [categories]);

  const selectedCategoryOptions = useMemo(() => {
    const ids = new Set(form.categoryIds.map(String));
    return categoryOptions.filter((option) => ids.has(option.value));
  }, [form.categoryIds, categoryOptions]);

  function resetForm() {
    setEditingId(null);
    setForm(makeEmptyForm());
    setSlugTouched(false);
  }

  function handleNameChange(value) {
    setForm((prev) => {
      const next = { ...prev, name: value };
      if (!slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  function handleSlugChange(value) {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug: value }));
  }

  function handleDescriptionChange(value) {
    setForm((prev) => ({ ...prev, description: value }));
  }

  function handleActiveChange(value) {
    setForm((prev) => ({ ...prev, active: value }));
  }

  function handleCategoriesChange(selection) {
    const values = Array.isArray(selection) ? selection.map((option) => option.value) : [];
    setForm((prev) => ({ ...prev, categoryIds: values }));
  }

  function handleEdit(brand) {
    setEditingId(brand.id);
    setForm({
      name: brand.name ?? '',
      slug: brand.slug ?? '',
      description: brand.description ?? '',
      active: brand.active !== false,
      categoryIds: Array.isArray(brand.categoryIds) ? brand.categoryIds.map((id) => String(id)) : []
    });
    setSlugTouched(true);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const trimmedName = form.name.trim();
      if (!trimmedName) {
        throw new Error('Brand name is required.');
      }
      const payload = {
        name: trimmedName,
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || null,
        active: form.active,
        categoryIds: form.categoryIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      };
      if (editingId) {
        await api.admin.brands.update(editingId, payload);
      } else {
        await api.admin.brands.create(payload);
      }
      resetForm();
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err.message ?? 'Failed to save brand');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this brand? Products with this brand will lose the association.')) return;
    setError(null);
    try {
      await api.admin.brands.delete(id);
      if (items.length === 1 && page > 0) {
        setPage((prev) => Math.max(0, prev - 1));
      } else {
        setReloadToken((token) => token + 1);
      }
    } catch (err) {
      setError(err.message ?? 'Failed to delete brand');
    }
  }

  const hasFilters = Boolean(searchDraft.trim() || categoryFilter || activeFilter);

  function renderTable() {
    if (loading) {
      return <div className="text-muted small">Loading brands…</div>;
    }
    if (!items.length) {
      return <div className="text-muted small">No brands found. Create one using the form.</div>;
    }
    return (
      <div className="table-responsive small">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Name</th>
              <th style={{ width: 140 }}>Slug</th>
              <th style={{ width: '30%' }}>Categories</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((brand) => {
              const categoryLabels = (brand.categoryIds ?? [])
                .map((id) => categoryNameMap.get(String(id)) ?? `ID ${id}`);
              return (
                <tr key={brand.id}>
                  <td>{brand.id}</td>
                  <td>
                    <strong>{brand.name}</strong>
                    <div className="text-muted small">
                      Created {brand.createdAt ? new Date(brand.createdAt).toLocaleDateString() : '—'}
                    </div>
                    {brand.description && (
                      <div className="text-muted small mt-1" style={{ maxWidth: 280 }}>
                        {brand.description}
                      </div>
                    )}
                  </td>
                  <td><code>{brand.slug || '—'}</code></td>
                  <td>
                    {categoryLabels.length ? (
                      <div className="d-flex flex-wrap gap-1">
                        {categoryLabels.map((label) => (
                          <span key={label} className="badge text-bg-light border">{label}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted small">No categories</span>
                    )}
                  </td>
                  <td>
                    {brand.active ? (
                      <span className="badge text-bg-success">Active</span>
                    ) : (
                      <span className="badge text-bg-secondary">Inactive</span>
                    )}
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleEdit(brand)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(brand.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <BrandPagination meta={pageMeta} onChange={setPage} />
      </div>
    );
  }

  return (
    <div className="p-3 vstack gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">Brands</h2>
        <button className="btn btn-sm btn-primary" onClick={resetForm}>New Brand</button>
      </div>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-4">
          <div className="input-group input-group-sm">
            <span className="input-group-text">Q</span>
            <input
              className="form-control"
              placeholder="Name or slug"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            {searchDraft && (
              <button className="btn btn-outline-secondary" type="button" onClick={() => setSearchDraft('')}>
                ×
              </button>
            )}
          </div>
        </FilterBar.Field>
        <FilterBar.Field label="Category" width="col-6 col-md-3">
          <select
            className="form-select form-select-sm"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Status" width="col-6 col-md-2">
          <select
            className="form-select form-select-sm"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </FilterBar.Field>
        <FilterBar.Reset
          onClick={() => {
            setSearchDraft('');
            setCategoryFilter('');
            setActiveFilter('');
            setPage(0);
          }}
          disabled={!hasFilters}
        />
      </FilterBar>
      {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
      <div className="row g-3">
        <div className="col-12 col-lg-7">{renderTable()}</div>
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-body">
              <h3 className="h6 mb-3">{editingId ? 'Edit Brand' : 'New Brand'}</h3>
              <form className="vstack gap-2" onSubmit={handleSubmit}>
                <div>
                  <label className="form-label small text-muted">Name</label>
                  <input
                    required
                    className="form-control"
                    placeholder="e.g. Everfresh Organics"
                    value={form.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label small text-muted">Slug</label>
                  <input
                    className="form-control"
                    placeholder="Auto-generated from name"
                    value={form.slug}
                    onChange={(event) => handleSlugChange(event.target.value)}
                  />
                  <div className="form-text small">Lowercase with hyphens. Leave blank to auto-generate.</div>
                </div>
                <div>
                  <label className="form-label small text-muted">Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Optional. Internal note about the brand."
                    value={form.description}
                    onChange={(event) => handleDescriptionChange(event.target.value)}
                  ></textarea>
                </div>
                <div>
                  <label className="form-label small text-muted">Categories</label>
                  <Select
                    isMulti
                    isClearable
                    menuPortalTarget={selectMenuPortalTarget}
                    classNamePrefix="brand-category-select"
                    options={categoryOptions}
                    value={selectedCategoryOptions}
                    onChange={handleCategoriesChange}
                    placeholder={categoryOptions.length ? 'Search categories…' : 'Loading categories…'}
                    isDisabled={!categoryOptions.length}
                  />
                  <div className="form-text small">Select all categories this brand should appear under in the storefront.</div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="brand-active-switch"
                    checked={form.active}
                    onChange={(event) => handleActiveChange(event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="brand-active-switch">Brand is active</label>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success flex-grow-1" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save Brand'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
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

function BrandPagination({ meta, onChange }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mt-2">
      <button
        className="btn btn-sm btn-outline-secondary"
        disabled={meta.first}
        onClick={() => onChange(meta.page - 1)}
      >
        Prev
      </button>
      <span className="small">
        Page {meta.page + 1} / {meta.totalPages}
      </span>
      <button
        className="btn btn-sm btn-outline-secondary"
        disabled={meta.last}
        onClick={() => onChange(meta.page + 1)}
      >
        Next
      </button>
    </div>
  );
}