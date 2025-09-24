import { useParams, useNavigate, Link } from 'react-router-dom';
// import { products } from '../data/products.js'; // replaced by API
import { api, mapProductResponse } from '../services/api.js';
import { formatKES } from '../utils/currency.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useState, useMemo, useEffect } from 'react';
import QuantityStepper from '../components/QuantityStepper.jsx';
import ImageWithFallback from '../components/ImageWithFallback.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(()=>{
    let active=true;
    api.products.get(id)
      .then(p => { if(!active) return; setProduct(mapProductResponse(p)); setLoading(false); })
      .catch(e => { if(!active) return; setError(e.message); setLoading(false); });
    return ()=>{ active=false; };
  },[id]);
  const { addItem } = useCart();
  const { push } = useToast();
  const [qty, setQty] = useState(1);
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
      <div className="row g-4">
        <div className="col-12 col-md-5">
          <div className="border rounded p-3 bg-body">
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
          <p className="fs-5 fw-semibold">{formatKES(product.price)} <span className="text-secondary">/{product.unit}</span></p>
          <div className="d-flex gap-3 flex-wrap align-items-end">
            <div>
              <label className="form-label small mb-1">Quantity</label>
              <QuantityStepper value={qty} onChange={setQty} ariaLabel="Quantity" />
              <div className="form-text">Subtotal: {formatKES(subtotal)}</div>
            </div>
            <button className="btn btn-success" onClick={addAndGo}>Add to Cart</button>
            <button className="btn btn-outline-primary" onClick={()=>navigate('/cart')}>Go to Cart</button>
            <button className="btn btn-outline-secondary" onClick={()=>navigate(-1)}>Back</button>
          </div>
        </div>
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
