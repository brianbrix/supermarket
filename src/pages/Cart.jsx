import { useCart } from '../context/CartContext.jsx';
import { formatKES } from '../utils/currency.js';
import { useNavigate, Link } from 'react-router-dom';
import QuantityStepper from '../components/QuantityStepper.jsx';

export default function Cart() {
  const { items, updateQty, removeItem, clearCart, total } = useCart();
  const navigate = useNavigate();
  if (!items.length) return (
    <section className="py-4">
      <h1 className="h3 mb-3">Cart</h1>
      <div className="card p-4 border-0 bg-body-secondary-subtle">
        <p className="mb-3">Your cart is empty.</p>
        <Link to="/" className="btn btn-primary btn-sm align-self-start d-inline-flex align-items-center gap-1">
          <i className="bi bi-arrow-left"></i>
          Back to shopping
        </Link>
      </div>
    </section>
  );
  return (
    <section>
      <h1>Cart</h1>
      <table className="cart-table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td style={{minWidth:'120px'}}>
                <QuantityStepper size="sm" value={i.qty} onChange={(q)=>updateQty(i.id, q)} ariaLabel={`Quantity for ${i.name}`} />
              </td>
              <td>{formatKES(i.price)}</td>
              <td>{formatKES(i.price * i.qty)}</td>
              <td><button onClick={() => removeItem(i.id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">Total: {formatKES(total)}</p>
      <div className="d-flex gap-2 flex-wrap mt-3">
        <button onClick={()=>navigate('/checkout')} className="btn btn-success">Proceed to Checkout</button>
        <button onClick={clearCart} className="btn btn-outline-danger">Clear Cart</button>
      </div>
    </section>
  );
}
