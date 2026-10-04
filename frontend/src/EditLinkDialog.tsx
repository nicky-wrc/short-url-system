import { t } from './i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { type Link } from './api';
import { InteractiveHoverButton } from './components/ui/interactive-hover-button';
import MorphLoading from './components/ui/morph-loading';
import { TagsInput, parseTags } from './TagsInput';
export type LinkEdit = {
    title?: string;
    originalUrl?: string;
    tags?: string[];
};
export function EditLinkDialog({ link, onClose, onSave, availableTags = [] }: {
    link: Link;
    onClose: () => void;
    onSave: (changes: LinkEdit, signal: AbortSignal) => Promise<void>;
    availableTags?: readonly string[];
}) {
    const [title, setTitle] = useState(link.title);
    const [url, setUrl] = useState(link.originalUrl);
    const [tags, setTags] = useState((link.tags ?? []).join(', '));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const panel = useRef<HTMLDivElement>(null);
    const titleInput = useRef<HTMLInputElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const changed = title.trim() !== link.title || url.trim() !== link.originalUrl || tags !== (link.tags ?? []).join(', ');
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const oldOverflow = document.body.style.overflow;
        const background = [...document.querySelectorAll<HTMLElement>('.sidebar,.main-wrapper')];
        const previousInert = background.map(element => element.inert);
        background.forEach(element => { element.inert = true; });
        document.body.style.overflow = 'hidden';
        titleInput.current?.focus();
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (!lock.current)
                    closeRef.current();
            }
            if (event.key !== 'Tab')
                return;
            const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') ?? [])];
            const first = elements[0], last = elements.at(-1);
            if (!first) {
                event.preventDefault();
                panel.current?.focus();
            }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', keyboard);
        return () => {
            controller.current?.abort();
            document.removeEventListener('keydown', keyboard);
            document.body.style.overflow = oldOverflow;
            background.forEach((element, i) => { element.inert = previousInert[i]; });
            if (previousFocus?.isConnected)
                previousFocus.focus();
        };
    }, []);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (lock.current || !changed)
            return;
        setError('');
        let parsedTags: string[];
        try {
            parsedTags = parseTags(tags);
            const destination = new URL(url.trim());
            if (!['http:', 'https:'].includes(destination.protocol) || !destination.hostname || destination.username || destination.password || destination.href.length > 2048)
                throw new Error('Enter a valid HTTP/HTTPS destination without credentials.');
        }
        catch (reason) {
            setError(reason instanceof TypeError ? 'Enter a valid HTTP/HTTPS destination.' : (reason as Error).message);
            return;
        }
        const request = new AbortController();
        controller.current = request;
        const timer = setTimeout(() => request.abort(), 30000);
        lock.current = true;
        setBusy(true);
        panel.current?.focus();
        try {
            await onSave({ ...(title.trim() !== link.title ? { title: title.trim() } : {}), ...(url.trim() !== link.originalUrl ? { originalUrl: url.trim() } : {}), ...(tags !== (link.tags ?? []).join(', ') ? { tags: parsedTags } : {}) }, request.signal);
        }
        catch (reason) {
            setError((reason as Error).name === 'AbortError' ? t("Saving timed out. The server may have saved your change. Close and reload My links before retrying.") : (reason as Error).message);
        }
        finally {
            clearTimeout(timer);
            lock.current = false;
            setBusy(false);
            controller.current = null;
        }
    }
    return <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !lock.current)
        onClose(); }}>
    <div ref={panel} className="edit-link-modal" role="dialog" aria-modal="true" aria-labelledby="edit-link-title" aria-describedby="edit-link-scope" tabIndex={-1}>
      <InteractiveHoverButton type="button" className="icon-button close-modal" aria-label={t("Close edit link")} disabled={busy} onClick={onClose}><X size={20}/></InteractiveHoverButton>
      <h2 id="edit-link-title">{t("Edit link")}</h2>
      <p id="edit-link-scope">{t("Name and destination changes apply to everyone using this link. Tags stay private. Your short URL and QR stay the same.")}</p>
      <p className="edit-link-address">{link.shortUrl}</p>
      <form onSubmit={event => void submit(event)} aria-busy={busy}>
        <label htmlFor="edit-link-name">{t("Link name")}{' '}<span className="edit-optional">{t("Optional")}</span></label>
        <input ref={titleInput} id="edit-link-name" value={title} maxLength={120} disabled={busy} onChange={event => setTitle(event.target.value)}/>
        <label htmlFor="edit-link-url">{t("Destination URL")}</label>
        <input id="edit-link-url" type="url" inputMode="url" required maxLength={2048} value={url} disabled={busy} onChange={event => setUrl(event.target.value)} aria-describedby="edit-destination-hint"/>
        <p className="field-hint" id="edit-destination-hint">{t("HTTP/HTTPS only. Expiration, enabled status and previous opens stay unchanged.")}</p>
        <TagsInput id="edit-link-tags" value={tags} onChange={setTags} disabled={busy} suggestions={availableTags}/>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="edit-link-actions"><InteractiveHoverButton type="button" className="button" disabled={busy} onClick={onClose}>{t("Cancel")}</InteractiveHoverButton><InteractiveHoverButton type="submit" className="button primary" disabled={busy || !changed}>{busy ? <><MorphLoading size="sm"/>{t("Saving…")}</> : t("Save changes")}</InteractiveHoverButton></div>
      </form>
    </div>
  </div>;
}
