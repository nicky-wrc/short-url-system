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
export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(function PromptInput(
  { value, onChange, onSubmit, onStop, busy, disabled }, ref,
) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!area.current) return;
    area.current.style.height = 'auto';
    area.current.style.height = `${Math.min(120, Math.max(value ? 72 : 44, area.current.scrollHeight))}px`;
  }, [value]);
  function submit(event: FormEvent) { event.preventDefault(); if (!busy && !disabled && value.trim()) onSubmit(); }
  return <form className="ai-composer" data-expanded={!!value} onSubmit={submit}>
    <label className="sr-only" htmlFor="ai-question">ถามผู้ช่วย Link Studio</label>
    <textarea id="ai-question" ref={node => { area.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }}
      value={value} onChange={event => onChange(event.target.value)} maxLength={1000} disabled={busy || disabled}
      placeholder="ถามอะไรได้เลย…" rows={1} aria-describedby="ai-composer-hint"
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && !disabled && value.trim()) onSubmit(); } }} />
    <div className="ai-composer-tools">{value.length > 800 && <span className="ai-character-count">{value.length}/1,000</span>}
      {busy ? <button key="stop" type="button" className="ai-send" onClick={event => { event.preventDefault(); onStop(); }} aria-label="หยุดรอคำตอบ"><Square size={17} /></button>
        : <button key="send" type="submit" className="ai-send" disabled={disabled || !value.trim()} aria-label="ส่งคำถาม"><ArrowUp size={20} /></button>}
    </div>
    <p id="ai-composer-hint" className="sr-only">Enter ส่ง · Shift + Enter ขึ้นบรรทัดใหม่ · สูงสุด 1,000 ตัวอักษร</p>
  </form>;
});
