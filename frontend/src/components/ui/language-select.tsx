import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { getLanguage, setLanguage, subscribeLanguage, t, type Language } from '../../i18n';

const choices: readonly { value: Language; label: string; short: string }[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'th', label: 'ไทย', short: 'ไทย' },
];

export function LanguageSelect() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const nextFocus = useRef(0);
  useEffect(() => {
    if (!open) return;
    options.current[nextFocus.current]?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const show = (index = choices.findIndex(choice => choice.value === language)) => {
    nextFocus.current = index;
    setOpen(true);
  };
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
      (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
    options.current[next]?.focus();
  };
  return <div ref={root} className="language-select" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="language-trigger" aria-label={`${t('Language')}: ${language === 'en' ? 'English' : 'ไทย'}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => open ? close() : show()} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); show(event.key === 'ArrowDown' ? 0 : choices.length - 1);
        }
      }}>
      <Languages size={16} aria-hidden="true" /><span>{choices.find(choice => choice.value === language)?.short}</span><ChevronDown size={14} className="language-chevron" aria-hidden="true" />
    </button>
    {open && <div id={menuId} className="language-menu" role="menu" aria-label={t('Language')} onKeyDown={keyboard}>
      {choices.map((choice, index) => <button key={choice.value} ref={element => { options.current[index] = element; }} type="button" role="menuitemradio" aria-checked={language === choice.value} lang={choice.value} tabIndex={-1}
        onClick={() => { setLanguage(choice.value); close(); }}>
        <span className="language-code" aria-hidden="true">{choice.value.toUpperCase()}</span><span>{choice.label}</span>{language === choice.value && <Check size={16} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
