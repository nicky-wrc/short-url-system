import { t } from '../../i18n';
import { forwardRef, useEffect, useRef, type FormEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
interface PromptInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onStop: () => void;
    busy: boolean;
    disabled: boolean;
}
// Adapt the supplied composer to existing CSS tokens and real text-only capabilities.
// No simulated speech, decorative model choices, attachment uploads or extra libraries.
export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(function PromptInput({ value, onChange, onSubmit, onStop, busy, disabled }, ref) {
    const area = useRef<HTMLTextAreaElement | null>(null);
    useEffect(() => {
        if (!area.current)
            return;
        area.current.style.height = 'auto';
        area.current.style.height = `${Math.min(120, Math.max(value ? 72 : 44, area.current.scrollHeight))}px`;
    }, [value]);
    function submit(event: FormEvent) { event.preventDefault(); if (!busy && !disabled && value.trim())
        onSubmit(); }
    return <form className="ai-composer" data-expanded={!!value} onSubmit={submit}>
    <label className="sr-only" htmlFor="ai-question">{t("\u0E16\u0E32\u0E21\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22 Link Studio")}</label>
    <textarea id="ai-question" ref={node => { area.current = node; if (typeof ref === 'function')
        ref(node);
    else if (ref)
        ref.current = node; }} value={value} onChange={event => onChange(event.target.value)} maxLength={1000} disabled={busy || disabled} placeholder={t("\u0E16\u0E32\u0E21\u0E2D\u0E30\u0E44\u0E23\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22\u2026")} rows={1} aria-describedby="ai-composer-hint" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        if (!busy && !disabled && value.trim())
            onSubmit();
    } }}/>
    <div className="ai-composer-tools">{value.length > 800 && <span className="ai-character-count">{value.length}/1,000</span>}
      {busy ? <button key="stop" type="button" className="ai-send" onClick={event => { event.preventDefault(); onStop(); }} aria-label={t("\u0E2B\u0E22\u0E38\u0E14\u0E23\u0E2D\u0E04\u0E33\u0E15\u0E2D\u0E1A")}><Square size={17}/></button>
            : <button key="send" type="submit" className="ai-send" disabled={disabled || !value.trim()} aria-label={t("\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E16\u0E32\u0E21")}><ArrowUp size={20}/></button>}
    </div>
    <p id="ai-composer-hint" className="sr-only">{t("Enter \u0E2A\u0E48\u0E07 \u00B7 Shift + Enter \u0E02\u0E36\u0E49\u0E19\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E43\u0E2B\u0E21\u0E48 \u00B7 \u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 1,000 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23")}</p>
  </form>;
});
