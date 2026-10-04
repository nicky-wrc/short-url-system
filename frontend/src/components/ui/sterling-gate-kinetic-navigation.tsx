import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { t } from '../../i18n';

export interface KineticNavigationItem {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
}
interface Props {
  items: readonly KineticNavigationItem[];
  activeId: string;
  brand: ReactNode;
  preferences: ReactNode;
  account: ReactNode;
  footer: (close: () => void) => ReactNode;
  onNavigate: (id: string) => void;
}

function MenuSwitch({ open, onClick }: { open: boolean; onClick: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return <button type="button" className="kinetic-menu-toggle" data-open={open} aria-label={t(open ? 'Close navigation' : 'Open navigation')} aria-expanded={open} aria-controls="kinetic-menu" aria-haspopup="dialog" onClick={onClick}>
    <span className="kinetic-toggle-copy" aria-hidden="true"><span>{t('Menu')}</span><span>{t('Close')}</span></span>
    <Plus size={22} aria-hidden="true" />
  </button>;
}

// Reference shapes use theme colors and respond equally to pointer and keyboard focus.
function BackgroundShape({ kind }: { kind: number }) {
  const element = 'kinetic-shape-element';
  return <svg key={kind} viewBox="0 0 400 400" fill="none" aria-hidden="true">
    {kind === 0 && <>{[[80,120,40],[300,80,60],[200,300,80],[350,280,30]].map(([cx,cy,r],index) => <circle key={index} className={element} cx={cx} cy={cy} r={r} fill="currentColor" />)}</>}
    {kind === 1 && <><path className={element} d="M0 200 Q100 100 200 200 T400 200" stroke="currentColor" strokeWidth="50"/><path className={element} d="M0 280 Q100 180 200 280 T400 280" stroke="currentColor" strokeWidth="30"/></>}
    {kind === 2 && <>{Array.from({length:12},(_,i) => <circle key={i} className={element} cx={60 + i % 4 * 90} cy={80 + Math.floor(i / 4) * 110} r={10 + i % 3 * 3} fill="currentColor" />)}</>}
    {kind === 3 && <><path className={element} d="M100 100 Q150 50 200 100 Q250 150 200 200 Q150 250 100 200 Q50 150 100 100" fill="currentColor"/><path className={element} d="M250 200 Q300 150 350 200 Q400 250 350 300 Q300 350 250 300 Q200 250 250 200" fill="currentColor"/></>}
    {kind === 4 && <>{[0,1,2].map(i => <line key={i} className={element} x1={i * 100} y1={i === 0 ? 100 : 0} x2={i === 0 ? 300 : 400} y2={400 - i * 100} stroke="currentColor" strokeWidth={30 - i * 5} />)}</>}
  </svg>;
}

export function SterlingGateKineticNavigation({ items, activeId, brand, preferences, account, footer, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(true);
  const activeIndex = Math.max(0, items.findIndex(item => item.id === activeId));
  useEffect(() => { setOpen(false); setShape(activeIndex); }, [activeId, activeIndex]);
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)');
    const reset = () => setOpen(false);
    media.addEventListener('change', reset);
    return () => media.removeEventListener('change', reset);
  }, []);
  useEffect(() => {
    if (!open) return;
    const background = [...document.querySelectorAll<HTMLElement>('.main-wrapper,.ai-launcher,.kinetic-rail,.workspace-mobile-header')];
    const previous = background.map(element => element.inert);
    const overflow = document.body.style.overflow;
    background.forEach(element => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('.kinetic-menu-toggle')?.focus({preventScroll:true});
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select:not(:disabled)') ?? [])].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      background.forEach((element,index) => { element.inert = previous[index]; });
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
      if (restoreFocus.current && opener.current?.isConnected) opener.current.focus({preventScroll:true});
    };
  }, [open]);
  const show = (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    restoreFocus.current = true;
    setShape(activeIndex);
    setOpen(true);
  };
  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    restoreFocus.current = false;
    setOpen(false);
    onNavigate(id);
  };
  return <>
    <aside className="kinetic-rail" aria-label={t('Main navigation')}>
      <a className="kinetic-rail-brand" href="#overview" aria-label={t('Link Studio home')} onClick={event => navigate(event,'overview')}>{brand}</a>
      <MenuSwitch open={false} onClick={show} />
      <nav aria-label={t('Workspace navigation')}>{items.map(item => <a key={item.id} className="kinetic-rail-link" href={item.href} title={item.label} aria-label={item.label} aria-current={item.id === activeId ? 'page' : undefined} onClick={event => navigate(event,item.id)}>{item.icon}</a>)}</nav>
      <a className="kinetic-rail-account" href="#profile" aria-label={t('Profile')} title={t('Profile')} onClick={event => navigate(event,'profile')}>{account}</a>
    </aside>
    <header className="workspace-mobile-header sidebar">
      <div className="workspace-mobile-brand"><MenuSwitch open={false} onClick={show}/><a className="brand" href="#overview" aria-label={t('Link Studio home')} onClick={event => navigate(event,'overview')}>{brand}</a></div>
      <div className="brand-controls">{preferences}</div>
    </header>
    <div className="kinetic-overlay" data-open={open} aria-hidden={!open}>
      <div className="kinetic-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      <aside ref={panel} id="kinetic-menu" className="kinetic-panel" role="dialog" aria-modal={open ? true : undefined} aria-label={t('Workspace navigation')} inert={!open}>
        <div className="kinetic-backdrops" aria-hidden="true"><span/><span/><span/></div>
        <div className="kinetic-menu-surface">
          <header className="kinetic-menu-header"><a href="#overview" className="brand" aria-label={t('Link Studio home')} onClick={event => navigate(event,'overview')}>{brand}</a><MenuSwitch open={true} onClick={() => setOpen(false)}/></header>
          <div className="kinetic-ambient" aria-hidden="true"><BackgroundShape kind={shape}/></div>
          <nav className="kinetic-menu-links" aria-label={t('Main navigation')} onMouseLeave={() => setShape(activeIndex)}>
            {items.map((item,index) => <a key={item.id} href={item.href} className="kinetic-menu-link" aria-current={item.id === activeId ? 'page' : undefined} style={{'--menu-index':index} as CSSProperties} onMouseEnter={() => setShape(index)} onFocus={() => setShape(index)} onClick={event => navigate(event,item.id)}>
              <span className="kinetic-link-number" aria-hidden="true">{String(index + 1).padStart(2,'0')}</span><span className="kinetic-link-label">{item.label}</span><span className="kinetic-link-icon" aria-hidden="true">{item.icon}</span>
              {item.count !== undefined && <span className="kinetic-link-count">{item.count}</span>}
            </a>)}
          </nav>
          <footer className="kinetic-menu-footer">{footer(() => setOpen(false))}</footer>
        </div>
      </aside>
    </div>
  </>;
}
