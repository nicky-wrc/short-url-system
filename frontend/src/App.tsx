import { LanguageSelect } from './components/ui/language-select';
import { t, getLocale } from './i18n';
import { ThemeToggle } from './components/ui/theme-toggle';
import { WorkspaceNavigation, workspacePageLabels, type WorkspacePage } from './WorkspaceNavigation';
import MorphLoading from './components/ui/morph-loading';
import { InteractiveHoverButton, InteractiveHoverLink } from './components/ui/interactive-hover-button';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronLeft, ChevronRight, Copy, Eye, ExternalLink, Globe2, Link2, Plus, QrCode, Search, Sparkles, Pencil, X } from 'lucide-react';
import { api, type Link, type LinkPage, type Stats, type User, clearAuthToken } from './api';
import { ProfilePage } from './ProfilePage';
import { AssistantChat } from './AssistantChat';
import { EditLinkDialog, type LinkEdit } from './EditLinkDialog';
import { TagsInput, parseTags } from './TagsInput';
import { formatExpiry, localTimeZone } from './time';
type ExpiryPreset = 'none' | '1h' | '1d' | '7d' | 'custom';
const formatNumber = (n: number) => new Intl.NumberFormat(getLocale()).format(n);
const formatDate = (date: string) => new Date(date).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
const expired = (link: Link) => !!link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now();
const linkStatus = (link: Link) => !link.isActive ? 'disabled' : expired(link) ? 'expired' : 'active';
const statusLabel = (link: Link) => ({ active: t("Active"), disabled: t("Disabled"), expired: t("Expired") })[linkStatus(link)];
export function App({ user, onLogout, loggingOut, onUserChange }: {
    user: User;
    onLogout: () => void;
    loggingOut: boolean;
    onUserChange: (user: User | null) => void;
}) {
    type Page = WorkspacePage;
    const pageLabels = workspacePageLabels;
    const readPage = (): Page => Object.hasOwn(pageLabels, location.hash.slice(1)) ? location.hash.slice(1) as Page : 'overview';
    const [view, setView] = useState<Page>(readPage);
    useEffect(() => { const changed = () => { setView(readPage()); window.scrollTo({ top: 0 }); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
    function navigate(page: Page) {
        location.hash = page;
        setView(page);
        window.scrollTo({ top: 0 });
        requestAnimationFrame(() => {
            if (page === 'create')
                urlInput.current?.focus({ preventScroll: true });
            else
                document.querySelector<HTMLElement>('.workspace-content')?.focus({ preventScroll: true });
        });
    }
    const pageTitles = pageLabels;
    const descriptions = { overview: t("Your links and recorded opens, in one place."), create: t("Choose a destination and set how long your link stays available."), links: t("Search, share and manage the links you own."), analytics: t("Recorded redirects, not unique visitors. All chart dates use UTC."), profile: t("Manage your personal details and account security.") };
    const [links, setLinks] = useState<LinkPage | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [changingCode, setChangingCode] = useState<string | null>(null);
    const [statusError, setStatusError] = useState('');
    const statusLock = useRef<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [tagDraft, setTagDraft] = useState('');
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
    const [editing, setEditing] = useState<Link | null>(null);
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
        if (statusLock.current)
            return;
        const id = ++requestId.current;
        if (!quiet)
            setLoading(true);
        try {
            const [list, summary, tagList] = await Promise.all([api<LinkPage>(`/links?page=${view === 'overview' ? 1 : page}&limit=6&q=${encodeURIComponent(view === 'overview' ? '' : debouncedSearch)}${view === 'links' && selectedTag ? `&tag=${encodeURIComponent(selectedTag)}` : ''}`), api<Stats>('/stats'), api<{
                    tags: string[];
                }>('/tags')]);
            if (id !== requestId.current)
                return;
            setLinks(list);
            setStats(summary);
            setAvailableTags(tagList.tags);
            setLoadError('');
        }
        catch (error) {
            if (id === requestId.current)
                setLoadError((error as Error).message);
        }
        finally {
            if (id === requestId.current)
                setLoading(false);
        }
    }, [page, debouncedSearch, view, selectedTag]);
    useEffect(() => { void refresh(); return () => { requestId.current++; }; }, [refresh]);
    useEffect(() => {
        const timer = setInterval(() => { if (!document.hidden)
            void refresh(true); }, 15000);
        const onFocus = () => { void refresh(true); };
        window.addEventListener('focus', onFocus);
        return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
    }, [refresh]);
    useEffect(() => { if (!notice)
        return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
    useEffect(() => { if (!copied)
        return; const timer = setTimeout(() => setCopied(''), 2000); return () => clearTimeout(timer); }, [copied]);
    useEffect(() => {
        if (!qr)
            return;
        previousFocus.current = document.activeElement as HTMLElement;
        setQrError(false);
        const bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        modal.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setQr(null);
            if (e.key === 'Tab') {
                const focusable = modal.current?.querySelectorAll<HTMLElement>('button, a[href]');
                const first = focusable?.[0], last = focusable?.[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = bodyOverflow; previousFocus.current?.focus(); };
    }, [qr]);
    async function copy(link: Link) {
        try {
            await navigator.clipboard.writeText(link.shortUrl);
            setCopied(link.code);
            setNotice(t("Short link copied to clipboard."));
        }
        catch {
            setNotice(t("Clipboard unavailable. Select and copy the short link manually."));
        }
    }
    async function create(e: FormEvent) {
        e.preventDefault();
        setCreating(true);
        setCreateError('');
        try {
            if (expiryPreset === 'custom' && (!expiry || !Number.isFinite(new Date(expiry).getTime()) || new Date(expiry).getTime() <= Date.now()))
                throw new Error(t("Choose a future date and time for custom expiry."));
            const link = await api<Link>('/links', { method: 'POST', body: JSON.stringify({
                    originalUrl: url, title, tags: parseTags(tagDraft), ...(alias.trim() ? { customAlias: alias.trim() } : {}),
                    expiryPreset, ...(expiryPreset === 'custom' ? { expiresAt: new Date(expiry).toISOString() } : {}),
                }) });
            setCreated(link);
            setUrl('');
            setTitle('');
            setAlias('');
            setTagDraft('');
            setExpiry('');
            setExpiryPreset('none');
            setPage(1);
            if (page === 1)
                await refresh(true);
            setNotice(t("Your short link is ready to share."));
        }
        catch (error) {
            setCreateError((error as Error).message);
        }
        finally {
            setCreating(false);
        }
    }
    async function setLinkActive(link: Link, isActive: boolean) {
        if (statusLock.current)
            return;
        statusLock.current = link.code;
        setChangingCode(link.code);
        setStatusError('');
        // Discard older reads; keep the displayed state until the server confirms it.
        requestId.current++;
        try {
            const updated = await api<Link>(`/links/${encodeURIComponent(link.code)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
            setLinks(current => current && { ...current, items: current.items.map(item => item.code === updated.code ? updated : item) });
            setQr(current => current?.code === updated.code ? updated : current);
            setCreated(current => current?.code === updated.code ? updated : current);
            setNotice(!updated.isActive ? t("Link disabled. Its URL, QR and previous opens are preserved.") : updated.status === 'expired' ? t("Link enabled, but still expired. It cannot redirect.") : t("Link enabled. Its original URL and QR work again."));
        }
        catch (reason) {
            setStatusError((reason as Error).message + t(" Refreshing the saved status…"));
        }
        finally {
            statusLock.current = null;
            setChangingCode(null);
            void refresh(true);
        }
    }
    async function editLink(changes: LinkEdit, signal: AbortSignal) {
        if (!editing || statusLock.current)
            throw new Error(t("Another update is in progress. Please try again."));
        statusLock.current = editing.code;
        setChangingCode(editing.code);
        requestId.current++;
        try {
            const updated = await api<Link>(`/links/${encodeURIComponent(editing.code)}`, { method: 'PATCH', body: JSON.stringify(changes), signal });
            setLinks(current => current && { ...current, items: current.items.map(item => item.code === updated.code ? updated : item) });
            setCreated(current => current?.code === updated.code ? updated : current);
            setEditing(null);
            setNotice(t("Link updated. Your short URL and QR stay the same."));
        }
        finally {
            statusLock.current = null;
            setChangingCode(null);
            void refresh(true);
        }
    }
    async function downloadCsv() {
        if (exportLock.current)
            return;
        exportLock.current = true;
        setExporting(true);
        setExportError('');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch(`/api/links/export.csv?q=${encodeURIComponent(debouncedSearch)}${selectedTag ? `&tag=${encodeURIComponent(selectedTag)}` : ''}`, { signal: controller.signal });
            if (!response.ok) {
                if (response.status === 401) {
                    clearAuthToken();
                    window.dispatchEvent(new Event('auth-required'));
                }
                const body = await response.json().catch(() => null);
                throw new Error(typeof body?.error === 'string' ? body.error : t("CSV download failed. Please try again."));
            }
            if (!response.headers.get('content-type')?.startsWith('text/csv'))
                throw new Error(t("CSV download failed. Please try again."));
            const blob = await response.blob();
            const href = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = href;
            anchor.download = response.headers.get('content-disposition')?.match(/filename="(my-links-\d{4}-\d{2}-\d{2}\.csv)"/)?.[1] ?? 'my-links.csv';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(href), 1000);
            setNotice(t("My links CSV download started. Empty results contain headers only."));
        }
        catch (error) {
            setExportError((error as Error).name === 'AbortError' ? t("CSV download timed out. Narrow your search or try again.") : (error as Error).message);
        }
        finally {
            clearTimeout(timer);
            exportLock.current = false;
            setExporting(false);
        }
    }
    function focusCreate() { navigate('create'); }
    useEffect(() => { if (view === 'create')
        urlInput.current?.focus(); }, [view]);
    const totalPages = Math.max(1, Math.ceil((links?.total ?? 0) / 6));
    const maxClicks = Math.max(1, ...(stats?.daily.map(d => d.clicks) ?? []));
    return <div className="app-shell" data-navigation="kinetic">
    <WorkspaceNavigation user={user} view={view} totalLinks={stats?.totalLinks} onNavigate={navigate} onLogout={onLogout} loggingOut={loggingOut}/>
    <div className="main-wrapper"><div className="workspace-theme-toolbar"><LanguageSelect /><ThemeToggle /></div>
      <main key={view} className={`workspace-content workspace-content--${view}`} tabIndex={-1}>
        <section className="page-heading"><div><h1>{t(pageTitles[view])}</h1><p>{descriptions[view]}</p></div>{view !== 'profile' && view !== 'create' && <InteractiveHoverButton className="button primary heading-button" onClick={focusCreate}><Plus size={17}/>{t("New link")}</InteractiveHoverButton>}</section>

        {loadError && <div className="error-banner" role="alert"><span>{t("Unable to load workspace:")}{' '}{t(loadError)}</span><InteractiveHoverButton onClick={() => void refresh()}>{t("Retry")}</InteractiveHoverButton></div>}
        {(view === 'overview' || view === 'analytics') && <section className="stats-grid" aria-label={t("Workspace statistics")}>
          {[
                { label: t("Total links"), value: stats?.totalLinks, icon: Link2, detail: t("Owned by you"), color: 'coral' },
                { label: t("Total opens"), value: stats?.totalClicks, icon: ArrowUpRight, detail: t("Recorded redirects"), color: 'blue' },
                { label: t("Opens today"), value: stats?.todayClicks, icon: BarChart3, detail: t("Since midnight · UTC"), color: 'green' },
                { label: t("Active links"), value: stats?.activeLinks, icon: Globe2, detail: t("Enabled and unexpired"), color: 'purple' },
            ].map(card => <article className="stat-card" key={card.label}><div className="stat-top"><span>{card.label}</span><span className={`stat-icon ${card.color}`}><card.icon size={18}/></span></div><strong className="stat-value">{card.value === undefined ? '—' : formatNumber(card.value)}</strong><p>{card.detail}</p></article>)}
        </section>}

        {view === 'create' && <div className="creation-row workspace-page-row">
          {view === 'create' && <section className="panel create-panel" id="create-link">
            <div className="panel-heading"><div><h2>{t("Link details")}</h2></div><span className="section-icon"><Link2 size={22}/></span></div>
            <form onSubmit={create}>
              <label htmlFor="destination">{t("Destination URL")}<span className="required">*</span></label>
              <div className="input-with-icon"><Globe2 size={18}/><input ref={urlInput} id="destination" type="url" placeholder="https://example.com/page" required maxLength={2048} value={url} onChange={e => setUrl(e.target.value)}/></div>
              <p className="field-hint">{t("Paste the full link you want to share, including https://")}</p>
              <div className="expiry-options"><div><label htmlFor="expiry-preset">{t("Link expiration")}</label><select id="expiry-preset" value={expiryPreset} disabled={creating} onChange={e => { setExpiryPreset(e.target.value as ExpiryPreset); setExpiry(''); }} aria-describedby="expiry-hint"><option value="none">{t("No expiration · ไม่หมดอายุ")}</option><option value="1h">{t("1 hour · 1 ชั่วโมง")}</option><option value="1d">{t("1 day · 1 วัน")}</option><option value="7d">{t("7 days · 7 วัน")}</option><option value="custom">{t("Custom date & time · กำหนดเอง")}</option></select><p className="field-hint" id="expiry-hint">{t("Durations start when the server creates your link.")}</p></div>{expiryPreset === 'custom' && <div><label htmlFor="expiry">{t("Expires at (")}{localTimeZone})</label><input id="expiry" type="datetime-local" required disabled={creating} value={expiry} onChange={e => setExpiry(e.target.value)} aria-describedby="custom-expiry-hint"/><p className="field-hint" id="custom-expiry-hint">{t("Enter a future time in")}{localTimeZone}{t(". Stored as UTC.")}</p></div>}</div>
              {advanced && <div className="advanced-fields" id="advanced-options"><div><label htmlFor="title">{t("Link title")}</label><input id="title" placeholder={t("e.g. Product launch")} maxLength={120} value={title} onChange={e => setTitle(e.target.value)}/></div><div><label htmlFor="alias">{t("Custom alias")}</label><input id="alias" placeholder="e.g. launch-2026" pattern="[A-Za-z0-9_-]{4,32}" minLength={4} maxLength={32} value={alias} onChange={e => setAlias(e.target.value)}/><p className="field-hint">{t("4–32 letters, numbers, - or _")}</p></div><TagsInput id="create-link-tags" value={tagDraft} onChange={setTagDraft} disabled={creating} suggestions={availableTags}/></div>}
              <div className="form-bottom"><InteractiveHoverButton type="button" className="advanced-toggle" aria-expanded={advanced} aria-controls="advanced-options" onClick={() => setAdvanced(!advanced)}><Plus size={15} className={advanced ? 'rotate' : ''}/>{t("Link options")}<span>{t("Optional")}</span></InteractiveHoverButton><InteractiveHoverButton className="button primary" disabled={creating}>{creating ? <MorphLoading size="sm"/> : <Sparkles size={16}/>}{creating ? t("Creating…") : t("Shorten link")}{!creating && <ArrowRight size={16}/>}</InteractiveHoverButton></div>
              {createError && <p className="form-error" role="alert">{createError}</p>}
            </form>
            {created && <div className="created-result" role="status"><div className="result-heading"><Check size={17}/><strong>{t("Link created")}</strong><InteractiveHoverButton className="icon-button" aria-label={t("Dismiss created link")} onClick={() => setCreated(null)}><X size={15}/></InteractiveHoverButton></div><p className="expiry-summary">{t("Status:")}{' '}{statusLabel(created)}{' '}{t("· Expires:")}{' '}{formatExpiry(created.expiresAt)}</p><div className="result-link"><a href={created.shortUrl} target="_blank" rel="noreferrer">{created.shortUrl}</a><InteractiveHoverButton className="icon-button" aria-label={t("Copy new short link")} onClick={() => void copy(created)}>{copied === created.code ? <Check size={17}/> : <Copy size={17}/>}</InteractiveHoverButton><InteractiveHoverLink className="icon-button" href={`/preview/${created.code}`} aria-label={t("Preview new short link")} title={t("Preview destination")}><Eye size={18}/></InteractiveHoverLink><InteractiveHoverButton className="icon-button" aria-label={t("Show new QR code")} onClick={() => setQr(created)}><QrCode size={18}/></InteractiveHoverButton></div></div>}
          </section>}

        </div>}

        {(view === 'links' || view === 'overview') && <section className="panel history-panel" id="link-history"><div className="history-heading"><div><h2>{view === 'links' ? t("All your links") : t("Recent links")}<span className="pill">{links?.total ?? '—'}</span></h2><p>{t("Your history is private. Short URLs, Preview and QR are public.")}</p></div>{view === 'links' ? <div className="history-tools"><div className="search-field"><Search size={17}/><input type="search" disabled={!!changingCode} aria-label={t("Search links")} placeholder={t("Search links…")} value={search} onChange={e => setSearch(e.target.value)}/></div><label className="tag-filter">{t("Filter by tag")}<select aria-label={t("Filter links by tag")} value={selectedTag} disabled={loading || !!changingCode || exporting} onChange={event => { setSelectedTag(event.target.value); setPage(1); }}><option value="">{t("All tags")}</option>{[...new Set([...availableTags, ...(selectedTag ? [selectedTag] : [])])].sort().map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label><InteractiveHoverButton className="button csv-download" onClick={() => void downloadCsv()} disabled={exporting || loading || !!changingCode || search !== debouncedSearch || !links} aria-describedby="csv-scope">{exporting ? <MorphLoading size="sm"/> : <ArrowDownToLine size={17}/>}{exporting ? t("Downloading…") : t("ดาวน์โหลด CSV")}</InteractiveHoverButton><p id="csv-scope">{t("ประวัติของคุณ · ทุกหน้าตามคำค้นและ Tag · สูงสุด 10,000 รายการ")}</p></div> : <InteractiveHoverLink href="#links" className="text-button">{t("View all links")}<ArrowRight size={16}/></InteractiveHoverLink>}</div>{exporting && <p className="csv-feedback" role="status">{t("Preparing My links CSV…")}</p>}{exportError && <p className="form-error csv-feedback" role="alert">{t(exportError)}</p>}{statusError && <p className="form-error csv-feedback" role="alert">{t(statusError)}</p>}
          <div className="table-scroll"><table><thead><tr><th>{t("LINK & DESTINATION")}</th><th>{t("CREATED")}</th><th>{t("OPENS")}</th><th>{t("STATUS")}</th><th className="actions-heading">{t("ACTIONS")}</th></tr></thead><tbody>
            {loading ? <tr><td colSpan={5}><div className="empty-state" role="status"><MorphLoading size="md"/><h3>{t("Loading your links…")}</h3></div></td></tr> : loadError && !links ? <tr><td colSpan={5}><div className="empty-state"><h3>{t("Links unavailable")}</h3><p>{t("Retry the connection to load your history.")}</p></div></td></tr> : !links?.items.length ? <tr><td colSpan={5}><div className="empty-state"><span className="empty-icon"><Link2 size={25}/></span><h3>{view === 'links' && (debouncedSearch || selectedTag) ? t("No matching links") : t("No links yet")}</h3><p>{view === 'links' && (debouncedSearch || selectedTag) ? t("Try a different search or tag.") : t("Create a short link to start sharing and tracking opens.")}</p>{(view === 'overview' || (!debouncedSearch && !selectedTag)) && <InteractiveHoverButton className="text-button" onClick={focusCreate}>{t("Create your first link")}<ArrowRight size={15}/></InteractiveHoverButton>}</div></td></tr> : links.items.map(link => <tr key={link.id}><td><div className="link-cell"><span className="link-avatar"><Link2 size={19}/></span><div className="link-details"><a className="short-link" href={link.shortUrl} target="_blank" rel="noreferrer">{link.title || `/${link.code}`}<ArrowUpRight size={13}/></a><div className="short-address">{link.shortUrl}</div>{!!link.tags?.length && <div className="link-tags" aria-label={t("Private tags")}>{link.tags.map(tag => <span className="tag-chip" key={tag}>{tag}</span>)}</div>}<details className="destination-details"><summary title={link.originalUrl}>{link.originalUrl}</summary><p>{link.originalUrl}</p><InteractiveHoverLink href={link.originalUrl} target="_blank" rel="noreferrer" className="text-button">{t("Open destination")}<ExternalLink size={14}/></InteractiveHoverLink></details></div></div></td><td data-label={t("Created")} className="date-cell">{formatDate(link.createdAt)}</td><td data-label={t("Opens")}><span className="click-count"><BarChart3 size={14}/>{formatNumber(link.clicks)}</span></td><td data-label={t("Status")}><span className={`status-pill ${linkStatus(link)}`} title={formatExpiry(link.expiresAt)}><span />{statusLabel(link)}</span><p className="expiry-summary">{formatExpiry(link.expiresAt)}</p><InteractiveHoverButton className="button link-status-button" disabled={!!changingCode} aria-label={t("{0} link {1}", [link.isActive ? t("Disable") : t("Enable"), link.code])} onClick={() => void setLinkActive(link, !link.isActive)}>{changingCode === link.code ? <><MorphLoading size="sm"/>{t("Saving…")}</> : link.isActive ? t("Disable link") : t("Enable link")}</InteractiveHoverButton></td><td className="actions-cell"><div className="row-actions"><InteractiveHoverButton className="icon-button" aria-label={t("Edit link {0}", [link.code])} title={t("Edit name, destination and tags")} disabled={!!changingCode} onClick={() => setEditing(link)}><Pencil size={16}/><span>{t("Edit")}</span></InteractiveHoverButton><InteractiveHoverButton className="icon-button" aria-label={t("Copy link {0}", [link.code])} title={t("Copy short link")} onClick={() => void copy(link)}>{copied === link.code ? <Check size={16}/> : <Copy size={16}/>}<span>{t("Copy")}</span></InteractiveHoverButton><InteractiveHoverButton className="icon-button" aria-label={t("QR code for {0}", [link.code])} title={t("View QR code")} onClick={() => setQr(link)}><QrCode size={17}/><span>QR</span></InteractiveHoverButton><InteractiveHoverLink className="icon-button" href={`/preview/${link.code}`} aria-label={t("Preview link {0}", [link.code])} title={t("Preview destination")}><Eye size={17}/><span>{t("Preview")}</span></InteractiveHoverLink><InteractiveHoverLink className="icon-button" href={link.shortUrl} aria-label={t("Open link {0}", [link.code])} title={t("Open short link")} target="_blank" rel="noreferrer"><ExternalLink size={16}/><span>{t("Open")}</span></InteractiveHoverLink></div></td></tr>)}
          </tbody></table></div>
          {view === 'links' && <div className="table-footer"><span>{loading ? t("Loading…") : loadError && !links ? t("Links unavailable") : links?.total ? t("{0}–{1} of {2} links", [(page - 1) * 6 + 1, Math.min(page * 6, links.total), formatNumber(links.total)]) : debouncedSearch || selectedTag ? t("No matching links") : t("No links yet")}<span className="shared-note">{t("· My links · public sharing")}</span></span><div className="pagination"><InteractiveHoverButton aria-label={t("Previous page")} disabled={page <= 1 || loading || !!changingCode} onClick={() => setPage(page - 1)}><ChevronLeft size={16}/></InteractiveHoverButton><span>{page} / {totalPages}</span><InteractiveHoverButton aria-label={t("Next page")} disabled={page >= totalPages || loading || !!changingCode} onClick={() => setPage(page + 1)}><ChevronRight size={16}/></InteractiveHoverButton></div></div>}
        </section>}
        {(view === 'overview' || view === 'analytics') && <section className="activity-panel" aria-label={t("Daily opens")}><div className="activity-heading"><div><h2>{t("Daily opens")}</h2><p>{t("Last 7 days · UTC")}</p></div><div className="activity-summary"><strong>{stats ? formatNumber(stats.daily.reduce((sum, day) => sum + day.clicks, 0)) : '—'}</strong><span>{t("recorded opens")}</span></div></div>{!stats ? <p className="empty-chart" role="status">{loadError ? t("Statistics unavailable. Retry the connection above.") : t("Loading statistics…")}</p> : !stats.daily.some(day => day.clicks > 0) ? <p className="empty-chart">{t("No recorded opens in the last 7 days. Share a link to start tracking redirects.")}</p> : <div className="bar-chart" role="img" aria-label={t('Daily link opens in UTC: {0}', [stats.daily.map(d => `${d.date}: ${d.clicks}`).join(', ')])}>{stats.daily.map(day => <div className="chart-column" key={day.date}><div className="bar-track"><div className="bar" style={{ height: `${day.clicks / maxClicks * 100}%` }} title={t('{0}: {1} opens', [day.date, formatNumber(day.clicks)])}/></div><span>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString(getLocale(), { weekday: 'short', timeZone: 'UTC' })}</span></div>)}</div>}<p className="chart-caption">{t("Counts successful redirects, including repeated visits. Updates every 15 seconds.")}</p></section>}
        {view === 'profile' && <ProfilePage user={user} onUserChange={onUserChange}/>}

      </main>
    </div>
    {!qr && !editing && <AssistantChat />}
    {editing && <EditLinkDialog key={editing.code} link={editing} availableTags={availableTags} onClose={() => setEditing(null)} onSave={editLink}/>}
    {notice && <div className="toast" role="status"><Check size={17}/>{t(notice)}</div>}
    {qr && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget)
        setQr(null); }}><div ref={modal} className="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title"><InteractiveHoverButton className="icon-button close-modal" aria-label={t("Close QR code")} onClick={() => setQr(null)}><X size={20}/></InteractiveHoverButton><h2 id="qr-title">{t("Share QR code")}</h2><p>{qr.title || t("Your link, ready to scan and share.")}</p>{qrError ? <div className="qr-failure" role="alert">{t("QR code could not be loaded. Close this dialog and try again.")}</div> : <img className="qr-image" src={`/api/links/${qr.code}/qr`} alt={t("QR code for {0}", [qr.shortUrl])} onError={() => setQrError(true)}/>}<a className="qr-address" href={qr.shortUrl} target="_blank" rel="noreferrer">{qr.shortUrl}</a><p className={`qr-status ${linkStatus(qr)}`} role="status">{statusLabel(qr)}{linkStatus(qr) !== 'active' && t(" — this link will not redirect.")}</p><InteractiveHoverLink className="button primary" href={`/api/links/${qr.code}/qr?download=1`} download={`link-${qr.code}.png`}><ArrowDownToLine size={17}/>{t("Download QR code")}</InteractiveHoverLink><p className="qr-caption">{t("PNG · 512 × 512 · Scan with your phone camera")}</p></div></div>}
  </div>;
}
