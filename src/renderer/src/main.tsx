import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackProvider } from './components/FeedbackContext';
import './index.css';
import { applyTheme, getStoredThemeMode } from './utils/themeManager';

applyTheme(getStoredThemeMode());

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = `[window.error] ${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ''}`;
    console.error(msg);
    try {
      (window as any).mypostAPI?.writeDebugLog?.(msg);
    } catch {}
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = `[unhandledrejection] ${e.reason?.message || e.reason}\n${e.reason?.stack || ''}`;
    console.error(msg);
    try {
      (window as any).mypostAPI?.writeDebugLog?.(msg);
    } catch {}
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
