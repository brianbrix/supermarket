import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminLogin() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e){
    e.preventDefault();
    setSubmitting(true);
    await login(username, password);
    setSubmitting(false);
  }

  return (
    <div className="container py-5" style={{maxWidth:480}}>
      <h1 className="h4 mb-3">Admin Login</h1>
      <form onSubmit={handleSubmit} className="card p-3 shadow-sm">
        <div className="mb-3">
          <label className="form-label small">Username</label>
          <input className="form-control" value={username} onChange={e=>setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="mb-3">
          <label className="form-label small">Password</label>
          <input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary w-100" disabled={submitting}>{submitting ? 'Signing in...' : 'Login'}</button>
      </form>
    </div>
  );
}
