import { useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'mypost_theme_mode';

/**
 * Get current stored theme mode, default to the workspace light palette.
 */
export function getStoredThemeMode(): ThemeMode {
  const val = localStorage.getItem(THEME_STORAGE_KEY);
  if (val === 'light' || val === 'dark' || val === 'system') {
    return val;
  }
  return 'light';
}

/**
 * Determine whether dark mode should be active based on mode and system preferences
 */
export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply theme to document element
 */
export function applyTheme(mode: ThemeMode) {
  const isDark = resolveIsDark(mode);
  const root = document.documentElement;
  if (isDark) {
    root.classList.remove('light');
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

/**
 * React hook to observe and change theme mode
 */
export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode);
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>(() =>
    resolveIsDark(getStoredThemeMode()) ? 'dark' : 'light'
  );

  const setThemeMode = (newMode: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
    setThemeModeState(newMode);
    applyTheme(newMode);
    setActiveTheme(resolveIsDark(newMode) ? 'dark' : 'light');
  };

  useEffect(() => {
    // Initial application
    applyTheme(themeMode);
    setActiveTheme(resolveIsDark(themeMode) ? 'dark' : 'light');

    // Listen to system theme changes when in 'system' mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = getStoredThemeMode();
      if (current === 'system') {
        applyTheme('system');
        setActiveTheme(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  return { themeMode, setThemeMode, activeTheme };
}
