import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register: registerUser } = useAuth();
  const [form, setForm] = useState({ username:'', email:'', password:'', firstName:'', lastName:'' });
  const [submitting, setSubmitting] = useState(false);

  function update(e){ setForm(f=>({ ...f, [e.target.name]: e.target.value })); }

  async function handleSubmit(e){
    e.preventDefault();
    setSubmitting(true);
    await registerUser(form);
    setSubmitting(false);
  }

  return (
    <div className="container py-5" style={{maxWidth:520}}>
      <h1 className="h4 mb-3">Create Account</h1>
      <form onSubmit={handleSubmit} className="card p-3 shadow-sm" noValidate>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label small">First Name</label>
            <input name="firstName" className="form-control" value={form.firstName} onChange={update} required />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Last Name</label>
            <input name="lastName" className="form-control" value={form.lastName} onChange={update} required />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Username</label>
            <input name="username" className="form-control" value={form.username} onChange={update} required />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small">Email</label>
            <input type="email" name="email" className="form-control" value={form.email} onChange={update} required />
          </div>
          <div className="col-12">
            <label className="form-label small">Password</label>
            <input type="password" name="password" className="form-control" value={form.password} onChange={update} required minLength={6} />
          </div>
        </div>
        <button className="btn btn-success w-100 mt-3" disabled={submitting}>{submitting ? 'Creating...' : 'Register'}</button>
  <p className="small text-center mt-3 mb-0">Have an account? <Link to="/login">Login</Link></p>
      </form>
    </div>
  );
}
