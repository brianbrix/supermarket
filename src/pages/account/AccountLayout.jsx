import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMemo } from 'react';

export default function AccountLayout() {
  const { user } = useAuth();
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const displayName = user?.firstName || user?.username || user?.email || 'Customer';

  return (
    <section className="container py-4">
      <div className="row g-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm bg-body-tertiary">
            <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
              <div>
                <h1 className="h4 mb-1">{greeting}, {displayName} 👋</h1>
                <p className="text-muted mb-0">Manage your personal details, preferences and recent activity.</p>
              </div>
              <div className="d-flex gap-3 small text-muted flex-wrap">
                <span><i className="bi bi-envelope-at me-1"></i>{user?.email || '—'}</span>
                <span><i className="bi bi-phone me-1"></i>{user?.phoneNumber || '—'}</span>
                {user?.role && <span className="badge text-bg-secondary">{user.role.replaceAll('_', ' ')}</span>}
              </div>
            </div>
          </div>
        </div>
        <aside className="col-12 col-lg-3">
          <nav aria-label="Account navigation" className="list-group shadow-sm rounded overflow-hidden">
            <NavLink end to="/account/profile" className={({ isActive }) => `list-group-item list-group-item-action d-flex justify-content-between align-items-center${isActive ? ' active' : ''}`}>
              <span><i className="bi bi-person-circle me-2"></i>Profile</span>
              <i className="bi bi-chevron-right small"></i>
            </NavLink>
            <NavLink to="/account/settings" className={({ isActive }) => `list-group-item list-group-item-action d-flex justify-content-between align-items-center${isActive ? ' active' : ''}`}>
              <span><i className="bi bi-sliders2-vertical me-2"></i>Settings</span>
              <i className="bi bi-chevron-right small"></i>
            </NavLink>
          </nav>
        </aside>
        <div className="col-12 col-lg-9">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
