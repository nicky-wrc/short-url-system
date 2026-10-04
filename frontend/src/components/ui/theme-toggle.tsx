import { t } from '../../i18n';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
declare global {
    interface Window {
        linkStudioTheme: {
            get: () => 'dark' | 'light';
            set: (theme: 'dark' | 'light') => void;
            subscribe: (listener: () => void) => () => void;
        };
    }
}
export function ThemeToggle({ className = '' }: {
    className?: string;
}) {
    const store = window.linkStudioTheme;
    const theme = useSyncExternalStore(store.subscribe, store.get, store.get);
    const light = theme === 'light';
    return <button type="button" role="switch" aria-checked={light} aria-label={t("Light mode")} title={light ? t("Switch to dark mode") : t("Switch to light mode")} className={`theme-toggle ${className}`} onClick={() => store.set(light ? 'dark' : 'light')}>
    <span className="theme-toggle-track" aria-hidden="true">
      <span className="theme-toggle-icon theme-toggle-moon"><Moon size={16} strokeWidth={1.5}/></span>
      <span className="theme-toggle-icon theme-toggle-sun"><Sun size={16} strokeWidth={1.5}/></span>
      <span className="theme-toggle-thumb"><span>{light ? <Sun size={16} strokeWidth={1.5}/> : <Moon size={16} strokeWidth={1.5}/>}</span></span>
    </span>
  </button>;
}
