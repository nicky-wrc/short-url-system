import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronLeft, ChevronRight, Copy, Eye, ExternalLink, Globe2, Link2, Loader2, Plus, QrCode, Search, Sparkles, UserRound, X } from 'lucide-react';
import { api, type Link, type LinkPage, type Stats, type User, clearAuthToken } from './api';
import { ProfilePage } from './ProfilePage';
import { formatExpiry, localTimeZone } from './time';
type ExpiryPreset = 'none' | '1h' | '1d' | '7d' | 'custom';

const formatNumber = (n: number) => new Intl.NumberFormat('en').format(n);
const formatDate = (date: string) => new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
const expired = (link: Link) => !!link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now();


export function App({ user, onLogout, loggingOut, onUserChange }: { user: User; onLogout: () => void; loggingOut: boolean; onUserChange: (user: User | null) => void }) {
  type Page = 'overview' | 'create' | 'links' | 'analytics' | 'profile';
  const pageLabels = { overview: 'Overview', create: 'Create link', links: 'My links', analytics: 'Analytics', profile: 'Profile' };
  const readPage = (): Page => Object.hasOwn(pageLabels, location.hash.slice(1)) ? location.hash.slice(1) as Page : 'overview';
  const [view, setView] = useState<Page>(readPage);
  useEffect(() => { const changed = () => setView(readPage()); window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  function navigate(page: Page) { location.hash = page; setView(page); window.scrollTo({ top: 0 }); }
  const pageTitles = { overview: 'Your workspace, at a glance.', create: 'Make your next connection.', links: 'Every link, in one place.', analytics: 'The story behind your links.', profile: 'A workspace that feels like you.' };
  const [links, setLinks] = useState<LinkPage | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [alias, setAlias] = useState('');
  const [expiry, setExpiry] = useState('');
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('none');
  const [advanced, setAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [created, setCreated] = useState<Link | null>(null);
  const [qr, setQr] = useState<Link | null>(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportLock = useRef(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const requestId = useRef(0);

  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const refresh = useCallback(async (quiet = false) => {
    const id = ++requestId.current;
    if (!quiet) setLoading(true);
    try {
      const [list, summary] = await Promise.all([api<LinkPage>(`/links?page=${page}&limit=6&q=${encodeURIComponent(debouncedSearch)}`), api<Stats>('/stats')]);
      if (id !== requestId.current) return;
      setLinks(list); setStats(summary); setLoadError('');
    } catch (error) { if (id === requestId.current) setLoadError((error as Error).message); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [page, debouncedSearch]);
  useEffect(() => { void refresh(); return () => { requestId.current++; }; }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) void refresh(true); }, 15000);
    const onFocus = () => { void refresh(true); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(''), 2000); return () => clearTimeout(timer); }, [copied]);
  useEffect(() => {
    if (!qr) return;
    previousFocus.current = document.activeElement as HTMLElement;
    setQrError(false);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQr(null);
      if (e.key === 'Tab') {
        const focusable = modal.current?.querySelectorAll<HTMLElement>('button, a[href]');
        const first = focusable?.[0], last = focusable?.[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = bodyOverflow; previousFocus.current?.focus(); };
  }, [qr]);

  async function copy(link: Link) {
    try { await navigator.clipboard.writeText(link.shortUrl); setCopied(link.code); setNotice('Short link copied to clipboard.'); }
    catch { setNotice('Clipboard unavailable. Select and copy the short link manually.'); }
  }
  async function create(e: FormEvent) {
    e.preventDefault(); setCreating(true); setCreateError('');
    try {
      if (expiryPreset === 'custom' && (!expiry || !Number.isFinite(new Date(expiry).getTime()) || new Date(expiry).getTime() <= Date.now())) throw new Error('Choose a future date and time for custom expiry.');
      const link = await api<Link>('/links', { method: 'POST', body: JSON.stringify({
        originalUrl: url, title, ...(alias.trim() ? { customAlias: alias.trim() } : {}),
        expiryPreset, ...(expiryPreset === 'custom' ? { expiresAt: new Date(expiry).toISOString() } : {}),
      }) });
      setCreated(link); setUrl(''); setTitle(''); setAlias(''); setExpiry(''); setExpiryPreset('none'); setPage(1);
      if (page === 1) await refresh(true);
      setNotice('Your short link is ready to share.');
    } catch (error) { setCreateError((error as Error).message); }
    finally { setCreating(false); }
  }
  async function downloadCsv() {
    if (exportLock.current) return;
    exportLock.current = true; setExporting(true); setExportError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`/api/links/export.csv?q=${encodeURIComponent(debouncedSearch)}`, { signal: controller.signal });
      if (!response.ok) {
        if (response.status === 401) { clearAuthToken(); window.dispatchEvent(new Event('auth-required')); }
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'CSV download failed. Please try again.');
      }
      if (!response.headers.get('content-type')?.startsWith('text/csv')) throw new Error('CSV download failed. Please try again.');
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = response.headers.get('content-disposition')?.match(/filename="(my-links-\d{4}-\d{2}-\d{2}\.csv)"/)?.[1] ?? 'my-links.csv';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice('My links CSV download started. Empty results contain headers only.');
    } catch (error) {
      setExportError((error as Error).name === 'AbortError' ? 'CSV download timed out. Narrow your search or try again.' : (error as Error).message);
    } finally { clearTimeout(timer); exportLock.current = false; setExporting(false); }
  }
  function focusCreate() { navigate('create'); }
  useEffect(() => { if (view === 'create') urlInput.current?.focus(); }, [view]);
  const totalPages = Math.max(1, Math.ceil((links?.total ?? 0) / 6));
  const maxClicks = Math.max(1, ...(stats?.daily.map(d => d.clicks) ?? []));

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="/" className="brand" aria-label="Link Studio home"><span className="brand-icon"><Link2 size={23} /></span><span>link<span className="brand-light">studio</span><span className="brand-dot">.</span></span></a>
      <div className="workspace"><span className="workspace-avatar">{(user.displayName || user.email).slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName || 'My workspace'}</strong><small>Personal workspace</small></div><span className="workspace-dot" /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {(['overview', 'create', 'links', 'analytics'] as const).map(page => { const Icon = page === 'overview' || page === 'analytics' ? BarChart3 : page === 'create' ? Plus : Link2; return <a key={page} href={`#${page}`} aria-current={view === page ? 'page' : undefined} className={view === page ? 'nav-item active' : 'nav-item'}><Icon size={19} />{pageLabels[page]}{page === 'links' && <span className="nav-count">{stats?.totalLinks ?? '—'}</span>}</a>; })}
        <span className="nav-label account-nav-label">ACCOUNT</span>
        <a href="#profile" aria-current={view === 'profile' ? 'page' : undefined} className={view === 'profile' ? 'nav-item active' : 'nav-item'}><UserRound size={19} />Profile</a>
      </nav>
      <div className="sidebar-note"><span className="note-icon"><Sparkles size={19} /></span><h3>Small links.<br />Bigger possibilities.</h3><p>One place to create, share,<br />and track every connection.</p><button onClick={focusCreate}>Create a link <ArrowUpRight size={16} /></button></div>
      <div className="sidebar-footer"><span className="footer-mark">SYNERRY<span>+</span></span><p>Built for meaningful connections.</p><span className="version">FULL-STACK CHALLENGE · V1.0</span></div>
    </aside>

    <div className="main-wrapper">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={14} /><strong>{pageLabels[view]}</strong></div><div className="topbar-right"><span className={`service-status ${loadError ? 'offline' : ''}`}><span />{loading && !stats ? 'Connecting' : loadError ? 'Connection issue' : 'API connected'}</span><a href="#profile" className="account-email" aria-label="Open profile">{user.displayName || user.email}</a><button className="button csv-download" onClick={onLogout} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button></div></header>
      <main>
        <section className="page-heading"><div><div className="eyebrow"><span /> YOUR CONNECTIONS, SIMPLIFIED</div><h1>{pageTitles[view]}</h1><p>{view === 'profile' ? 'Manage your personal details and account security.' : 'Create memorable links. Share them anywhere. See where they go.'}</p></div>{view !== 'profile' && view !== 'create' && <button className="button primary heading-button" onClick={focusCreate}><Plus size={17} />New link</button>}</section>

        {loadError && <div className="error-banner" role="alert"><span>Unable to load workspace: {loadError}</span><button onClick={() => void refresh()}>Retry</button></div>}
        {(view === 'overview' || view === 'analytics') && <section className="stats-grid" aria-label="Workspace statistics">
          {[
            { label: 'Total links', value: stats?.totalLinks, icon: Link2, detail: 'Connections you’ve created', color: 'coral' },
            { label: 'Total opens', value: stats?.totalClicks, icon: ArrowUpRight, detail: 'Every successful link opening', color: 'blue' },
            { label: 'Opens today', value: stats?.todayClicks, icon: BarChart3, detail: 'A fresh look at today · UTC', color: 'green' },
            { label: 'Active links', value: stats?.activeLinks, icon: Globe2, detail: 'Ready to take people places', color: 'purple' },
          ].map(card => <article className="stat-card" key={card.label}><div className="stat-top"><span>{card.label}</span><span className={`stat-icon ${card.color}`}><card.icon size={18} /></span></div><strong className="stat-value">{card.value === undefined ? '—' : formatNumber(card.value)}</strong><p>{card.detail}</p></article>)}
        </section>}

        {(view === 'create' || view === 'overview' || view === 'analytics') && <div className="creation-row workspace-page-row">
          {view === 'overview' && <section className="panel overview-actions"><span className="section-kicker">YOUR NEXT STEP</span><h2>One link. Many possibilities.</h2><p>Create a link, share a QR code or review your private history.</p><button className="button primary" onClick={focusCreate}><Plus size={17} />Create a link</button><a className="button preview-secondary" href="#links">Browse My links <ArrowRight size={17} /></a></section>}
          {view === 'create' && <section className="panel create-panel" id="create-link">
            <div className="panel-heading"><div><span className="section-kicker">MAKE YOUR NEXT CONNECTION</span><h2>Long URL, meet short link.</h2></div><span className="section-icon"><Link2 size={22} /></span></div>
            <form onSubmit={create}>
              <label htmlFor="destination">Destination URL <span className="required">*</span></label>
              <div className="input-with-icon"><Globe2 size={18} /><input ref={urlInput} id="destination" type="url" placeholder="https://example.com/your-next-big-idea" required maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} /></div>
              <p className="field-hint">Paste the full link you want to share, including https://</p>
              <div className="expiry-options"><div><label htmlFor="expiry-preset">Link expiration</label><select id="expiry-preset" value={expiryPreset} disabled={creating} onChange={e => { setExpiryPreset(e.target.value as ExpiryPreset); setExpiry(''); }} aria-describedby="expiry-hint"><option value="none">No expiration · ไม่หมดอายุ</option><option value="1h">1 hour · 1 ชั่วโมง</option><option value="1d">1 day · 1 วัน</option><option value="7d">7 days · 7 วัน</option><option value="custom">Custom date &amp; time · กำหนดเอง</option></select><p className="field-hint" id="expiry-hint">Durations start when the server creates your link.</p></div>{expiryPreset === 'custom' && <div><label htmlFor="expiry">Expires at ({localTimeZone})</label><input id="expiry" type="datetime-local" required disabled={creating} value={expiry} onChange={e => setExpiry(e.target.value)} aria-describedby="custom-expiry-hint" /><p className="field-hint" id="custom-expiry-hint">Enter a future time in {localTimeZone}. Stored as UTC.</p></div>}</div>
              <div className="form-bottom"><button type="button" className="advanced-toggle" aria-expanded={advanced} aria-controls="advanced-options" onClick={() => setAdvanced(!advanced)}><Plus size={15} className={advanced ? 'rotate' : ''} />Link options<span>Optional</span></button><button className="button primary" disabled={creating}>{creating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}{creating ? 'Creating…' : 'Shorten link'}{!creating && <ArrowRight size={16} />}</button></div>
              {advanced && <div className="advanced-fields" id="advanced-options"><div><label htmlFor="title">Link title</label><input id="title" placeholder="e.g. Product launch" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></div><div><label htmlFor="alias">Custom alias</label><input id="alias" placeholder="e.g. launch-2026" pattern="[A-Za-z0-9_-]{4,32}" minLength={4} maxLength={32} value={alias} onChange={e => setAlias(e.target.value)} /><p className="field-hint">4–32 letters, numbers, - or _</p></div></div>}
              {createError && <p className="form-error" role="alert">{createError}</p>}
            </form>
            {created && <div className="created-result" role="status"><div className="result-heading"><Check size={17} /><strong>Ready for the world.</strong><button className="icon-button" aria-label="Dismiss created link" onClick={() => setCreated(null)}><X size={15} /></button></div><p className="expiry-summary">Expires: {formatExpiry(created.expiresAt)}</p><div className="result-link"><a href={created.shortUrl} target="_blank" rel="noreferrer">{created.shortUrl}</a><button className="icon-button" aria-label="Copy new short link" onClick={() => void copy(created)}>{copied === created.code ? <Check size={17} /> : <Copy size={17} />}</button><a className="icon-button" href={`/preview/${created.code}`} aria-label="Preview new short link" title="Preview destination"><Eye size={18} /></a><button className="icon-button" aria-label="Show new QR code" onClick={() => setQr(created)}><QrCode size={18} /></button></div></div>}
          </section>}

          {view !== 'create' && <section className="panel activity-panel"><div className="activity-heading"><h2>A week of connections</h2><span>LAST 7 DAYS</span></div><div className="activity-summary"><strong>{formatNumber(stats?.daily.reduce((sum, day) => sum + day.clicks, 0) ?? 0)}</strong><span>link opens <ArrowUpRight size={14} /></span></div><div className="bar-chart" role="img" aria-label={`Daily link opens in UTC: ${stats?.daily.map(d => `${d.date}: ${d.clicks}`).join(', ') ?? 'Loading'}`}>
            {(stats?.daily ?? Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10), clicks: 0 }))).map((day, i) => <div className="chart-column" key={day.date}><div className="bar-track"><div className={`bar ${i === 6 ? 'today' : ''}`} style={{ height: `${day.clicks === 0 ? 3 : Math.max(8, day.clicks / maxClicks * 100)}%` }} title={`${day.date}: ${day.clicks} opens`} /></div><span>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</span></div>)}
          </div><div className="chart-caption"><span className="chart-dot" />Successful opens · UTC · updates every 15s</div></section>}
        </div>}

        {view === 'links' && <section className="panel history-panel" id="link-history"><div className="history-heading"><div><h2>{view === 'links' ? 'All your links' : 'Your links'}<span className="pill">{links?.total ?? 0}</span></h2><p>Your history is private. Short URLs, Preview and QR are public.</p></div><div className="history-tools"><div className="search-field"><Search size={17} /><input type="search" aria-label="Search links" placeholder="Search links…" value={search} onChange={e => setSearch(e.target.value)} /></div><button className="button csv-download" onClick={() => void downloadCsv()} disabled={exporting || loading || search !== debouncedSearch || !links} aria-describedby="csv-scope">{exporting ? <Loader2 size={17} className="spin" /> : <ArrowDownToLine size={17} />}{exporting ? 'Downloading…' : 'ดาวน์โหลด CSV'}</button><p id="csv-scope">ประวัติของคุณ · ทุกหน้าตามคำค้น · สูงสุด 10,000 รายการ</p></div></div>{exporting && <p className="csv-feedback" role="status">Preparing My links CSV…</p>}{exportError && <p className="form-error csv-feedback" role="alert">{exportError}</p>}
          <div className="table-scroll"><table><thead><tr><th>LINK & DESTINATION</th><th>CREATED</th><th>OPENS</th><th>STATUS</th><th className="actions-heading">ACTIONS</th></tr></thead><tbody>
            {loading ? <tr><td colSpan={5}><div className="empty-state"><Loader2 className="spin" size={25} /><h3>Loading your links…</h3></div></td></tr> : !links?.items.length ? <tr><td colSpan={5}><div className="empty-state"><span className="empty-icon"><Link2 size={25} /></span><h3>{debouncedSearch ? 'No matching links' : 'Your next connection starts here'}</h3><p>{debouncedSearch ? 'Try a different title, destination or alias.' : 'Create your first short link and watch its story unfold.'}</p>{!debouncedSearch && <button className="text-button" onClick={focusCreate}>Create your first link <ArrowRight size={15} /></button>}</div></td></tr> : links.items.map(link => <tr key={link.id}><td><div className="link-cell"><span className="link-avatar"><Link2 size={19} /></span><div className="link-details"><a className="short-link" href={link.shortUrl} target="_blank" rel="noreferrer">{link.title || `/${link.code}`}<ArrowUpRight size={13} /></a><div className="short-address">{link.shortUrl}</div><a className="destination" href={link.originalUrl} title={link.originalUrl} target="_blank" rel="noreferrer">{link.originalUrl}</a></div></div></td><td className="date-cell">{formatDate(link.createdAt)}</td><td><span className="click-count"><BarChart3 size={14} />{formatNumber(link.clicks)}</span></td><td><span className={`status-pill ${expired(link) ? 'expired' : ''}`} title={formatExpiry(link.expiresAt)}><span />{expired(link) ? 'Expired' : 'Active'}</span><p className="expiry-summary">{formatExpiry(link.expiresAt)}</p></td><td><div className="row-actions"><button className="icon-button" aria-label={`Copy link ${link.code}`} title="Copy short link" onClick={() => void copy(link)}>{copied === link.code ? <Check size={16} /> : <Copy size={16} />}</button><button className="icon-button" aria-label={`QR code for ${link.code}`} title="View QR code" onClick={() => setQr(link)}><QrCode size={17} /></button><a className="icon-button" href={`/preview/${link.code}`} aria-label={`Preview link ${link.code}`} title="Preview destination"><Eye size={17} /></a><a className="icon-button" href={link.shortUrl} aria-label={`Open link ${link.code}`} title="Open short link" target="_blank" rel="noreferrer"><ExternalLink size={16} /></a></div></td></tr>)}
          </tbody></table></div>
          <div className="table-footer"><span>{links?.total ? `${(page - 1) * 6 + 1}–${Math.min(page * 6, links.total)} of ${formatNumber(links.total)} links` : 'No links yet'}<span className="shared-note"> · My links · public sharing</span></span><div className="pagination"><button aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>{page} / {totalPages}</span><button aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div></div>
        </section>}
        {view === 'profile' && <ProfilePage user={user} onUserChange={onUserChange} />}
        <footer className="main-footer"><span>Thoughtfully built. Simply connected.</span><span>React + Express + PostgreSQL<span className="footer-dot"> · </span>SYNERRY challenge</span></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    {qr && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setQr(null); }}><div ref={modal} className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title"><button className="icon-button close-modal" aria-label="Close QR code" onClick={() => setQr(null)}><X size={20} /></button><span className="section-kicker">SCAN. CONNECT. GO.</span><h2 id="qr-title">A shortcut in every square.</h2><p>{qr.title || 'Your link, ready to scan and share.'}</p>{qrError ? <div className="qr-failure" role="alert">QR code could not be loaded. Close this dialog and try again.</div> : <img className="qr-image" src={`/api/links/${qr.code}/qr`} alt={`QR code for ${qr.shortUrl}`} onError={() => setQrError(true)} />}<a className="qr-address" href={qr.shortUrl} target="_blank" rel="noreferrer">{qr.shortUrl}</a>{expired(qr) && <p className="form-error">This link has expired and will not redirect.</p>}<a className="button primary" href={`/api/links/${qr.code}/qr?download=1`} download={`link-${qr.code}.png`}><ArrowDownToLine size={17} />Download QR code</a><p className="qr-caption">PNG · 512 × 512 · Scan with your phone camera</p></div></div>}
  </div>;
}
