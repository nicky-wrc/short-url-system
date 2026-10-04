import { BarChart3, Link2, LogOut, Plus, UserRound } from 'lucide-react';
import type { User } from './api';
import { t } from './i18n';
import { UserAvatar } from './UserAvatar';
import { LanguageSelect } from './components/ui/language-select';
import { ThemeToggle } from './components/ui/theme-toggle';
import MorphLoading from './components/ui/morph-loading';
import { InteractiveHoverButton } from './components/ui/interactive-hover-button';
import { SterlingGateKineticNavigation } from './components/ui/sterling-gate-kinetic-navigation';

export type WorkspacePage = 'overview' | 'create' | 'links' | 'analytics' | 'profile';
export const workspacePageLabels = { overview:'Overview', create:'Create link', links:'My links', analytics:'Analytics', profile:'Profile' };
const pages = ['overview','create','links','analytics','profile'] as const;
const icons = { overview:BarChart3, create:Plus, links:Link2, analytics:BarChart3, profile:UserRound };

export function WorkspaceNavigation({ user, view, totalLinks, onNavigate, onLogout, loggingOut }: {
  user:User; view:WorkspacePage; totalLinks?:number;
  onNavigate:(page:WorkspacePage) => void; onLogout:() => void; loggingOut:boolean;
}) {
  const brand = <><Link2 size={23} aria-hidden="true"/><span className="navigation-brand-text">link<span className="brand-light">studio</span><span className="brand-dot">.</span></span></>;
  return <SterlingGateKineticNavigation activeId={view} items={pages.map(page => {
    const Icon = icons[page];
    return {id:page,href:`#${page}`,label:t(workspacePageLabels[page]),icon:<Icon size={21} aria-hidden="true"/>,count:page === 'links' ? totalLinks : undefined};
  })} brand={brand} preferences={<><LanguageSelect/><ThemeToggle/></>} account={<UserAvatar user={user}/>} onNavigate={id => onNavigate(id as WorkspacePage)} footer={close => <>
    <div className="kinetic-account-details"><UserAvatar user={user}/><div><strong title={user.displayName}>{user.displayName || t('My workspace')}</strong><small title={user.email}>{user.email}</small></div></div>
    <InteractiveHoverButton className="button kinetic-logout" disabled={loggingOut} onClick={() => { close(); onLogout(); }}>{loggingOut ? <MorphLoading size="sm"/> : <LogOut size={18} aria-hidden="true"/>}{t(loggingOut ? 'Logging out…' : 'Log out')}</InteractiveHoverButton>
  </>} />;
}
