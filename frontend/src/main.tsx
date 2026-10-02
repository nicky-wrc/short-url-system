import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthApp } from './AuthApp';
import { LinkPreviewPage } from './LinkPreviewPage';
import './styles.css';
import './theme.css';
const preview = window.location.pathname.match(/^\/preview\/([^/]+)\/?$/);
let previewCode = preview?.[1] ?? '';
try { previewCode = decodeURIComponent(previewCode); } catch { previewCode = ''; }
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{preview ? <LinkPreviewPage code={previewCode} /> : <AuthApp />}</React.StrictMode>,
);
