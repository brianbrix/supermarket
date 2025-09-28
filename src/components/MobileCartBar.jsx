import { useCart } from '../context/CartContext.jsx';
import { useLocation, Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useCurrencyFormatter } from '../context/SettingsContext.jsx';

// Sticky bar visible on small screens showing subtotal and quick actions
export default function MobileCartBar(){
  const { total, subtotal, discount, count } = useCart();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 576);
  const formatCurrency = useCurrencyFormatter();

  const totalDisplay = useMemo(() => formatCurrency(total), [total, formatCurrency]);
  const discountDisplay = useMemo(() => discount > 0 ? formatCurrency(discount) : null, [discount, formatCurrency]);
  const subtotalDisplay = useMemo(() => formatCurrency(subtotal), [subtotal, formatCurrency]);

  useEffect(()=>{
    function handleResize(){ setIsMobile(window.innerWidth < 576); }
    window.addEventListener('resize', handleResize);
    return ()=> window.removeEventListener('resize', handleResize);
  }, []);

  // Hide on routes where it's redundant or disruptive
  if (!isMobile || count === 0) return null;
  if (['/cart', '/checkout'].includes(location.pathname)) return null;

  return (
    <div className="mobile-cart-bar shadow rounded-top-4 border-top position-fixed bottom-0 start-50 translate-middle-x bg-body d-flex align-items-center gap-3 px-3 py-2" style={{zIndex:1040, width:'100%', maxWidth:'640px'}}>
      <div className="flex-grow-1 small">
        <strong>{count}</strong> item{count!==1 && 's'} • {totalDisplay}
        {discountDisplay && <span className="text-success ms-2">(saved {discountDisplay})</span>}
        {!discountDisplay && subtotal > 0 && discount === 0 && subtotal !== total && (
          <span className="ms-2 text-muted">({subtotalDisplay})</span>
        )}
      </div>
  <Link to="/cart" className="btn btn-success btn-sm">Review Cart</Link>
    </div>
  );
}
