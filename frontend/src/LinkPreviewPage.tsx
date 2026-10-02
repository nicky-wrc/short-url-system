import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, Globe2, Link2, Loader2 } from 'lucide-react';
import { api, type LinkPreview } from './api';
import { formatExpiry } from './time';

export function LinkPreviewPage({ code }: { code: string }) {
  const [link, setLink] = useState<LinkPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [continuing, setContinuing] = useState(false);
  const [copying, setCopying] = useState(false);
  const continueLock = useRef(false);
  const copyLock = useRef(false);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setLink(null); setNotice('');
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

  const expired = link?.status === 'expired' || (!!link?.expiresAt && new Date(link.expiresAt).getTime() <= now);
  function continueToWebsite(event: MouseEvent<HTMLAnchorElement>) {
    if (!link || continueLock.current) { event.preventDefault(); return; }
    // Recheck locally for UX; the redirect backend remains authoritative.
    if (link.status === 'expired' || (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now())) {
      event.preventDefault(); setNow(Date.now()); return;
    }
    continueLock.current = true; setContinuing(true);
    // Let the browser follow href normally; never navigate directly to originalUrl.
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
        <span className="section-kicker">CHECK THE DESTINATION BEFORE YOU GO</span>
        <h1>A little look before the leap.</h1>
        {loading ? <p className="preview-loading" role="status"><Loader2 className="spin" size={20} />Loading link details…</p> : error ?
          <div className="preview-error" role="alert"><h2>Preview unavailable</h2><p>{error}</p><button className="button preview-secondary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div> : link && <>
            {link.title && <h2 className="preview-title">{link.title}</h2>}
            <div className="preview-destination"><Globe2 size={24} /><div><span>DESTINATION DOMAIN</span><strong>{link.destinationHost}</strong></div></div>
            <dl className="preview-details"><div><dt>Full destination URL</dt><dd>{link.originalUrl}</dd></div><div><dt>Status</dt><dd>{expired ? 'Expired — this link will not redirect' : 'Active'}</dd></div><div><dt>Expires</dt><dd>{formatExpiry(link.expiresAt)}</dd></div></dl>
            <p className="preview-disclaimer">This shows the saved destination, not a safety rating. Only continue if you recognize and trust this website.</p>
            <div className="preview-actions">{expired ? <button className="button primary" disabled>Link expired</button> : <a className="button primary preview-continue" href={link.shortUrl} rel="noreferrer" aria-disabled={continuing} tabIndex={continuing ? -1 : undefined} onClick={continueToWebsite}>{continuing ? <>Opening website…<Loader2 className="spin" size={17} /></> : <>Continue to website <ArrowUpRight size={17} /></>}</a>}<button className="button preview-secondary" disabled={copying || continuing} onClick={() => void copyPreview()}><Copy size={17} />{copying ? 'Copying…' : 'Copy preview link'}</button></div>
            {continuing && <p className="preview-loading" role="status">Opening the short link and checking its current status…</p>}
            <p className="preview-count-note">Viewing this preview does not count as an opening. Continuing uses the short link and records an opening.</p>
            <p className="preview-share-address">{link.previewUrl}</p>
          </>}
        {notice && <p className="preview-notice" role="status"><Check size={16} />{notice}</p>}
      </section>
      <a href="/" className="preview-back"><ArrowLeft size={16} />Back to My links / Log in</a>
    </main>
  </div>;
}
