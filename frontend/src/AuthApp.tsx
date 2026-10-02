import MorphLoading from './components/ui/morph-loading';
import { InteractiveHoverButton } from './components/ui/interactive-hover-button';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Link2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { api, clearAuthToken, type AuthSession, type User } from './api';
import { App } from './App';

export function AuthApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<'account' | 'password' | 'confirm'>('account');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState('');
  const confirmationInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loading || user) return;
    (step === 'account' ? firstInput : step === 'password' ? passwordInput : confirmationInput).current?.focus();
  }, [step, mode, loading, user]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    void api<AuthSession>('/auth/session').then(value => { if (current) setUser(value.user); })
      .catch(reason => { if (current) setError(reason.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt]);
  useEffect(() => {
    const onExpired = () => { setUser(null); setStep('account'); setShowPassword(false); setShowConfirmation(false); setPassword(''); setConfirmation(''); setError('Your session ended. Please log in again.'); };
    const onPasswordChanged = () => { setUser(null); setStep('account'); setShowPassword(false); setShowConfirmation(false); setPassword(''); setConfirmation(''); setError('Password changed. All sessions ended. Please log in with your new password.'); };
    window.addEventListener('password-changed', onPasswordChanged);
    window.addEventListener('auth-required', onExpired);
    return () => { window.removeEventListener('auth-required', onExpired); window.removeEventListener('password-changed', onPasswordChanged); };
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
    setValidationError(''); setError('');
    if (step === 'account') {
      if (mode === 'register' && (!displayName.trim() || displayName.trim().length > 80 || /[\p{Cc}\p{Cf}]/u.test(displayName))) {
        setValidationError('Enter a name of 1–80 characters without control characters.'); return;
      }
      setStep('password'); return;
    }
    if (password.length < 10 || new TextEncoder().encode(password).length > 72) {
      setValidationError('Use at least 10 characters and at most 72 UTF-8 bytes.'); setStep('password'); return;
    }
    if (mode === 'register' && step === 'password') { setStep('confirm'); return; }
    if (mode === 'register') {
      if (!displayName.trim() || displayName.trim().length > 80 || /[\p{Cc}\p{Cf}]/u.test(displayName)) { setValidationError('Enter a name of 1–80 characters without control characters.'); return; }
      if (password !== confirmation) { setValidationError('Passwords do not match. Please enter the same password twice.'); confirmationInput.current?.focus(); return; }
    }
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await api<AuthSession>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email: email.trim(), password, ...(mode === 'register' ? { displayName: displayName.trim() } : {}) }) });
      setUser(result.user); setPassword(''); setConfirmation(''); setDisplayName('');
    } catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function logout() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await api('/auth/logout', { method: 'POST' }); clearAuthToken(); setUser(null); setStep('account'); setShowPassword(false); setShowConfirmation(false); setPassword(''); setConfirmation(''); }
    catch (reason) { setError((reason as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (user) return <>{error && <div className="error-banner" role="alert">{error}</div>}<App key={user.id} user={user} onLogout={() => void logout()} loggingOut={busy} onUserChange={setUser} /></>;
  const finalStep = mode === 'login' ? step === 'password' : step === 'confirm';
  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login'); setStep('account'); setError(''); setValidationError('');
    setPassword(''); setConfirmation(''); setDisplayName(''); setShowPassword(false); setShowConfirmation(false);
  };
  return <div className="auth-shell auth-experience">
    <header className="auth-header"><a href="/" className="brand"><span className="brand-icon"><Link2 size={23} /></span>linkstudio.</a><span className="auth-header-note">YOUR PERSONAL LINK WORKSPACE</span></header>
    <main className="auth-main"><section className="panel auth-card" aria-labelledby="auth-title">
      <div className="auth-mark" aria-hidden="true"><Link2 size={28} /></div>
      <span className="section-kicker">{mode === 'login' ? 'WELCOME BACK' : 'MAKE IT YOURS'}</span>
      <h1 id="auth-title">{mode === 'login' ? 'Log in to Link Studio' : 'Create your account'}</h1>
      <p className="auth-description">{mode === 'login' ? 'A little less link clutter. Pick up where you left off.' : 'One place for your links, QR codes and recorded opens.'}</p>
      {loading ? <p className="auth-loading" role="status"><MorphLoading />Checking session…</p> : <>
        <ol className="auth-progress" aria-label="Account steps">
          {(mode === 'login' ? ['Account', 'Password'] : ['Account', 'Password', 'Confirm']).map((label, index) => <li key={label} aria-current={index === ['account', 'password', 'confirm'].indexOf(step) ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{label}</li>)}
        </ol>
        <form onSubmit={event => void submit(event)} aria-busy={busy}>
          {step !== 'account' && <div className="auth-account-summary"><Mail size={17} aria-hidden="true" /><span title={email}>{email}</span><InteractiveHoverButton type="button" className="text-button" disabled={busy} onClick={() => { setStep('account'); setError(''); setValidationError(''); }}>Edit</InteractiveHoverButton></div>}
          {step === 'account' && <>
            {mode === 'register' && <div className="auth-field"><label htmlFor="auth-name">Display name</label><div className="auth-input"><UserRound size={18} aria-hidden="true" /><input ref={firstInput} id="auth-name" autoComplete="name" required maxLength={80} placeholder="What should we call you?" value={displayName} disabled={busy} onChange={event => setDisplayName(event.target.value)} /></div></div>}
            <div className="auth-field"><label htmlFor="auth-email">Email</label><div className="auth-input"><Mail size={18} aria-hidden="true" /><input ref={mode === 'login' ? firstInput : undefined} id="auth-email" type="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></div></div>
          </>}
          {step === 'password' && <div className="auth-field"><label htmlFor="auth-password">Password</label><div className="auth-input"><LockKeyhole size={18} aria-hidden="true" /><input ref={passwordInput} id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={10} placeholder={mode === 'login' ? 'Enter your password' : 'Choose a password'} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} aria-describedby="password-hint" /><InteractiveHoverButton className="auth-eye" type="button" disabled={busy} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</InteractiveHoverButton></div><p className="field-hint" id="password-hint">At least 10 characters, up to 72 UTF-8 bytes.</p></div>}
          {step === 'confirm' && <div className="auth-field"><label htmlFor="auth-confirm">Confirm password</label><div className="auth-input"><LockKeyhole size={18} aria-hidden="true" /><input ref={confirmationInput} id="auth-confirm" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required minLength={10} placeholder="Enter your password again" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} aria-invalid={!!validationError && password !== confirmation} aria-describedby={validationError ? 'confirm-hint registration-error' : 'confirm-hint'} /><InteractiveHoverButton className="auth-eye" type="button" disabled={busy} aria-label={showConfirmation ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(!showConfirmation)}>{showConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}</InteractiveHoverButton></div><p className="field-hint" id="confirm-hint">Enter the same password again.</p></div>}
          {validationError && <p className="form-error" id="registration-error" role="alert">{validationError}</p>}
          {error && <div className="form-error" role="alert">{error}<InteractiveHoverButton type="button" className="text-button" disabled={busy} onClick={() => setAttempt(attempt + 1)}>Reload session</InteractiveHoverButton></div>}
          <InteractiveHoverButton className="button primary auth-submit" disabled={busy}>{busy ? <MorphLoading size="sm" /> : null}{busy ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : finalStep ? (mode === 'login' ? 'Log in' : 'Create account') : 'Continue'}{!busy && <ArrowRight size={18} aria-hidden="true" />}</InteractiveHoverButton>
          {step !== 'account' && <InteractiveHoverButton type="button" className="auth-back text-button" disabled={busy} onClick={() => { setStep(step === 'confirm' ? 'password' : 'account'); setValidationError(''); setError(''); setShowPassword(false); setShowConfirmation(false); }}><ArrowLeft size={16} aria-hidden="true" />Go back</InteractiveHoverButton>}
        </form>
        <div className="auth-switch"><span>{mode === 'login' ? 'New to Link Studio?' : 'Already have an account?'}</span><InteractiveHoverButton type="button" className="text-button" disabled={busy} onClick={switchMode}>{mode === 'login' ? 'Create an account' : 'Log in instead'}</InteractiveHoverButton></div>
      </>}
      {loading && error && <p className="form-error" role="alert">{error}</p>}
      <p className="auth-footnote">Your workspace is private.<br />Shared links, Preview and QR remain public.</p>
    </section></main>
    <footer className="auth-footer">LINK STUDIO<span>Short links. Clear insights.</span></footer>
  </div>;
}
