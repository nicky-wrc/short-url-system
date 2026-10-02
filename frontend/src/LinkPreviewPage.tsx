import MorphLoading from './components/ui/morph-loading';
import { InteractiveHoverButton, InteractiveHoverLink } from './components/ui/interactive-hover-button';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, Globe2, Link2 } from 'lucide-react';
import { api, type LinkPreview } from './api';
import { formatExpiry } from './time';

export function LinkPreviewPage({ code }: { code: string }) {
  const [link, setLink] = useState<LinkPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const [continueError, setContinueError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [continuing, setContinuing] = useState(false);
  const [copying, setCopying] = useState(false);
  const continueLock = useRef(false);
  const copyLock = useRef(false);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setLink(null); setNotice(''); setContinueError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    void api<LinkPreview>(`/links/${encodeURIComponent(code)}/preview`, { signal: controller.signal })
      .then(value => { if (current) { setNow(Date.now()); setLink(value); } })
      .catch(reason => { if (current) setError(reason.name === 'AbortError' ? 'The request timed out. Please try again.' : reason.message); })
      .finally(() => { clearTimeout(timeout); if (current) setLoading(false); });
    return () => { current = false; clearTimeout(timeout); controller.abort(); };
  }, [code, attempt]);

  useEffect(() => {
    if (!link?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [link]);

  useEffect(() => {
    // A browser may restore this page from its back/forward cache after leaving.
    const onPageShow = () => { continueLock.current = false; setContinuing(false); setNow(Date.now()); };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const disabled = link?.isActive === false || link?.status === 'disabled';
  const expired = link?.status === 'expired' || (!!link?.expiresAt && new Date(link.expiresAt).getTime() <= now);
  async function continueToWebsite(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (!link || continueLock.current) return;
    if (!link.isActive || link.status === 'disabled' || link.status === 'expired' || (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now())) { setNow(Date.now()); return; }
    continueLock.current = true; setContinuing(true); setNotice(''); setContinueError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      // Metadata reads never count. This gives stale previews immediate feedback;
      // the real redirect still rechecks under a row lock before recording an event.
      const latest = await api<LinkPreview>(`/links/${encodeURIComponent(code)}/preview`, { signal: controller.signal });
      setLink(latest); setNow(Date.now());
      if (!latest.isActive || latest.status !== 'active' || (latest.expiresAt && new Date(latest.expiresAt).getTime() <= Date.now())) {
        continueLock.current = false; setContinuing(false); return;
      }
      window.location.assign(latest.shortUrl);
    } catch (reason) {
      continueLock.current = false; setContinuing(false);
      setContinueError((reason as Error).name === 'AbortError' ? 'Status check timed out. Please try again.' : (reason as Error).message);
    } finally { clearTimeout(timeout); }
  }
  async function copyPreview() {
    if (!link || copyLock.current) return;
    copyLock.current = true; setCopying(true);
    try { await navigator.clipboard.writeText(link.previewUrl); setNotice('Preview link copied. Recipients can check the destination first.'); }
    catch { setNotice('Clipboard unavailable. Select and copy the preview address below.'); }
    finally { copyLock.current = false; setCopying(false); }
  }

  return <div className="preview-shell">
    <header className="preview-header"><a href="/" className="brand" aria-label="Link Studio home"><span className="brand-icon"><Link2 size={23} /></span><span>link<span className="brand-light">studio</span>.</span></a><span>LINK PREVIEW</span></header>
    <main className="preview-main">
      <section className="panel preview-card" aria-busy={loading}>
        <span className="section-kicker">CHECK YOUR DESTINATION</span>
        <h1>Link preview</h1>
        {loading ? <p className="preview-loading" role="status"><MorphLoading />Loading link details…</p> : error ?
          <div className="preview-error" role="alert"><h2>Preview unavailable</h2><p>{error}</p><InteractiveHoverButton className="button preview-secondary" onClick={() => setAttempt(attempt + 1)}>Try again</InteractiveHoverButton></div> : link && <>
            {link.title && <h2 className="preview-title">{link.title}</h2>}
            <div className="preview-destination"><Globe2 size={24} /><div><span>DESTINATION DOMAIN</span><strong>{link.destinationHost}</strong></div></div>
            <dl className="preview-details"><div><dt>Full destination URL</dt><dd><details className="destination-details preview-full-url"><summary>View full URL</summary><p>{link.originalUrl}</p></details></dd></div><div><dt>Status</dt><dd>{disabled ? 'Disabled — the owner has paused this link' : expired ? 'Expired — this link will not redirect' : 'Active'}</dd></div><div><dt>Expires</dt><dd>{formatExpiry(link.expiresAt)}</dd></div></dl>
            <p className="preview-disclaimer">This shows the saved destination, not a safety rating. Only continue if you recognize and trust this website.</p>
            <div className="preview-actions">{disabled || expired ? <InteractiveHoverButton className="button primary" disabled>{disabled ? 'Link disabled' : 'Link expired'}</InteractiveHoverButton> : <InteractiveHoverLink className="button primary preview-continue" href={link.shortUrl} rel="noreferrer" aria-disabled={continuing} tabIndex={continuing ? -1 : undefined} onClick={event => void continueToWebsite(event)}>{continuing ? <>Opening website…<MorphLoading size="sm" /></> : <>Continue to website <ArrowUpRight size={17} /></>}</InteractiveHoverLink>}<InteractiveHoverButton className="button preview-secondary" disabled={copying || continuing} onClick={() => void copyPreview()}>{copying ? <MorphLoading size="sm" /> : <Copy size={17} />}{copying ? 'Copying…' : 'Copy preview link'}</InteractiveHoverButton></div>
            {continueError && <p className="form-error" role="alert">{continueError}</p>}
            {continuing && <p className="preview-loading" role="status">Opening the short link and checking its current status…</p>}
            <p className="preview-count-note">Viewing this preview and checking status do not count as an opening. Only a successful redirect records an opening.</p>
            <p className="preview-share-address">{link.previewUrl}</p>
          </>}
        {notice && <p className="preview-notice" role="status"><Check size={16} />{notice}</p>}
      </section>
      <a href="/" className="preview-back"><ArrowLeft size={16} />Back to My links / Log in</a>
    </main>
  </div>;
}
