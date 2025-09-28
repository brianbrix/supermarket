import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="admin-layout d-flex" style={{minHeight:'calc(100vh - 56px)'}}>
      <aside className={`border-end bg-body-tertiary p-2 d-flex flex-column ${collapsed ? 'collapsed' : ''}`} style={{width: collapsed ? '64px':'210px', transition:'width .25s'}}> 
        <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={()=>setCollapsed(c=>!c)} aria-label={collapsed? 'Expand sidebar':'Collapse sidebar'}>
          <i className={`bi ${collapsed? 'bi-chevron-double-right':'bi-chevron-double-left'}`}></i>
        </button>
        <nav className="nav flex-column small gap-1">
          <AdminNavLink to="/admin/dashboard" icon="bi-speedometer2" label="Dashboard" collapsed={collapsed} />
          <AdminNavLink to="/admin/products" icon="bi-box-seam" label="Products" collapsed={collapsed} />
          <AdminNavLink to="/admin/coupons" icon="bi-ticket-perforated" label="Coupons" collapsed={collapsed} />
          <AdminNavLink to="/admin/categories" icon="bi-tags" label="Categories" collapsed={collapsed} />
          <AdminNavLink to="/admin/orders" icon="bi-receipt-cutoff" label="Orders" collapsed={collapsed} />
          <AdminNavLink to="/admin/users" icon="bi-people" label="Users" collapsed={collapsed} />
          <AdminNavLink to="/admin/payments" icon="bi-cash-stack" label="Payments" collapsed={collapsed} />
          <AdminNavLink to="/admin/payment-options" icon="bi-sliders" label="Payment Options" collapsed={collapsed} />
          <AdminNavLink to="/admin/analytics" icon="bi-graph-up" label="Analytics" collapsed={collapsed} />
          <AdminNavLink to="/admin/system-settings" icon="bi-gear-fill" label="System Settings" collapsed={collapsed} />
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

function AdminNavLink({ to, icon, label, collapsed }) {
  return (
    <NavLink to={to} className={({isActive})=>`nav-link d-flex align-items-center gap-2 px-2 py-2 rounded ${isActive?'active bg-success text-white':'text-body'}`} end>
      <i className={`bi ${icon}`}></i>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
