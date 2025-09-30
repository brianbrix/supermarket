import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Typeahead } from 'react-bootstrap-typeahead';
import { api, mapProductResponse } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const makeEmptyForm = () => ({ name: '', brandId: '', brandName: '', categoryId: '', price: '', description: '', stock: '0', unit: '', tagSlugs: [] });

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:10, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
  const [pendingImages, setPendingImages] = useState([]);
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const [multiUploading, setMultiUploading] = useState(false);
  const [multiError, setMultiError] = useState(null);
  const [search, setSearch] = useState('');
  const [draftFilters, setDraftFilters] = useState({ brand:'', categoryId:'', minPrice:'', maxPrice:'', inStock:'', sort:'name', direction:'asc', includeArchived: false });
  const [appliedFilters, setAppliedFilters] = useState({ brand:'', categoryId:'', minPrice:'', maxPrice:'', inStock:'', sort:'name', direction:'asc', includeArchived: false });
  const debounceRef = useRef();
  const firstDebounceRef = useRef(true); // skip the initial debounce which mirrors defaults
  const didInitialLoadRef = useRef(false); // guard StrictMode double invoke
  const categoriesLoadedRef = useRef(false); // ensure categories list fetched only once
  const [categories, setCategories] = useState([]);
  const brandCacheRef = useRef(new Map());
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const tagsLoadedRef = useRef(false); // ensure tags fetched only once
  const [tags, setTags] = useState([]);
  const brandOptionsMemo = useMemo(() => {
    return [...brands]
      .map(brand => ({
        value: String(brand.id),
        label: brand.name ?? brand.slug ?? `Brand ${brand.id}`,
        description: brand.description ?? '',
        active: brand.active !== false
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [brands]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();
  const tagOptionsMemo = useMemo(() => {
    return [...tags]
      .map(tag => ({
        value: tag.slug,
        label: tag.name || tag.slug,
        description: tag.description ?? ''
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tags]);

  const selectedBrandOption = useMemo(() => {
    if (form.brandId) {
      return brandOptionsMemo.find(option => option.value === form.brandId)
        ?? (form.brandName ? { value: form.brandId, label: form.brandName, customOption: true } : null);
    }
    if (form.brandName) {
      return { value: form.brandName, label: form.brandName, customOption: true };
    }
    return null;
  }, [form.brandId, form.brandName, brandOptionsMemo]);

  const brandSelectOptions = useMemo(() => {
    if (!selectedBrandOption) return brandOptionsMemo;
    const exists = brandOptionsMemo.some(option => option.value === selectedBrandOption.value);
    return exists ? brandOptionsMemo : [...brandOptionsMemo, selectedBrandOption];
  }, [brandOptionsMemo, selectedBrandOption]);

  const tagSelectOptions = useMemo(() => {
    if (!Array.isArray(form.tagSlugs) || form.tagSlugs.length === 0) {
      return tagOptionsMemo;
    }
    const slugs = new Set(form.tagSlugs.map(String));
    const missing = Array.from(slugs)
      .filter(slug => !tagOptionsMemo.some(option => option.value === slug))
      .map(slug => ({ value: slug, label: `${slug} (inactive)`, customOption: true }));
    if (missing.length === 0) {
      return tagOptionsMemo;
    }
    return [...tagOptionsMemo, ...missing];
  }, [form.tagSlugs, tagOptionsMemo]);

  const selectedTagOptions = useMemo(() => {
    if (!Array.isArray(form.tagSlugs)) return [];
    const slugs = new Set(form.tagSlugs.map(String));
    return tagSelectOptions.filter(option => slugs.has(option.value));
  }, [form.tagSlugs, tagSelectOptions]);

  const brandSelected = selectedBrandOption ? [selectedBrandOption] : [];

  useEffect(() => () => {
    pendingPreviews.forEach(url => URL.revokeObjectURL(url));
  }, [pendingPreviews]);
  const resetFormState = () => {
    setForm(makeEmptyForm());
    clearPendingImages();
    setMultiError(null);
    setError(null);
  };
  const beginCreateFlow = () => {
    setEditingId(null);
    resetFormState();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  function load(immediate=false) {
    if(!immediate) setLoading(true);
    const { brand, categoryId, minPrice, maxPrice, inStock, sort, direction } = appliedFilters;
    const normalizedBrand = brand?.trim() || '';
    const payload = {
      ...(search? { q: search } : {}),
      ...(normalizedBrand? { brand: normalizedBrand } : {}),
      ...(categoryId? { categoryId } : {}),
      ...(minPrice? { minPrice } : {}),
      ...(maxPrice? { maxPrice } : {}),
      ...(inStock ? { inStock: inStock === 'true' } : {}),
      // If includeArchived is false, ask admin API for active products only
      ...(appliedFilters.includeArchived ? {} : { active: true }),
      sort, direction
    };
  api.admin.products.list(page, size, payload)
      .then(pageResp => {
        const content = (pageResp.content || pageResp).map(mapProductResponse);
        setProducts(content);
        setPageMeta(pageResp);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }
  // Fetch categories once (ignore StrictMode double mount)
  useEffect(() => {
    if (categoriesLoadedRef.current) return; // already fetched
    categoriesLoadedRef.current = true;
    api.categories.list()
      .then(cats => setCategories(cats))
      .catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    const categoryId = form.categoryId ? String(form.categoryId) : '';
    if (!categoryId) {
      setBrands([]);
      setBrandsLoading(false);
      return;
    }
    const cacheKey = categoryId;
    const cached = brandCacheRef.current.get(cacheKey);
    if (cached) {
      setBrands(cached);
      setBrandsLoading(false);
      return;
    }
    let cancelled = false;
    setBrandsLoading(true);
    api.admin.brands.list({ page: 0, size: 200, categoryId, active: 'true' })
      .then(res => {
        if (cancelled) return;
        const list = Array.isArray(res?.content) ? res.content : (Array.isArray(res) ? res : []);
        brandCacheRef.current.set(cacheKey, list);
        setBrands(list);
      })
      .catch(e => {
        if (cancelled) return;
        setError(prev => prev ?? e.message);
        setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setBrandsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.categoryId]);
  useEffect(() => {
    if (tagsLoadedRef.current) return;
    tagsLoadedRef.current = true;
    api.admin.productTags.list({ page: 0, size: 200 })
      .then(res => setTags(res?.content ?? res ?? []))
      .catch(e => setError(prev => prev ?? e.message));
  }, []);
  // Load products when page or applied filters change, guard first StrictMode double invoke
  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      load();
      return;
    }
    load();
  }, [page, size, appliedFilters]);
  // Debounce draft -> applied (skip first render because values already identical)
  useEffect(() => {
    if (firstDebounceRef.current) { firstDebounceRef.current = false; return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(()=>{ setAppliedFilters(p=>({ ...p, ...draftFilters })); setPage(0); }, 400);
    return ()=>clearTimeout(debounceRef.current);
  }, [search, draftFilters.brand, draftFilters.categoryId, draftFilters.minPrice, draftFilters.maxPrice, draftFilters.inStock, draftFilters.includeArchived]);
  function updateAdv(name,value){ setDraftFilters(f=>({...f,[name]:value})); }
  function applySort(e){ const [s,d]=e.target.value.split(':'); setDraftFilters(f=>({...f, sort:s, direction:d })); setAppliedFilters(a=>({...a, sort:s, direction:d })); setPage(0); load(true); }
  function resetFilters(){ const base={ brand:'', categoryId:'', minPrice:'', maxPrice:'', inStock:'', sort:'name', direction:'asc', includeArchived: false }; setDraftFilters(base); setAppliedFilters(base); setSearch(''); setPage(0); load(true); }

  function handleChange(e){
    const { name, value } = e.target;
    if (name === 'categoryId') {
      setForm(f => ({ ...f, categoryId: value, brandId: '', brandName: '' }));
      return;
    }
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleBrandSelect(selection) {
    const option = Array.isArray(selection) ? selection[0] : selection;
    if (!option) {
      setForm(f => ({ ...f, brandId: '', brandName: '' }));
      return;
    }
    if (option.customOption) {
      const label = (option.label ?? option.value ?? '').trim();
      setForm(f => ({ ...f, brandId: '', brandName: label }));
      return;
    }
    setForm(f => ({ ...f, brandId: option.value, brandName: option.label }));
  }

  function handleTagSelect(selected) {
    const values = Array.isArray(selected) ? selected.map(option => option.value) : [];
    setForm(f => ({ ...f, tagSlugs: values }));
  }

  function handleCancel(){
    setEditingId(null);
    resetFormState();
  }

  function handleEdit(p) {
    setEditingId(p.id);
    setError(null);
    setMultiError(null);
    setForm({
      name: p.name || '',
      brandId: p.brandId != null ? String(p.brandId) : '',
      brandName: p.brandName || p.brand || '',
      categoryId: p.categoryId != null ? String(p.categoryId) : '',
      price: p.price != null ? String(p.price) : '',
      description: p.description || '',
      stock: p.stock != null ? String(p.stock) : '0',
      unit: p.unit || '',
      tagSlugs: Array.isArray(p.tagSlugs)
        ? p.tagSlugs.map(String)
        : (Array.isArray(p.tags) ? p.tags.map(tag => tag?.slug).filter(Boolean).map(String) : [])
    });
    clearPendingImages();
  }

  function syncPendingPreviews(nextFiles) {
    setPendingPreviews(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return nextFiles.map(file => URL.createObjectURL(file));
    });
  }

  function handlePendingFiles(fileList) {
    const incoming = Array.from(fileList ?? []).filter(Boolean);
    if (incoming.length === 0) return;
    setPendingImages(prev => {
      const combined = [...prev, ...incoming].slice(0, 5);
      syncPendingPreviews(combined);
      return combined;
    });
  }

  function removePendingImage(index) {
    setPendingImages(prev => {
      const next = prev.filter((_, i) => i !== index);
      syncPendingPreviews(next);
      return next;
    });
  }

  function clearPendingImages() {
    syncPendingPreviews([]);
    setPendingImages([]);
  }

  async function handleSubmit(e){
    e.preventDefault();
    setSubmitting(true);
  setError(null);
    try {
      const trimmedName = form.name.trim();
      const categoryId = form.categoryId ? Number(form.categoryId) : null;
      const priceValue = Number(form.price);
      const stockValue = form.stock === '' ? 0 : Number(form.stock);
      const brandIdValue = form.brandId ? Number(form.brandId) : null;
      const brandNameValue = form.brandName ? form.brandName.trim() : '';
      if (!trimmedName) {
        throw new Error('Product name is required.');
      }
      if (Number.isNaN(priceValue)) {
        throw new Error('Price must be a valid number.');
      }
      if (Number.isNaN(stockValue)) {
        throw new Error('Stock must be a valid number.');
      }
      const payload = {
        name: trimmedName,
        brandId: Number.isFinite(brandIdValue) ? brandIdValue : null,
        brand_id: Number.isFinite(brandIdValue) ? brandIdValue : null,
        brandName: brandNameValue || null,
        brand: brandNameValue || null,
        category_id: categoryId,
        price: priceValue,
        description: form.description,
        image_url: null,
        stock: stockValue,
        unit: form.unit ? form.unit.trim() : null,
        tagSlugs: Array.isArray(form.tagSlugs)
          ? form.tagSlugs.map(slug => String(slug).trim()).filter(Boolean)
          : []
      };
      let created;
      if (editingId) {
        created = await api.admin.products.update(editingId, payload);
      } else {
        created = await api.admin.products.create(payload);
      }
      if (pendingImages.length > 0) {
        await api.products.uploadImages(created.id, pendingImages);
        clearPendingImages();
      }
      setEditingId(null);
      resetFormState();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id){
    // Explain that deletion will archive product if it exists in orders
  const confirmed = await import('../../utils/swal.js').then(m => m.confirm({ title: 'Delete product?', text: 'If this product appears in existing orders it will be archived (kept for order history) instead of permanently removed. Continue?', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }));
    if (!confirmed) return;
    try {
      const resp = await api.admin.products.delete(id);
      // API returns { deleted: true, archived: true } when archived
      if (resp?.archived) {
        try { toast.push('Product archived and kept for order history', 'info'); } catch(e){}
      } else if (resp?.deleted) {
        try { toast.push('Product deleted', 'info'); } catch(e){}
      }
      load();
    } catch(e) { setError(e.message); }
  }

  async function handleUnarchive(id){
  const confirmed = await import('../../utils/swal.js').then(m => m.confirm({ title: 'Unarchive product?', text: 'Unarchive this product and make it visible in the storefront again?', confirmButtonText: 'Unarchive', cancelButtonText: 'Cancel' }));
    if (!confirmed) return;
    try {
      // Patch product to set active = true
      await api.admin.products.update(id, { active: true });
      try { toast.push('Product restored (unarchived)', 'info'); } catch(e){}
      load();
    } catch(e) { setError(e.message); }
  }

  async function handleMultiUpload(fileList) {
    if (!editingId) return;
  setMultiError(null);
    const prod = products.find(p=>p.id===editingId);
    const existingCount = prod?.images?.length || 0;
    const allowed = Math.max(0, 5 - existingCount);
    const toSend = Array.from(fileList).slice(0, allowed);
    if (toSend.length === 0) {
      setMultiError('Image limit reached (5).');
      return;
    }
    setMultiUploading(true);
    try {
      await api.products.uploadImages(editingId, toSend);
      load();
    } catch (e) {
      setMultiError(e.message);
    } finally {
      setMultiUploading(false);
    }
  }

  async function handleDeleteImage(imageId) {
    if (!editingId || imageId == null) return;
  const keep = await import('../../utils/swal.js').then(m => m.confirm({ title: 'Delete image?', text: 'Delete this image?', confirmButtonText: 'Delete', cancelButtonText: 'Cancel' }));
  if (!keep) return;
    try {
      await api.products.deleteImage(editingId, imageId);
      load();
    } catch (e) {
      setMultiError(e.message);
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 m-0">Admin: Products</h1>
        <div className="d-flex gap-2">
          <a href="/admin" className="btn btn-outline-secondary btn-sm">View Stats</a>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={beginCreateFlow}
          >New Product</button>
        </div>
      </div>
      <FilterBar>
        <FilterBar.Field label="Search" width="col-12 col-md-3">
          <input type="search" className="form-control form-control-sm" placeholder="Name or description" value={search} onChange={e=>setSearch(e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Brand" width="col-6 col-md-2">
          <input type="text" className="form-control form-control-sm" placeholder="e.g. Procter" value={draftFilters.brand} onChange={e=>updateAdv('brand', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Category" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={draftFilters.categoryId} onChange={e=>updateAdv('categoryId', e.target.value)}>
            <option value="">All</option>
            {categories.map(c=> <option key={c.id} value={c.id}>{c.label ?? c.fullName ?? c.name}</option>)}
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Min" width="col-6 col-md-1">
          <input type="number" className="form-control form-control-sm" value={draftFilters.minPrice} onChange={e=>updateAdv('minPrice', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Max" width="col-6 col-md-1">
          <input type="number" className="form-control form-control-sm" value={draftFilters.maxPrice} onChange={e=>updateAdv('maxPrice', e.target.value)} />
        </FilterBar.Field>
        <FilterBar.Field label="Stock" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={draftFilters.inStock} onChange={e=>updateAdv('inStock', e.target.value)}>
            <option value="">All</option>
            <option value="true">In Stock</option>
            <option value="false">Out of Stock</option>
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Sort" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={`${draftFilters.sort}:${draftFilters.direction}`} onChange={applySort}>
            <option value="name:asc">Name A→Z</option>
            <option value="name:desc">Name Z→A</option>
            <option value="brand:asc">Brand A→Z</option>
            <option value="brand:desc">Brand Z→A</option>
            <option value="price:asc">Price Low→High</option>
            <option value="price:desc">Price High→Low</option>
            <option value="stock:asc">Stock Low→High</option>
            <option value="stock:desc">Stock High→Low</option>
            <option value="id:asc">ID Asc</option>
            <option value="id:desc">ID Desc</option>
          </select>
        </FilterBar.Field>
        <FilterBar.Field label="Archived" width="col-6 col-md-2">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="showArchived" checked={!!draftFilters.includeArchived} onChange={e=>updateAdv('includeArchived', e.target.checked)} />
            <label className="form-check-label small" htmlFor="showArchived">Show archived</label>
          </div>
        </FilterBar.Field>
  <FilterBar.Reset onClick={resetFilters} disabled={!search && !draftFilters.brand.trim() && !draftFilters.categoryId && !draftFilters.minPrice && !draftFilters.maxPrice && !draftFilters.inStock && draftFilters.sort==='name' && draftFilters.direction==='asc'} />
      </FilterBar>
      <div className="row">
        <div className="col-12 col-lg-7 mb-4 mb-lg-0">
          {loading ? <p>Loading...</p> : error ? <div className="alert alert-danger">{error}</div> : (
            <div className="table-responsive small">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Image</th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className={`${p.stock === 0 ? 'table-warning' : ''} ${!p.active ? 'table-secondary text-muted' : ''}`.trim()}>
                      <td style={{width:'54px'}}>{p.image ? <img src={p.image} alt={p.name} style={{width:'48px', height:'48px', objectFit:'cover'}}/> : <span className="text-muted small">—</span>}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div>{p.name}</div>
                          {!p.active && (
                            <span className="badge bg-warning text-dark ms-2 small" title="Archived">Archived</span>
                          )}
                        </div>
                        {Array.isArray(p.tags) && p.tags.length > 0 && (
                          <div className="text-muted small mt-1">
                            Tags: {p.tags.map(tag => tag?.name || tag?.slug).filter(Boolean).join(', ')}
                          </div>
                        )}
                      </td>
                      <td>{p.brand ? p.brand : <span className="text-muted small">—</span>}</td>
                      <td>{p.category}</td>
                      <td>{p.price}</td>
                      <td>{p.stock ?? '-'}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={()=>handleEdit(p)}>Edit</button>
                        {!p.active ? (
                          <>
                            <button className="btn btn-sm btn-outline-success me-2" onClick={()=>handleUnarchive(p.id)}>Unarchive</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(p.id)}>Del</button>
                          </>
                        ) : (
                          <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(p.id)}>Del</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar {...pageMeta} size={size} onPageChange={setPage} alwaysVisible sizes={[10,20,50,100]} onPageSizeChange={(newSize)=>{ setSize(newSize); setPage(0); }} />
            </div>
          )}
        </div>
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-body">
              <h2 className="h6 mb-3">{editingId ? 'Edit Product' : 'Create Product'}</h2>
              <form onSubmit={handleSubmit} className="vstack gap-3">
                <div>
                  <label htmlFor="product-name" className="form-label">Name</label>
                  <input id="product-name" required name="name" value={form.name} onChange={handleChange} className="form-control" placeholder="Name" />
                </div>
                <div>
                  <label htmlFor="product-category" className="form-label">Category</label>
                  <select id="product-category" name="categoryId" value={form.categoryId} onChange={handleChange} className="form-select">
                    <option value="">No Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label ?? c.fullName ?? c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="product-brand" className="form-label d-flex justify-content-between align-items-center">
                    <span>Brand</span>
                    <Link to="/admin/brands" className="small">Manage brands</Link>
                  </label>
                  <Typeahead
                    id="product-brand"
                    labelKey="label"
                    clearButton
                    highlightOnlyResult
                    options={brandSelectOptions}
                    selected={brandSelected}
                    onChange={handleBrandSelect}
                    placeholder={!form.categoryId ? 'Select a category first' : (brandsLoading ? 'Loading brands…' : (brandSelectOptions.length ? 'Select a brand…' : 'No brands for this category'))}
                    emptyLabel={!form.categoryId ? 'Select a category first' : (brandsLoading ? 'Loading brands…' : (brandSelectOptions.length ? 'No matching brand' : 'No brands for this category'))}
                    isLoading={!!form.categoryId && brandsLoading}
                    disabled={!form.categoryId || (brandsLoading && brandSelectOptions.length === 0)}
                    renderMenuItemChildren={(option) => (
                      <div className="d-flex flex-column">
                        <span>{option.label}</span>
                        {option.description && <small className="text-muted">{option.description}</small>}
                      </div>
                    )}
                  />
                  <div className="form-text small">Brands are filtered by the selected category.</div>
                </div>
                <div>
                  <label htmlFor="product-tags" className="form-label d-flex justify-content-between align-items-center">
                    <span>Tags</span>
                    <Link to="/admin/product-tags" className="small">Manage tags</Link>
                  </label>
                  <Typeahead
                    id="product-tags"
                    labelKey="label"
                    multiple
                    clearButton
                    options={tagSelectOptions}
                    selected={selectedTagOptions}
                    onChange={handleTagSelect}
                    placeholder={tags.length === 0 ? 'Create tags to start tagging products' : 'Search and select tags…'}
                    emptyLabel={tagSelectOptions.length ? 'No matching tag' : 'Create tags to start tagging products'}
                    disabled={tagSelectOptions.length === 0}
                    renderMenuItemChildren={(option) => (
                      <div className="d-flex flex-column">
                        <span>{option.label}</span>
                        {option.description && <small className="text-muted">{option.description}</small>}
                      </div>
                    )}
                  />
                  <div className="form-text small">Type to search, press Enter to add, and use backspace to remove a tag.</div>
                </div>
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="product-price" className="form-label">Price</label>
                    <input id="product-price" required type="number" min="0" step="0.01" name="price" value={form.price} onChange={handleChange} className="form-control" placeholder="0.00" />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="product-unit" className="form-label">Unit</label>
                    <input id="product-unit" name="unit" value={form.unit} onChange={handleChange} className="form-control" placeholder="e.g. kg, pc" />
                  </div>
                </div>
                <div>
                  <label htmlFor="product-description" className="form-label">Description</label>
                  <textarea id="product-description" name="description" value={form.description} onChange={handleChange} className="form-control" placeholder="Short description" rows={2}></textarea>
                </div>
                <div>
                  <label htmlFor="product-stock" className="form-label">Stock</label>
                  <input id="product-stock" type="number" min="0" name="stock" value={form.stock} onChange={handleChange} className="form-control" placeholder="0" />
                </div>
                {!editingId && (
                  <div className="mt-3 border rounded p-2">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong className="small mb-0">Images</strong>
                      <span className="badge text-bg-secondary">{pendingImages.length}/5</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="form-control form-control-sm mb-2"
                      onChange={(event) => {
                        handlePendingFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                    {pendingPreviews.length > 0 ? (
                      <div className="d-flex flex-wrap gap-2">
                        {pendingPreviews.map((url, idx) => (
                          <div key={url} className="position-relative" style={{ width: 72, height: 72 }}>
                            <img src={url} alt={`pending-${idx}`} style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: 4, border: '1px solid #ccc' }} />
                            <button
                              type="button"
                              className="btn btn-sm btn-danger position-absolute top-0 end-0 translate-middle p-0"
                              style={{ width: 20, height: 20, fontSize: 10, lineHeight: '10px' }}
                              aria-label="Remove image"
                              onClick={() => removePendingImage(idx)}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">Select up to five images to upload immediately after the product is created.</p>
                    )}
                  </div>
                )}
                {editingId && (
                  <div className="mt-3 border rounded p-2">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong className="small mb-0">Images</strong>
                      {(() => {
                        const prod = products.find(pr=>pr.id===editingId);
                        const count = prod?.images?.length || 0;
                        return <span className="badge text-bg-secondary">{count}/5</span>;
                      })()}
                    </div>
                    {multiError && <div className="alert alert-danger py-1 small mb-2">{multiError}</div>}
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {(products.find(p=>p.id===editingId)?.imageObjects || []).map((im,i)=> (
                        <div key={im.id ?? `legacy-${i}`} className="position-relative" style={{width:72,height:72}}>
                          <img src={im.absoluteUrl} alt="prod" style={{objectFit:'cover', width:'100%', height:'100%', borderRadius:4, border:'1px solid #ccc'}} />
                          {im.id != null && (
                            <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0 translate-middle p-0" style={{width:20,height:20,fontSize:10,lineHeight:'10px'}} aria-label="Delete image" onClick={()=>handleDeleteImage(im.id)}>&times;</button>
                          )}
                        </div>
                      ))}
                      { (products.find(p=>p.id===editingId)?.imageObjects?.length || 0) === 0 && <span className="text-muted small">No images</span> }
                    </div>
                    <MultiImageUploader
                      disabled={multiUploading || (products.find(p=>p.id===editingId)?.imageObjects?.length || 0) >= 5}
                      onUpload={handleMultiUpload}
                      uploading={multiUploading}
                    />
                  </div>
                )}
                <div className="d-flex gap-2">
                  <button disabled={submitting} type="submit" className="btn btn-primary flex-grow-1">{submitting ? 'Saving...' : 'Save'}</button>
                  {editingId && <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiImageUploader({ disabled, onUpload, uploading }) {
  return (
    <div className="vstack gap-1">
      <input type="file" multiple accept="image/*" disabled={disabled || uploading} className="form-control form-control-sm" onChange={e=>{
        const files = e.target.files;
        if (!files || files.length===0) return;
        onUpload(files);
        e.target.value='';
      }} />
      <small className="text-muted">Add up to 5 images. They will appear in product detail carousel.</small>
    </div>
  );
}

