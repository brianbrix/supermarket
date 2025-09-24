import { useMemo, useState, useEffect } from 'react';
import { products } from '../data/products.js';
import { BRAND_NAME } from '../config/brand.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const prices = useMemo(() => products.map(p => p.price), []);
  const minPriceAll = Math.min(...prices);
  const maxPriceAll = Math.max(...prices);
  const [minPrice, setMinPrice] = useState(minPriceAll);
  const [maxPrice, setMaxPrice] = useState(maxPriceAll);

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map(p => p.category)))], []);

  const [loading, setLoading] = useState(true);
  // simulate async fetch
  useEffect(() => {
    const t = setTimeout(()=> setLoading(false), 600); // future: replace with real fetch
    return () => clearTimeout(t);
  }, []);

  const filtered = products.filter(p => {
    const matchesQuery = (p.name + ' ' + p.description).toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    const withinPrice = p.price >= (minPrice || 0) && p.price <= (maxPrice || Infinity);
    return matchesQuery && matchesCategory && withinPrice;
  });

  function resetFilters() {
    setQuery('');
    setCategory('all');
    setMinPrice(minPriceAll);
    setMaxPrice(maxPriceAll);
  }
  const activeFilterCount = (
    (query ? 1 : 0) +
    (category !== 'all' ? 1 : 0) +
    (minPrice !== minPriceAll ? 1 : 0) +
    (maxPrice !== maxPriceAll ? 1 : 0)
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
        <div className="col-6 col-sm-2 col-lg-2">
          <label className="form-label small text-muted" htmlFor="filterCategory">Category</label>
          <select id="filterCategory" className="form-select" value={category} onChange={e=>setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-6 col-sm-2 col-lg-2">
          <label className="form-label small text-muted" htmlFor="filterMin">Min</label>
          <input id="filterMin" type="number" className="form-control" min={minPriceAll} max={maxPrice} value={minPrice} onChange={e=>setMinPrice(Number(e.target.value))} placeholder={minPriceAll} />
        </div>
        <div className="col-6 col-sm-2 col-lg-2">
          <label className="form-label small text-muted" htmlFor="filterMax">Max</label>
          <input id="filterMax" type="number" className="form-control" min={minPrice} max={maxPriceAll} value={maxPrice} onChange={e=>setMaxPrice(Number(e.target.value))} placeholder={maxPriceAll} />
        </div>
        <div className="col-12 col-sm-2 col-lg-2 d-grid">
          <label className="form-label small text-muted d-block">&nbsp;</label>
          <button type="button" onClick={resetFilters} className="btn btn-outline-secondary">Clear</button>
        </div>
      </form>
      )}
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
      ) : filtered.length === 0 ? (
        <p className="text-muted">No products match your search.</p>
      ) : (
        <div className="row g-3">
          {filtered.map(p => (
            <div key={p.id} className="col-6 col-md-4 col-lg-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
