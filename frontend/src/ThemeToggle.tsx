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
export function ThemeToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const store = window.linkStudioTheme;
  const theme = useSyncExternalStore(store.subscribe, store.get, store.get);
  const light = theme === 'light';
  const Icon = light ? Sun : Moon;
  return <button type="button" role="switch" aria-checked={light} aria-label="Light mode"
    title={light ? 'Switch to dark mode' : 'Switch to light mode'}
    className={`theme-toggle ${compact ? 'theme-toggle--compact' : ''} ${className}`}
    onClick={() => store.set(light ? 'dark' : 'light')}>
    <Icon size={19} aria-hidden="true" />
    {!compact && <><span>{light ? 'Light mode' : 'Dark mode'}</span><span className="theme-switch-track" aria-hidden="true"><span /></span></>}
  </button>;
}
