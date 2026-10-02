import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { api, clearAuthToken, type AuthSession, type User } from './api';
import { App } from './App';

export function AuthApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    void api<AuthSession>('/auth/session').then(value => { if (current) setUser(value.user); })
      .catch(reason => { if (current) setError(reason.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt]);
  useEffect(() => {
    const onExpired = () => { setUser(null); setPassword(''); setError('Your session ended. Please log in again.'); };
    window.addEventListener('auth-required', onExpired);
    return () => window.removeEventListener('auth-required', onExpired);
  }, []);
  useEffect(() => {
    let current = true;
    const onFocus = () => { void api<AuthSession>('/auth/session').then(value => { if (current) setUser(value.user); })
      .catch(reason => { if (current) setError(reason.message); }); };
    window.addEventListener('focus', onFocus);
    return () => { current = false; window.removeEventListener('focus', onFocus); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await api<AuthSession>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
      setUser(result.user); setPassword('');
    } catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function logout() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await api('/auth/logout', { method: 'POST' }); clearAuthToken(); setUser(null); setPassword(''); }
    catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (user) return <>{error && <div className="error-banner" role="alert">{error}</div>}<App key={user.id} user={user} onLogout={() => void logout()} loggingOut={busy} /></>;
  return <div className="auth-shell"><a href="/" className="brand"><span className="brand-icon"><Link2 size={23} /></span>linkstudio.</a><main className="auth-main"><section className="panel auth-card">
    <span className="section-kicker">YOUR LINKS. YOUR WORKSPACE.</span><h1>{mode === 'login' ? 'Welcome back.' : 'Make room for your links.'}</h1>
    <p>Log in to create links and view your private history, statistics and CSV. Shared short links, Preview and QR stay publicly accessible.</p>
    {loading ? <p role="status"><Loader2 className="spin" />Checking session…</p> : <form onSubmit={event => void submit(event)}>
      <label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="username" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
      <label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={10} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} aria-describedby="password-hint" />
      <p className="field-hint" id="password-hint">At least 10 characters, up to 72 UTF-8 bytes. Email verification and password reset are not included.</p>
      <button className="button primary" disabled={busy}>{busy && <Loader2 className="spin" size={17} />}{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
      <button type="button" className="button preview-secondary" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); }}>{mode === 'login' ? 'Create an account' : 'Already registered? Log in'}</button>
    </form>}
    {error && <div className="form-error" role="alert">{error}<button className="text-button" onClick={() => setAttempt(attempt + 1)}>Reload session</button></div>}
  </section></main></div>;
}
