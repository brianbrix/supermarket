import { useCart } from '../context/CartContext.jsx';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';
import { useNavigate, Link } from 'react-router-dom';
import QuantityStepper from '../components/QuantityStepper.jsx';
import CouponBox from '../components/CouponBox.jsx';

export default function Cart() {
  const { items, updateQty, removeItem, clearCart, subtotal, discount, total } = useCart();
  const formatCurrency = useCurrencyFormatter();
  const formatAmount = formatCurrency;
  const navigate = useNavigate();
  if (!items.length) return (
    <section className="container py-4">
      <h1 className="h3 mb-3">Cart</h1>
      <div className="card p-4 border-0 shadow-sm bg-body-secondary-subtle">
        <p className="mb-3">Your cart is empty.</p>
        <Link to="/" className="btn btn-primary btn-sm align-self-start d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i>
          Back to shopping
        </Link>
      </div>
    </section>
  );
  return (
    <section className="container py-4">
      <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-3 mb-3">
        <h1 className="h3 mb-0">Cart</h1>
        <button onClick={clearCart} className="btn btn-outline-danger btn-sm ms-sm-auto" aria-label="Clear all items from cart">Clear cart</button>
      </div>

      <div className="d-none d-md-block">
        <div className="table-responsive rounded-3 shadow-sm">
          <table className="table cart-table align-middle mb-0">
            <thead className="table-light">
              <tr><th scope="col">Item</th><th scope="col" style={{width:'160px'}}>Qty</th><th scope="col">Price</th><th scope="col">Subtotal</th><th scope="col" className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id}>
                  <td className="fw-semibold">
                    {i.name}
                    {i.brand && <div className="text-muted small text-uppercase">{i.brand}</div>}
                  </td>
                  <td>
                    <QuantityStepper size="sm" value={i.qty} onChange={q=>updateQty(i.id, q)} ariaLabel={`Quantity for ${i.name}`} />
                  </td>
                  <td>{formatAmount(i.price)}</td>
                  <td>{formatAmount(i.price * i.qty)}</td>
                  <td className="text-end">
                    <button onClick={() => removeItem(i.id)} className="btn btn-outline-danger btn-sm" aria-label={`Remove ${i.name} from cart`}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="d-md-none d-flex flex-column gap-3" role="list" aria-label="Cart items">
        {items.map(i => (
          <div key={i.id} className="cart-item-card shadow-sm" role="listitem">
            <div className="cart-item-card__header">
              <span className="cart-item-card__name">{i.name}</span>
              <button onClick={() => removeItem(i.id)} className="btn btn-outline-danger btn-sm" aria-label={`Remove ${i.name} from cart`}>
                <i className="bi bi-trash"></i>
              </button>
            </div>
          {i.brand && <div className="text-muted text-uppercase small">{i.brand}</div>}
            <div className="cart-item-card__meta">
              <span>{formatAmount(i.price)}{i.unit ? <span className="text-secondary">/{i.unit}</span> : null}</span>
              <span>In cart: {i.qty}</span>
            </div>
            <div className="cart-item-card__footer">
              <QuantityStepper size="sm" value={i.qty} onChange={q=>updateQty(i.id, q)} ariaLabel={`Quantity for ${i.name}`} />
              <div className="d-flex justify-content-between align-items-center">
                <span className="cart-item-card__price">{formatAmount(i.price * i.qty)}</span>
                <span className="text-muted small">Subtotal</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-4 shadow-sm">
        <div className="card-body d-flex flex-column gap-3">
          <CouponBox compact className="w-100" />
          <div className="border rounded p-3 bg-body-secondary-subtle">
            <div className="d-flex justify-content-between small">
              <span>Subtotal</span>
              <span>{formatAmount(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="d-flex justify-content-between text-success small fw-semibold mt-1">
                <span>Coupon savings</span>
                <span>-{formatAmount(discount)}</span>
              </div>
            )}
            <div className="d-flex justify-content-between fw-semibold mt-2">
              <span>Total</span>
              <span>{formatAmount(total)}</span>
            </div>
            <p className="text-muted small mb-0 mt-1">Taxes included where applicable.</p>
          </div>
          <div className="d-flex flex-column flex-sm-row flex-grow-1 justify-content-end gap-2">
            <button onClick={()=>navigate('/checkout')} className="btn btn-success flex-grow-1" aria-label="Proceed to checkout">Proceed to Checkout</button>
            <Link to="/products" className="btn btn-outline-secondary flex-grow-1">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
