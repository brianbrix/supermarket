import { useCart } from '../context/CartContext.jsx';
import { useLocation, Link } from 'react-router-dom';
import { formatCurrency } from '../utils/currency.js';
import { useEffect, useState } from 'react';

// Sticky bar visible on small screens showing subtotal and quick actions
export default function MobileCartBar(){
  const { total, count } = useCart();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 576);

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
        <strong>{count}</strong> item{count!==1 && 's'} • {formatCurrency(total)}
      </div>
  <Link to="/cart" className="btn btn-success btn-sm">Review Cart</Link>
    </div>
  );
}
