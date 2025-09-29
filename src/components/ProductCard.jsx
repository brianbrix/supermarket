import { useCurrencyFormatter } from '../context/SettingsContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import ImageWithFallback from './ImageWithFallback.jsx';
import RatingStars from './RatingStars.jsx';

export default function ProductCard({ product, compact = false }) {
  const formatCurrency = useCurrencyFormatter();
  const { addItem } = useCart();
  const { push } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  function handleAdd() {
    if (product.stock === 0) {
      push(`${product.name} is out of stock`);
      return;
    }
    const added = addItem(product);
    if (added.added) {
      push(`${product.name} added to cart`);
    } else if (added.reason === 'max-stock') {
      push(`Maximum stock reached for ${product.name}`);
    }
    const params = new URLSearchParams(location.search);
    if (params.get('returnTo') === 'checkout') {
      navigate('/checkout');
    }
  }
  return (
    <div className={`product-card card h-100 position-relative${compact ? ' product-card--compact' : ''}`}>
      {product.stock === 0 && <span className="badge text-bg-danger position-absolute top-0 end-0 m-2">Out</span>}
      {product.stock > 0 && product.stock <= 3 && <span className="badge text-bg-warning position-absolute top-0 end-0 m-2">{product.stock} left</span>}
      <Link to={`/product/${product.id}`} className="text-decoration-none text-reset">
        <div className="card-body pb-2">
          <div className="text-center mb-2" style={{fontSize:'2.5rem'}}>
            <ImageWithFallback src={product.image} alt={product.name} />
          </div>
          {product.brand && <p className="text-uppercase text-success small mb-1 fw-semibold">{product.brand}</p>}
          {Number(product.ratingCount) > 0 && (
            <div className="mb-2">
              <RatingStars value={product.ratingAverage} count={product.ratingCount} size="sm" showCount readOnly />
            </div>
          )}
          <h3 className={`h6 mb-1 product-card__title${compact ? ' product-card__title--compact' : ''}`}>{product.name}</h3>
          <p className="text-muted small mb-2 product-card__description">{product.description}</p>
        </div>
      </Link>
      <div className={`px-3 pb-3 mt-auto${compact ? ' pt-0' : ''}`}>
        <p className="fw-semibold mb-2">{formatCurrency(product.price)} <span className="text-secondary small">/{product.unit}</span></p>
        <button onClick={handleAdd} className="btn btn-success w-100 btn-sm" disabled={product.stock === 0}>Add</button>
      </div>
    </div>
  );
}
