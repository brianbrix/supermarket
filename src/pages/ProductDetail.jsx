import { useParams, useNavigate, Link } from 'react-router-dom';
import { products } from '../data/products.js';
import { formatKES } from '../utils/currency.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useState, useMemo } from 'react';
import QuantityStepper from '../components/QuantityStepper.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const product = products.find(p => String(p.id) === id);
  const { addItem } = useCart();
  const { push } = useToast();
  const [qty, setQty] = useState(1);
  const subtotal = useMemo(()=> qty * (product?.price || 0), [qty, product]);

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
          <div className="border rounded p-4 text-center bg-body">
            <div style={{fontSize:'4rem'}} aria-hidden>🧺</div>
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
