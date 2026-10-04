import { LanguageSelect } from './components/ui/language-select';
import { t } from './i18n';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BarChart3, Link2, LogOut, PanelLeftClose, PanelLeftOpen, Plus, UserRound, X } from 'lucide-react';
import type { User } from './api';
import { ThemeToggle } from './components/ui/theme-toggle';
import { UserAvatar } from './UserAvatar';
import MorphLoading from './components/ui/morph-loading';
import { InteractiveHoverButton } from './components/ui/interactive-hover-button';
export type WorkspacePage = 'overview' | 'create' | 'links' | 'analytics' | 'profile';
export const workspacePageLabels = { overview: 'Overview', create: 'Create link', links: 'My links', analytics: 'Analytics', profile: 'Profile' };
const pages = ['overview', 'create', 'links', 'analytics', 'profile'] as const;
const icons = { overview: BarChart3, create: Plus, links: Link2, analytics: BarChart3, profile: UserRound };
export function WorkspaceNavigation({ user, view, totalLinks, collapsed, onCollapse, onNavigate, onLogout, loggingOut }: {
    user: User;
    view: WorkspacePage;
    totalLinks?: number;
    collapsed: boolean;
    onCollapse: (value: boolean) => void;
    onNavigate: (page: WorkspacePage) => void;
    onLogout: () => void;
    loggingOut: boolean;
}) {
    const [mobile, setMobile] = useState(() => matchMedia('(max-width: 900px)').matches);
    const [open, setOpen] = useState(false);
    const drawer = useRef<HTMLElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const restoreFocus = useRef(true);
    useEffect(() => {
        const query = matchMedia('(max-width: 900px)');
        const change = () => { setMobile(query.matches); setOpen(false); };
        query.addEventListener('change', change);
        return () => query.removeEventListener('change', change);
    }, []);
    useEffect(() => { setOpen(false); }, [view]);
    useEffect(() => {
        if (!mobile || !open)
            return;
        const background = [...document.querySelectorAll<HTMLElement>('.main-wrapper,.ai-launcher,.workspace-mobile-header')];
        const previous = background.map(element => element.inert);
        const overflow = document.body.style.overflow;
        background.forEach(element => { element.inert = true; });
        document.body.style.overflow = 'hidden';
        drawer.current?.querySelector<HTMLButtonElement>('.navigation-close')?.focus();
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
            }
            if (event.key !== 'Tab')
                return;
            const controls = [...(drawer.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') ?? [])]
                .filter(element => element.getClientRects().length > 0);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', keyboard);
        return () => {
            background.forEach((element, index) => { element.inert = previous[index]; });
            document.body.style.overflow = overflow;
            document.removeEventListener('keydown', keyboard);
            if (restoreFocus.current)
                trigger.current?.focus();
        };
    }, [mobile, open]);
    const brand = <><Link2 size={23} aria-hidden="true"/><span className="navigation-brand-text">link<span className="brand-light">studio</span><span className="brand-dot">.</span></span></>;
    return <>
    <header className="workspace-mobile-header sidebar">
      <div className="workspace-mobile-brand"><button ref={trigger} type="button" className="icon-button navigation-trigger" aria-label={t("Open navigation")} aria-expanded={open} aria-controls="workspace-drawer" onClick={() => { restoreFocus.current = true; setOpen(true); }}><PanelLeftOpen size={21} aria-hidden="true"/></button><a href="#overview" className="brand" aria-label={t("Link Studio home")}>{brand}</a></div>
      <div className="brand-controls"><LanguageSelect /><ThemeToggle /></div>
    </header>
    <div className="navigation-scrim" data-open={mobile && open} aria-hidden="true" onClick={() => setOpen(false)}/>
    <aside ref={drawer} id="workspace-drawer" className="sidebar workspace-navigation" data-open={open} data-collapsed={!mobile && collapsed} role={mobile ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined} aria-label={t("Workspace navigation")} inert={mobile && !open}>
      <div className="navigation-layers" aria-hidden="true"><span /><span /></div>
      <div className="navigation-surface">
        <div className="navigation-brand-row"><a href="#overview" className="brand" aria-label={t("Link Studio home")} title="Link Studio" onClick={event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
            event.preventDefault();
            restoreFocus.current = false;
            setOpen(false);
            onNavigate('overview');
        }}>{brand}</a>
          <button type="button" className="icon-button navigation-collapse" aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")} aria-expanded={!collapsed} aria-controls="workspace-nav" onClick={() => onCollapse(!collapsed)}>
            {collapsed ? <PanelLeftOpen size={20}/> : <PanelLeftClose size={20}/>}
          </button>
          <button type="button" className="icon-button navigation-close" aria-label={t("Close navigation")} onClick={() => setOpen(false)}><X size={22}/></button>
        </div>
        <nav id="workspace-nav" aria-label={t("Main navigation")}><p className="nav-label">{t("WORKSPACE")}</p>
          {pages.map((page, index) => {
            const Icon = icons[page];
            return <a key={page} href={`#${page}`} title={t(workspacePageLabels[page])} aria-label={t(workspacePageLabels[page])} aria-current={view === page ? 'page' : undefined} className={`nav-item navigation-link${view === page ? ' active' : ''}`} style={{ '--nav-index': index } as CSSProperties} onClick={event => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                    event.preventDefault();
                    restoreFocus.current = false;
                    setOpen(false);
                    onNavigate(page);
                }}><Icon size={20} aria-hidden="true"/><span className="navigation-label">{t(workspacePageLabels[page])}</span>
            {page === 'links' && <span className="nav-count">{totalLinks ?? '—'}</span>}</a>;
        })}
        </nav>
        <div className="sidebar-account">
          <div className="workspace"><UserAvatar user={user}/><div className="navigation-account-text"><strong title={user.displayName}>{user.displayName || t("My workspace")}</strong><small title={user.email}>{user.email}</small></div></div>
          <InteractiveHoverButton type="button" className="button logout-button" aria-label={loggingOut ? t("Logging out…") : t("Log out")} title={t("Log out")} onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? <MorphLoading size="sm"/> : <LogOut size={18} aria-hidden="true"/>}{(!collapsed || mobile) && <span className="navigation-label">{loggingOut ? t("Logging out…") : t("Log out")}</span>}
          </InteractiveHoverButton>
        </div>
      </div>
    </aside>
  </>;
}
