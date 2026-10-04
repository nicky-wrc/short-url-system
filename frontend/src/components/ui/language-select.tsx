import { useSyncExternalStore } from 'react';
import { Languages } from 'lucide-react';
import { getLanguage, setLanguage, subscribeLanguage, t, type Language } from '../../i18n';

export function LanguageSelect() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return <label className="language-select"><Languages size={17} aria-hidden="true" />
    <span className="sr-only">{t('Language')}</span>
    <select aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value as Language)}>
      <option value="en" lang="en">EN</option><option value="th" lang="th">ไทย</option>
    </select>
  </label>;
}
