import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function CustomerLogin() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e){
    e.preventDefault();
    setSubmitting(true);
  await login(identifier, password);
    setSubmitting(false);
  }

  return (
    <div className="container py-5" style={{maxWidth:480}}>
      <h1 className="h4 mb-3">Login</h1>
      <form onSubmit={handleSubmit} className="card p-3 shadow-sm">
        <div className="mb-3">
          <label className="form-label small">Email or Username</label>
          <input className="form-control" value={identifier} onChange={e=>setIdentifier(e.target.value)} required autoFocus />
        </div>
        <div className="mb-3">
          <label className="form-label small">Password</label>
          <input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-success w-100" disabled={submitting}>{submitting ? 'Signing in...' : 'Login'}</button>
        <p className="small text-center mt-3 mb-0">No account? <a href="/register">Register</a></p>
      </form>
    </div>
  );
}
