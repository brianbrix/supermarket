import { useEffect, useState, useRef } from 'react';
import { api, mapProductResponse } from '../../services/api.js';
import FilterBar from '../../components/FilterBar.jsx';
import PaginationBar from '../../components/PaginationBar.jsx';

const makeEmptyForm = () => ({ name: '', categoryId: '', price: '', description: '', stock: '0', unit: '' });

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:10, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(makeEmptyForm);
  const [imageFile, setImageFile] = useState(null); // legacy single upload (kept for backward compatibility)
  const [multiUploading, setMultiUploading] = useState(false);
  const [multiError, setMultiError] = useState(null);
  const [search, setSearch] = useState('');
  const [draftFilters, setDraftFilters] = useState({ categoryId:'', minPrice:'', maxPrice:'', inStock:'', sort:'name', direction:'asc' });
  const [appliedFilters, setAppliedFilters] = useState({ categoryId:'', minPrice:'', maxPrice:'', inStock:'', sort:'name', direction:'asc' });
  const debounceRef = useRef();
  const firstDebounceRef = useRef(true); // skip the initial debounce which mirrors defaults
  const didInitialLoadRef = useRef(false); // guard StrictMode double invoke
  const categoriesLoadedRef = useRef(false); // ensure categories list fetched only once
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const resetFormState = () => {
    setForm(makeEmptyForm());
    setImageFile(null);
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
    const { categoryId, minPrice, maxPrice, inStock, sort, direction } = appliedFilters;
    const payload = {
      ...(search? { q: search } : {}),
      ...(categoryId? { categoryId } : {}),
      ...(minPrice? { minPrice } : {}),
      ...(maxPrice? { maxPrice } : {}),
      ...(inStock ? { inStock: inStock === 'true' } : {}),
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
  }, [search, draftFilters.categoryId, draftFilters.minPrice, draftFilters.maxPrice, draftFilters.inStock]);
  function updateAdv(name,value){ setDraftFilters(f=>({...f,[name]:value})); }
  function applySort(e){ const [s,d]=e.target.value.split(':'); setDraftFilters(f=>({...f, sort:s, direction:d })); setAppliedFilters(a=>({...a, sort:s, direction:d })); setPage(0); load(true); }
  function resetFilters(){ const base={ categoryId:'', minPrice:'', maxPrice:'', inStock:'', sort:'name', direction:'asc' }; setDraftFilters(base); setAppliedFilters(base); setSearch(''); setPage(0); load(true); }

  function handleChange(e){
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
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
      categoryId: p.categoryId != null ? String(p.categoryId) : '',
      price: p.price != null ? String(p.price) : '',
      description: p.description || '',
      stock: p.stock != null ? String(p.stock) : '0',
      unit: p.unit || ''
    });
    setImageFile(null);
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
        category_id: categoryId,
        price: priceValue,
        description: form.description,
        image_url: null,
        stock: stockValue,
        unit: form.unit ? form.unit.trim() : null
      };
      let created;
      if (editingId) {
        created = await api.admin.products.update(editingId, payload);
      } else {
        created = await api.admin.products.create(payload);
      }
      if (imageFile) {
        await api.products.uploadImage(created.id, imageFile);
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
    if (!window.confirm('Delete product?')) return;
    try { await api.admin.products.delete(id); load(); } catch(e) { setError(e.message); }
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
    if (!window.confirm('Delete this image?')) return;
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
        <FilterBar.Field label="Category" width="col-6 col-md-2">
          <select className="form-select form-select-sm" value={draftFilters.categoryId} onChange={e=>updateAdv('categoryId', e.target.value)}>
            <option value="">All</option>
            {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <option value="price:asc">Price Low→High</option>
            <option value="price:desc">Price High→Low</option>
            <option value="stock:asc">Stock Low→High</option>
            <option value="stock:desc">Stock High→Low</option>
            <option value="id:asc">ID Asc</option>
            <option value="id:desc">ID Desc</option>
          </select>
        </FilterBar.Field>
  <FilterBar.Reset onClick={resetFilters} disabled={!search && !draftFilters.categoryId && !draftFilters.minPrice && !draftFilters.maxPrice && !draftFilters.inStock && draftFilters.sort==='name' && draftFilters.direction==='asc'} />
      </FilterBar>
      <div className="row">
        <div className="col-12 col-lg-7 mb-4 mb-lg-0">
          {loading ? <p>Loading...</p> : error ? <div className="alert alert-danger">{error}</div> : (
            <div className="table-responsive small">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className={p.stock === 0 ? 'table-warning' : ''}>
                      <td style={{width:'54px'}}>{p.image ? <img src={p.image} alt={p.name} style={{width:'48px', height:'48px', objectFit:'cover'}}/> : <span className="text-muted small">—</span>}</td>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{p.price}</td>
                      <td>{p.stock ?? '-'}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={()=>handleEdit(p)}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(p.id)}>Del</button>
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
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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

