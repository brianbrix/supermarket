import { useParams, useNavigate, Link } from 'react-router-dom';
// import { products } from '../data/products.js'; // replaced by API
import { api, mapProductResponse } from '../services/api.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useState, useMemo, useEffect } from 'react';
import QuantityStepper from '../components/QuantityStepper.jsx';
import ImageWithFallback from '../components/ImageWithFallback.jsx';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(null);
  useEffect(()=>{
    let active=true;
    api.products.get(id)
      .then(p => { if(!active) return; setProduct(mapProductResponse(p)); setLoading(false); })
      .catch(e => { if(!active) return; setError(e.message); setLoading(false); });
    return ()=>{ active=false; };
  },[id]);
  useEffect(() => {
    if (!product?.id) {
      setRelatedProducts([]);
      setRelatedLoading(false);
      setRelatedError(null);
      return;
    }
    let active = true;
    setRelatedLoading(true);
    setRelatedError(null);
    api.products.related(product.id, { limit: 6 })
      .then(res => {
        if (!active) return;
        const rawList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const mapped = rawList.map(mapProductResponse).filter(p => p.id !== product.id);
        setRelatedProducts(mapped);
        setRelatedLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setRelatedError(err.message);
        setRelatedLoading(false);
      });
    return () => { active = false; };
  }, [product?.id]);
  const { addItem } = useCart();
  const { push } = useToast();
  const [qty, setQty] = useState(1);
  const formatCurrency = useCurrencyFormatter();
  const subtotal = useMemo(()=> qty * (product?.price || 0), [qty, product]);

  if (loading) return <section className="container py-4"><p>Loading product...</p></section>;
  if (error) return <section className="container py-4"><p className="text-danger">{error}</p><button className="btn btn-secondary" onClick={()=>navigate(-1)}>Back</button></section>;
  if (!product) return <section className="container py-4"><p>Product not found.</p><button className="btn btn-secondary" onClick={()=>navigate(-1)}>Back</button></section>;

  function addAndGo() {
    addItem(product, qty);
    push(`${product.name} x${qty} added to cart`);
  }

  return (
    <section className="container py-4">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/products">Products</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{product.name}</li>
        </ol>
      </nav>
      <div className="row g-4 align-items-start">
        <div className="col-12 col-md-5">
          <div className="border rounded p-3 bg-body h-100">
            {product.images && product.images.length > 1 ? <ImageCarousel product={product} /> : (
              <div className="text-center">
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  style={{width:'100%', maxHeight: 360, objectFit:'contain'}}
                  className="mx-auto"
                  placeholder={<span style={{fontSize:'4rem'}}>🧺</span>}
                />
              </div>
            )}
          </div>
        </div>
        <div className="col-12 col-md-7">
          <h1 className="h3 mb-2">{product.name}</h1>
          <p className="text-muted small mb-3">{product.description}</p>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <p className="fs-5 fw-semibold mb-0">{formatCurrency(product.price)}{product.unit ? <span className="text-secondary">/{product.unit}</span> : null}</p>
            {product.stock !== undefined && (
              <span className={`badge ${product.stock > 0 ? 'text-bg-success' : 'text-bg-danger'}`}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            )}
          </div>
          <div className="d-flex flex-column flex-sm-row gap-3 align-items-stretch align-items-sm-end">
            <div className="flex-grow-1">
              <label className="form-label small mb-1">Quantity</label>
              <QuantityStepper value={qty} onChange={setQty} ariaLabel="Quantity" />
              <div className="form-text">Subtotal: {formatCurrency(subtotal)}</div>
            </div>
            <div className="d-flex flex-column gap-2 flex-sm-row flex-sm-wrap">
              <button className="btn btn-success w-100" onClick={addAndGo} disabled={product.stock === 0}>Add to Cart</button>
              <button className="btn btn-outline-primary w-100" onClick={()=>navigate('/cart')}>Go to Cart</button>
              <button className="btn btn-outline-secondary w-100" onClick={()=>navigate(-1)}>Back</button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <h2 className="h5 mb-3">You might also like</h2>
        {relatedLoading ? (
          <p className="text-muted">Loading related products…</p>
        ) : relatedError ? (
          <p className="text-danger small">{relatedError}</p>
        ) : relatedProducts.length === 0 ? (
          <p className="text-muted">No related products to show right now.</p>
        ) : (
          <div className="row g-3">
            {relatedProducts.map(rp => (
              <div key={rp.id} className="col-12 col-sm-6 col-lg-3">
                <ProductCard product={rp} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ImageCarousel({ product }) {
  const [idx, setIdx] = useState(0);
  const images = product.images || [];
  const maxH = 360;
  function prev(){ setIdx(i => (i === 0 ? images.length - 1 : i - 1)); }
  function next(){ setIdx(i => (i === images.length - 1 ? 0 : i + 1)); }
  return (
    <div>
      <div className="position-relative text-center mb-2">
        <ImageWithFallback
          src={images[idx]}
          alt={product.name}
          style={{width:'100%', maxHeight: maxH, objectFit:'contain'}}
          className="mx-auto"
          placeholder={<span style={{fontSize:'4rem'}}>🧺</span>}
        />
        {images.length > 1 && (
          <>
            <button type="button" className="btn btn-sm btn-light position-absolute top-50 start-0 translate-middle-y" onClick={prev} aria-label="Previous image">‹</button>
            <button type="button" className="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y" onClick={next} aria-label="Next image">›</button>
            <div className="position-absolute bottom-0 start-50 translate-middle-x d-flex gap-1 mb-1">
              {images.map((_, i) => (
                <button key={i} type="button" aria-label={`Go to image ${i+1}`} onClick={()=>setIdx(i)} className={"p-0 border-0 bg-transparent"}>
                  <span style={{display:'block', width:8, height:8, borderRadius:'50%', background: i===idx ? 'var(--bs-success)' : 'rgba(0,0,0,.3)'}}></span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          {images.map((img,i)=>(
            <button key={i} type="button" onClick={()=>setIdx(i)} className={`border rounded p-1 bg-white ${i===idx? 'border-success':''}`} style={{width:64,height:64}} aria-label={`Select image ${i+1}`}>
              <img src={img} alt="thumb" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
