import { NavLink, Outlet } from 'react-router-dom';
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  const groups = [
    {
      id: 'main',
      title: 'Main',
      links: [
        { to: '/admin/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
        { to: '/admin/homepage', icon: 'bi-columns-gap', label: 'Homepage' },
      ]
    },
    {
      id: 'catalog',
      title: 'Catalog',
      links: [
        { to: '/admin/products', icon: 'bi-box-seam', label: 'Products' },
        { to: '/admin/brands', icon: 'bi-patch-check', label: 'Brands' },
        { to: '/admin/categories', icon: 'bi-tags', label: 'Categories' },
        { to: '/admin/product-tags', icon: 'bi-bookmark-star', label: 'Product Tags' },
      ]
    },
    {
      id: 'orders',
      title: 'Orders',
      links: [
        { to: '/admin/orders', icon: 'bi-receipt-cutoff', label: 'Orders' },
        { to: '/admin/deliveries', icon: 'bi-truck', label: 'Deliveries' },
        { to: '/admin/delivery-shops', icon: 'bi-geo-alt', label: 'Delivery Shops' },
      ]
    },
    {
      id: 'payments',
      title: 'Payments',
      links: [
        { to: '/admin/payments', icon: 'bi-cash-stack', label: 'Payments' },
        { to: '/admin/payment-options', icon: 'bi-sliders', label: 'Payment Options' },
        { to: '/admin/coupons', icon: 'bi-ticket-perforated', label: 'Coupons' },
      ]
    },
    {
      id: 'system',
      title: 'System',
      links: [
        { to: '/admin/users', icon: 'bi-people', label: 'Users' },
        { to: '/admin/analytics', icon: 'bi-graph-up', label: 'Analytics' },
        { to: '/admin/system-settings', icon: 'bi-gear-fill', label: 'System Settings' },
      ]
    }
  ];

  return (
    <div className="admin-layout d-flex" style={{minHeight:'calc(100vh - 56px)'}}>
      <aside className={`admin-sidebar border-end bg-body-tertiary p-2 d-flex flex-column ${collapsed ? 'is-collapsed' : ''}`}>
        <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={()=>setCollapsed(c=>!c)} aria-label={collapsed? 'Expand sidebar':'Collapse sidebar'}>
          <i className={`bi ${collapsed? 'bi-chevron-double-right':'bi-chevron-double-left'}`}></i>
        </button>
        <nav className="nav flex-column small gap-2">
          {groups.map(g => (
            <AdminNavGroup key={g.id} group={g} collapsed={collapsed} />
          ))}
        </nav>
        <div className="mt-auto pt-3 small text-muted text-center" style={{fontSize:'0.65rem'}}>
          Admin
        </div>
      </aside>
      <div className="flex-grow-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

function AdminNavGroup({ group, collapsed }) {
  const storageKey = `admin_menu_group_${group.id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = window.localStorage.getItem(storageKey);
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });

  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  const updateHeight = useCallback(() => {
    if (!contentRef.current) return;
    const nextHeight = contentRef.current.scrollHeight;
    setContentHeight(nextHeight);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, open ? '1' : '0'); } catch {}
  }, [open, storageKey]);

  useLayoutEffect(() => {
    updateHeight();
  }, [updateHeight, collapsed, group.links.length]);

  useEffect(() => {
    updateHeight();
  }, [open, updateHeight]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !contentRef.current) return;
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [updateHeight]);

  const measuredHeight = contentHeight || (contentRef.current ? contentRef.current.scrollHeight : 0);
  const maxHeight = open ? `${measuredHeight}px` : '0px';
  const ariaLabel = collapsed ? `${group.title} section` : undefined;

  return (
    <div className={`admin-nav-group ${open ? 'is-open' : 'is-closed'}`}>
      <button
        type="button"
        className={`btn btn-sm btn-toggle w-100 text-start ${open ? 'fw-semibold' : ''}`}
        onClick={() => setOpen(s => !s)}
        aria-expanded={open}
        aria-controls={`group-${group.id}`}
        aria-label={ariaLabel}
      >
        <span className="toggle-icon" aria-hidden="true">
          <i className="bi bi-caret-right-fill"></i>
        </span>
        <span className="flex-grow-1 group-title">{group.title}</span>
      </button>
      <div
        id={`group-${group.id}`}
        ref={contentRef}
        className="group-links"
        style={{ maxHeight, paddingLeft: collapsed ? 0 : '0.25rem' }}
        aria-hidden={!open}
      >
        {group.links.map(l => (
          <AdminNavLink key={l.to} to={l.to} icon={l.icon} label={l.label} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

function AdminNavLink({ to, icon, label, collapsed }) {
  return (
    <NavLink to={to} className={({isActive})=>`nav-link d-flex align-items-center gap-2 px-2 py-2 rounded ${isActive?'active bg-success text-white':'text-body'}`} end>
      <i className={`bi ${icon}`}></i>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
