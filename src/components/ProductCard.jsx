import { formatKES } from '../utils/currency.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLocation, useNavigate, Link } from 'react-router-dom';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { push } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  function handleAdd() {
    addItem(product);
    push(`${product.name} added to cart`);
    const params = new URLSearchParams(location.search);
    if (params.get('returnTo') === 'checkout') {
      navigate('/checkout');
    }
  }
  return (
    <div className="card h-100">
      <Link to={`/product/${product.id}`} className="text-decoration-none text-reset">
        <div className="card-body pb-2">
          <div className="text-center mb-2" style={{fontSize:'2.5rem'}} aria-hidden>{product.image ? <img src={product.image} alt={product.name} style={{maxWidth:'100%', height:'auto'}}/> : <span role="img" aria-label="basket">🧺</span>}</div>
          <h3 className="h6 mb-1">{product.name}</h3>
          <p className="text-muted small mb-2">{product.description}</p>
        </div>
      </Link>
      <div className="px-3 pb-3 mt-auto">
        <p className="fw-semibold mb-2">{formatKES(product.price)} <span className="text-secondary small">/{product.unit}</span></p>
        <button onClick={handleAdd} className="btn btn-success w-100 btn-sm">Add</button>
      </div>
    </div>
  );
}
