import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackProvider } from './components/FeedbackContext';
import './index.css';
import { applyTheme, getStoredThemeMode } from './utils/themeManager';

applyTheme(getStoredThemeMode());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FeedbackProvider>
        <App />
      </FeedbackProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
