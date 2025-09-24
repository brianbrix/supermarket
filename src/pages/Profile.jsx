import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) return <div>Please log in.</div>;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await changePassword(currentPassword, newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: '1rem' }}>
      <h2>Profile</h2>
      <div style={{ marginBottom: '1.5rem' }}>
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
        <p><strong>Role:</strong> {user.role}</p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3>Change Password</h3>
        <input type="password" placeholder="Current password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required />
        <input type="password" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={6} />
        <button disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
      </form>
    </div>
  );
}
