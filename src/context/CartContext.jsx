import { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from './ToastContext.jsx';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [hasBackup, setHasBackup] = useState(() => {
    try { return !!localStorage.getItem('cart_backup'); } catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const { push } = useToast();

  function addItem(product, quantity = 1) {
    let result = { added: false };
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      const max = product.stock != null ? product.stock : Infinity;
      if (max === 0) {
        result = { added: false, reason: 'out-of-stock' };
        return prev;
      }
      if (existing) {
        const newQty = Math.min(existing.qty + quantity, max);
        if (newQty === existing.qty) {
          result = { added: false, reason: 'max-stock' };
          return prev;
        }
        result = { added: true };
        return prev.map(i => i.id === product.id ? { ...i, qty: newQty, stock: max } : i);
      }
      const initialQty = Math.min(quantity, max);
      result = { added: true };
      return [...prev, { ...product, qty: initialQty, stock: max }];
    });
    return result;
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function updateQty(id, qty) {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const max = item.stock != null ? item.stock : Infinity;
      if (qty <= 0) return prev.filter(i => i.id !== id);
      const clamped = Math.min(qty, max);
      if (clamped < qty) push(`Only ${max} available`);
      return prev.map(i => i.id === id ? { ...i, qty: clamped } : i);
    });
  }

  function clearCart() { setItems([]); }

  function backupCart() {
    try {
      localStorage.setItem('cart_backup', JSON.stringify(items));
      setHasBackup(true);
    } catch {}
  }
  function restoreCart() {
    try {
      const raw = localStorage.getItem('cart_backup');
      if (raw) {
        const data = JSON.parse(raw);
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {}
  }
  function clearCartBackup() {
    try { localStorage.removeItem('cart_backup'); setHasBackup(false); } catch {}
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, backupCart, restoreCart, clearCartBackup, hasCartBackup: hasBackup, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
