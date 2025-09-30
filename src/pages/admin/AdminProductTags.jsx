import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';

const slugify = (value) => {
  if (value == null) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const defaultMeta = { page: 0, size: 20, totalPages: 0, totalElements: 0, first: true, last: true };

export default function AdminProductTags() {
  const [items, setItems] = useState([]);
  const [pageMeta, setPageMeta] = useState(defaultMeta);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const debounceRef = useRef();

  useEffect(() => {
    load();
  }, [page, searchApplied]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchApplied(searchDraft);
      setPage(0);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchDraft]);

  function load() {
    setLoading(true);
    setError(null);
    api.admin.productTags.list({ page, size: 20, q: searchApplied })
      .then((res) => {
        const content = res?.content ?? [];
        setItems(content);
        setPageMeta(res ?? defaultMeta);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? 'Failed to load tags');
        setLoading(false);
      });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: '', slug: '', description: '' });
    setSlugTouched(false);
  }

  function handleNameChange(value) {
    setForm((prev) => {
      const next = { ...prev, name: value };
      if (!slugTouched) {
        const generated = slugify(value);
        if (generated && generated !== prev.slug) {
          next.slug = generated;
        }
        if (!generated) {
          next.slug = '';
        }
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

  function handleEdit(tag) {
    setEditingId(tag.id);
    setForm({
      name: tag.name ?? '',
      slug: tag.slug ?? '',
      description: tag.description ?? ''
    });
    setSlugTouched(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug?.trim() || form.name,
        description: form.description?.trim() || null
      };
      if (!payload.name) {
        throw new Error('Name is required.');
      }
      if (editingId) {
        await api.admin.productTags.update(editingId, payload);
      } else {
        await api.admin.productTags.create(payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message ?? 'Failed to save tag');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
  const ok = await import('../../utils/swal.js').then(m => m.confirm({ title: 'Delete tag?', text: 'Products will simply lose this tag. Continue?', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }));
  if (!ok) return;
    setError(null);
    try {
      await api.admin.productTags.delete(id);
      if (items.length === 1 && page > 0) {
        setPage((prev) => Math.max(0, prev - 1));
      } else {
        load();
      }
    } catch (err) {
      setError(err.message ?? 'Failed to delete tag');
    }
  }

  function renderTable() {
    if (loading) return <div className="text-muted small">Loading tags…</div>;
    if (!items.length) {
      return <div className="text-muted small">No tags found. Create your first one using the form.</div>;
    }
    return (
      <div className="table-responsive small">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>Name</th>
              <th style={{ width: 160 }}>Slug</th>
              <th style={{ width: '30%' }}>Description</th>
              <th style={{ width: 110 }}>Products</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((tag) => (
              <tr key={tag.id}>
                <td>{tag.id}</td>
                <td>
                  <strong>{tag.name}</strong>
                  {tag.createdAt && (
                    <div className="text-muted small">Created {new Date(tag.createdAt).toLocaleDateString()}</div>
                  )}
                </td>
                <td><code>{tag.slug}</code></td>
                <td className="text-muted" style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tag.description || '—'}
                </td>
                <td>{tag.productCount ?? 0}</td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleEdit(tag)}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(tag.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TagPagination meta={pageMeta} onChange={setPage} />
      </div>
    );
  }

  return (
    <div className="p-3 vstack gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">Product Tags</h2>
        <button className="btn btn-sm btn-primary" onClick={resetForm}>New Tag</button>
      </div>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-4">
          <div className="input-group input-group-sm">
            <span className="input-group-text">Q</span>
            <input className="form-control" placeholder="Name, slug, or description" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
            {searchDraft && (
              <button className="btn btn-outline-secondary" type="button" onClick={() => setSearchDraft('')}>
                ×
              </button>
            )}
          </div>
        </FilterBar.Field>
      </FilterBar>
      {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
      <div className="row g-3">
        <div className="col-12 col-lg-7">{renderTable()}</div>
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-body">
              <h3 className="h6 mb-3">{editingId ? 'Edit Tag' : 'New Tag'}</h3>
              <form className="vstack gap-2" onSubmit={handleSubmit}>
                <div>
                  <label className="form-label small text-muted">Name</label>
                  <input required className="form-control" placeholder="e.g. Trending" value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
                </div>
                <div>
                  <label className="form-label small text-muted">Slug</label>
                  <input className="form-control" placeholder="Auto-generated from name" value={form.slug} onChange={(e) => handleSlugChange(e.target.value)} />
                  <div className="form-text small">Lowercase with hyphens preferred. Leave blank to auto-generate.</div>
                </div>
                <div>
                  <label className="form-label small text-muted">Description</label>
                  <textarea className="form-control" rows={3} placeholder="Optional. Shown internally to explain the tag." value={form.description} onChange={(e) => handleDescriptionChange(e.target.value)}></textarea>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success flex-grow-1" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save Tag'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
              <p className="text-muted small mt-3 mb-0">
                Tags help curate promotional shelves and scoped product searches. Add descriptive text so the merchandising team knows when to use each tag.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagPagination({ meta, onChange }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="d-flex justify-content-between align-items-center mt-2">
      <button className="btn btn-sm btn-outline-secondary" disabled={meta.first} onClick={() => onChange(meta.page - 1)}>
        Prev
      </button>
      <span className="small">
        Page {meta.page + 1} / {meta.totalPages}
      </span>
      <button className="btn btn-sm btn-outline-secondary" disabled={meta.last} onClick={() => onChange(meta.page + 1)}>
        Next
      </button>
    </div>
  );
}
