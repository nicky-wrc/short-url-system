import React, { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from './i18n';
import ReactDOM from 'react-dom/client';
import { AuthApp } from './AuthApp';
import { LinkPreviewPage } from './LinkPreviewPage';
import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import './styles.css';
import './theme.css';
const preview = window.location.pathname.match(/^\/preview\/([^/]+)\/?$/);
let previewCode = preview?.[1] ?? '';
try { previewCode = decodeURIComponent(previewCode); } catch { previewCode = ''; }
function LocalizedView() {
  useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return preview ? <LinkPreviewPage code={previewCode} /> : <AuthApp />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><LocalizedView /></React.StrictMode>,
);
