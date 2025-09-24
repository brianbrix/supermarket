import { useMemo, useState, useEffect, useRef } from 'react';
import { api, mapProductResponse } from '../services/api.js';
import { BRAND_NAME } from '../config/brand.js';
import ProductCard from '../components/ProductCard.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import PaginationBar from '../components/PaginationBar.jsx';

export default function Home() {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page:0, size:20, totalElements:0, totalPages:0, first:true, last:true });
  const [page, setPage] = useState(0);
  const size = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [sliderBounds, setSliderBounds] = useState({ min: 0, max: 0 });
  // Track when the initial baseline (categories + first page) has finished loading
  const [baselineLoaded, setBaselineLoaded] = useState(false);

  // Initial load for categories & baseline products
  useEffect(() => {
    let active = true;
    Promise.all([api.categories.list(), api.products.list(page, size)])
      .then(([cats, pageResp]) => {
        if (!active) return;
        const catOptions = cats.map(c => ({ id: c.id, name: c.name }));
        setCategories(catOptions);
        const mapped = pageResp.content.map(mapProductResponse);
        setResults(mapped);
        setPageMeta(pageResp);
        const prices = mapped.map(p => p.price);
        const min = prices.length ? Math.min(...prices) : 0;
        const max = prices.length ? Math.max(...prices) : 0;
        // Set bounds & range before enabling search effect
        setSliderBounds({ min, max });
        setPriceRange({ min, max });
        // Always skip the first search; we've just loaded the baseline list
        initialSearchSkippedRef.current = true;
        lastSearchKeyRef.current = JSON.stringify({
          q: '', cat: 'all', min, max, stock: 0, page: 0
        });
        setBaselineLoaded(true);
        setLoading(false);
      })
      .catch(e => { if (!active) return; setError(e.message); setLoading(false); });
    return () => { active = false; };
  }, []);

  // Debounced search params
  const debouncedQuery = useDebounce(query, 500);
  const debouncedRange = useDebounce(priceRange, 400);
  const debouncedInStock = useDebounce(inStockOnly, 300);
  const debouncedCategory = useDebounce(categoryId, 300);

  // Prevent double fetch + flicker: run search only after initial baseline load AND when filters actually change.
  const initialSearchSkippedRef = useRef(false);
  const lastSearchKeyRef = useRef('');
  useEffect(() => {
    if (!baselineLoaded) return; // don't run until baseline data present

    // Treat a debounced range of 0/0 (while sliderBounds already known) as uninitialized; use slider bounds for identity key
    const rangeUninitialized = debouncedRange.min === 0 && debouncedRange.max === 0 && (sliderBounds.min !== 0 || sliderBounds.max !== 0);
    const effectiveMin = rangeUninitialized ? sliderBounds.min : debouncedRange.min;
    const effectiveMax = rangeUninitialized ? sliderBounds.max : debouncedRange.max;

    const filtersKey = JSON.stringify({
      q: debouncedQuery || '',
      cat: debouncedCategory,
      min: effectiveMin,
      max: effectiveMax,
      stock: debouncedInStock ? 1 : 0,
      page
    });

    if (filtersKey === lastSearchKeyRef.current) return; // no change

    // If we haven't yet skipped initial search, verify initial empty state (defensive).
    if (!initialSearchSkippedRef.current) {
      const noFiltersApplied = !debouncedQuery && debouncedCategory === 'all' && !debouncedInStock && page === 0 &&
        effectiveMin === sliderBounds.min && effectiveMax === sliderBounds.max;
      if (noFiltersApplied) {
        initialSearchSkippedRef.current = true;
        lastSearchKeyRef.current = filtersKey;
        return;
      }
    }

    lastSearchKeyRef.current = filtersKey;
    setLoading(true);
    const payload = {
      page,
      size
    };
    if (debouncedQuery) payload.q = debouncedQuery;
    if (debouncedCategory !== 'all') payload.categoryId = debouncedCategory;
    // Only include range if user changed it (i.e., differs from slider bounds and not in uninitialized state)
    if (!rangeUninitialized && (effectiveMin !== sliderBounds.min || effectiveMax !== sliderBounds.max)) {
      payload.minPrice = effectiveMin;
      payload.maxPrice = effectiveMax;
    }
    if (debouncedInStock) payload.inStock = true;

    api.products.search(payload)
      .then(pageResp => {
        const mapped = pageResp.content.map(mapProductResponse);
        setResults(mapped);
        setPageMeta(pageResp);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [debouncedQuery, debouncedCategory, debouncedRange.min, debouncedRange.max, debouncedInStock, page, baselineLoaded, size, sliderBounds.min, sliderBounds.max]);

  // Reset to first page whenever filters fundamentally change (excluding page itself)
  useEffect(() => { setPage(0); }, [debouncedQuery, debouncedCategory, debouncedRange.min, debouncedRange.max, debouncedInStock]);

  function handlePriceChange(r) { setPriceRange(r); }

  function resetFilters() {
    setQuery('');
    setCategoryId('all');
    setInStockOnly(false);
    setPriceRange({ ...sliderBounds });
  }
  const activeFilterCount = (
    (query ? 1 : 0) +
    (categoryId !== 'all' ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (priceRange.min !== sliderBounds.min ? 1 : 0) +
    (priceRange.max !== sliderBounds.max ? 1 : 0)
  );
  const [showFilters, setShowFilters] = useState(true);
  useEffect(()=> { if (window.innerWidth < 576) setShowFilters(false); }, []);

  return (
    <section className="container-fluid py-3 px-3 px-sm-4">
      <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center gap-3 mb-3">
        <div className="flex-grow-1">
          <h1 className="h3 mb-1">Karibu {BRAND_NAME} 👋</h1>
          <p className="text-muted mb-2">Browse fresh produce, daily staples and more.</p>
        </div>
      </div>
      <div className="mb-2 d-flex align-items-center gap-2 flex-wrap">
        <h2 className="h6 m-0">Filter Products</h2>
        <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={()=>setShowFilters(s=>!s)} aria-expanded={showFilters} aria-controls="filtersPanel">
          <i className={`bi ${showFilters ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
          <span className="d-sm-none">{showFilters ? 'Hide' : 'Show'}</span>
          <span className="d-none d-sm-inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          {activeFilterCount > 0 && <span className="badge text-bg-success ms-1">{activeFilterCount}</span>}
        </button>
        <button type="button" className="btn btn-link p-0 small" onClick={resetFilters}>Reset</button>
      </div>
      {showFilters && (
      <form id="filtersPanel" className="row g-2 mb-4" onSubmit={e=>e.preventDefault()} aria-label="Product filters">
        <div className="col-12 col-sm-4 col-lg-3">
          <label className="form-label small text-muted" htmlFor="filterSearch">Search</label>
          <input id="filterSearch" type="search" className="form-control" placeholder="e.g. unga" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
        <div className="col-6 col-sm-3 col-lg-2">
          <label className="form-label small text-muted" htmlFor="filterCategory">Category</label>
          <select id="filterCategory" className="form-select" value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
            <option value="all">All</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-12 col-sm-5 col-lg-4">
          <label className="form-label small text-muted d-block" htmlFor="priceMinInput">Price Range</label>
          <div className="d-flex gap-2 align-items-start">
            <div className="flex-grow-1">
              <input
                id="priceMinInput"
                type="number"
                className="form-control form-control-sm"
                min={sliderBounds.min}
                max={priceRange.max}
                value={priceRange.min}
                onChange={e=>handlePriceChange({ min: Number(e.target.value), max: priceRange.max })}
                aria-label="Minimum price"
                placeholder="Min"
              />
            </div>
            <span className="small mt-1">–</span>
            <div className="flex-grow-1">
              <input
                id="priceMaxInput"
                type="number"
                className="form-control form-control-sm"
                min={priceRange.min}
                max={sliderBounds.max}
                value={priceRange.max}
                onChange={e=>handlePriceChange({ min: priceRange.min, max: Number(e.target.value) })}
                aria-label="Maximum price"
                placeholder="Max"
              />
            </div>
          </div>
    
        </div>
        <div className="col-6 col-sm-2 col-lg-2">
          <label className="form-label small text-muted d-block" htmlFor="inStockToggle">In stock only</label>
          <div className="form-check m-0">
            <input className="form-check-input" type="checkbox" id="inStockToggle" checked={inStockOnly} onChange={e=>setInStockOnly(e.target.checked)} />
          </div>
        </div>
        <div className="col-6 col-sm-2 col-lg-2 d-grid">
          <label className="form-label small text-muted d-block">&nbsp;</label>
          <button type="button" onClick={resetFilters} className="btn btn-outline-secondary">Clear</button>
        </div>
      </form>
      )}
  {error && <div className="alert alert-danger" role="alert">{error}</div>}
  {loading ? (
        <div className="row g-3">
          {Array.from({length:8}).map((_,i)=>(
            <div key={i} className="col-6 col-md-4 col-lg-3">
              <div className="card h-100 p-3">
                <div className="placeholder-glow mb-2 text-center" style={{fontSize:'2.5rem'}}>
                  <span className="placeholder col-6" style={{height:'2.5rem'}}></span>
                </div>
                <p className="placeholder-glow mb-2">
                  <span className="placeholder col-8"></span>
                </p>
                <p className="placeholder-glow mb-2 small">
                  <span className="placeholder col-10"></span>
                  <span className="placeholder col-7"></span>
                </p>
                <div className="mt-auto placeholder-glow">
                  <span className="placeholder col-5"></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-muted">No products match your search.</p>
      ) : (
        <div className="row g-3">
          {results.map(p => (
            <div key={p.id} className="col-6 col-md-4 col-lg-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
      <PaginationBar {...pageMeta} onPageChange={setPage} />
    </section>
  );
}
