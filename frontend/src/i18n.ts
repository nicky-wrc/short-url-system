import { messages } from './locales/messages';

export type Language = 'en' | 'th';
const key = 'linkstudio.language';
let language: Language = 'en';
try { if (localStorage.getItem(key) === 'th') language = 'th'; } catch { /* Memory-only preference. */ }
document.documentElement.lang = language;
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB';
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function update(value: string | null) {
  const next = value === 'th' ? 'th' : 'en';
  if (next === language) return;
  language = next; document.documentElement.lang = next; listeners.forEach(listener => listener());
}
export function setLanguage(value: Language) {
  update(value); try { localStorage.setItem(key, value); } catch { /* Keep switching usable. */ }
}
window.addEventListener('storage', event => { if (event.key === key || event.key === null) update(event.newValue); });

// Translate product copy only. User names, titles, destinations, tags and chat messages stay untouched.
const reverse = new Map(Object.entries(messages).flatMap(([source, value]) =>
  (typeof value === 'string' ? [value] : value).map(text => [text, source] as const)));
export function t(source: string, values: readonly unknown[] = []): string {
  const canonical = Object.hasOwn(messages, source) ? source : reverse.get(source) ?? source;
  const entry = Object.hasOwn(messages, canonical) ? messages[canonical] : undefined;
  const translated = entry ? typeof entry === 'string' ? language === 'th' ? entry : canonical : entry[language === 'th' ? 1 : 0] : canonical;
  return translated.replace(/\{(\d+)\}/g, (match, index) => values[Number(index)] === undefined ? match : String(values[Number(index)]));
}
