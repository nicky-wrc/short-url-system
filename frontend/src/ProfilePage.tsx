import { useRef, useState, type FormEvent } from 'react';
import { Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { api, clearAuthToken, type User } from './api';

export function ProfilePage({ user, onUserChange }: { user: User; onUserChange: (user: User | null) => void }) {
  const [name, setName] = useState(user.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<'name' | 'password' | null>(null);
  const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const lock = useRef(false);
  async function submit(event: FormEvent, kind: 'name' | 'password') {
    event.preventDefault(); if (lock.current) return;
    setError(''); setSuccess('');
    if (kind === 'password' && newPassword !== confirmation) { setError('New passwords do not match.'); return; }
    lock.current = true; setBusy(kind);
    try {
      if (kind === 'name') {
        const result = await api<{ user: User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify({ displayName: name }) });
        onUserChange(result.user); setName(result.user.displayName); setSuccess('Your profile has been saved.');
      } else {
        await api('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
        clearAuthToken(); setCurrentPassword(''); setNewPassword(''); setConfirmation('');
        window.dispatchEvent(new Event('password-changed'));
        onUserChange(null);
      }
    } catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(null); }
  }
  return <div className="profile-layout">
    <section className="panel profile-summary"><span className="profile-avatar"><UserRound size={30} /></span><h2>{user.displayName || 'Your profile'}</h2><p className="profile-email">{user.email}</p><p>Your workspace belongs to you. Shared short links, Preview and QR remain public.</p><span className="section-kicker">PERSONAL WORKSPACE</span></section>
    <div className="profile-forms">
      <section className="panel profile-panel"><div className="panel-heading"><div><span className="section-kicker">A NAME THAT FEELS LIKE YOU</span><h2>Personal details</h2></div><UserRound size={22} /></div>
        <form onSubmit={event => void submit(event, 'name')}><label htmlFor="profile-name">Display name</label><input id="profile-name" autoComplete="name" value={name} required maxLength={80} disabled={!!busy} onChange={event => setName(event.target.value)} /><label htmlFor="profile-email">Email</label><input id="profile-email" type="email" value={user.email} readOnly /><p className="field-hint">Email is your login identifier and cannot be changed here.</p><button className="button primary" disabled={!!busy}>{busy === 'name' && <Loader2 size={16} className="spin" />}Save profile</button></form>
      </section>
      <section className="panel profile-panel"><div className="panel-heading"><div><span className="section-kicker">KEEP YOUR ACCOUNT YOURS</span><h2>Change password</h2></div><ShieldCheck size={22} /></div>
        <p>Confirm your current password. Changing it signs you out on every device.</p><form onSubmit={event => void submit(event, 'password')}>
          <label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" value={currentPassword} required disabled={!!busy} onChange={event => setCurrentPassword(event.target.value)} />
          <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" value={newPassword} required minLength={10} disabled={!!busy} onChange={event => setNewPassword(event.target.value)} />
          <label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} required minLength={10} disabled={!!busy} onChange={event => setConfirmation(event.target.value)} />
          <p className="field-hint">At least 10 characters, at most 72 UTF-8 bytes. Choose a different password.</p><button className="button preview-secondary" disabled={!!busy}>{busy === 'password' && <Loader2 size={16} className="spin" />}Update password &amp; sign out</button>
        </form></section>
      {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="profile-success" role="status">{success}</p>}
    </div>
  </div>;
}
