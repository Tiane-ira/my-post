import { useState, useEffect } from 'react';
import {
  ThemePresetId,
  ThemePreset,
  THEME_PRESETS,
  DEFAULT_THEME_ID,
  DEFAULT_DARK_THEME_ID,
  getThemePreset,
} from './themePresets';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'mypost_theme_mode';
const PRESET_STORAGE_KEY = 'mypost_theme_preset';

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
 * Get current stored theme preset id.
 */
export function getStoredThemePresetId(): ThemePresetId {
  const val = localStorage.getItem(PRESET_STORAGE_KEY) as ThemePresetId;
  const match = THEME_PRESETS.find((p) => p.id === val);
  if (match) return match.id;
  const mode = getStoredThemeMode();
  return mode === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_THEME_ID;
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
 * Apply theme and preset tokens to document element
 */
export function applyTheme(mode: ThemeMode, presetId?: ThemePresetId) {
  const isDark = resolveIsDark(mode);
  const root = document.documentElement;

  // Determine active preset to apply
  let targetPresetId = presetId || getStoredThemePresetId();
  const targetPreset = getThemePreset(targetPresetId);

  // If mode explicitly conflicts with preset type, choose suitable alternative
  if (isDark && targetPreset.type === 'light') {
    targetPresetId = DEFAULT_DARK_THEME_ID;
  } else if (!isDark && targetPreset.type === 'dark') {
    targetPresetId = DEFAULT_THEME_ID;
  }

  // Set data-theme attribute
  root.setAttribute('data-theme', targetPresetId);

  if (isDark) {
    root.classList.remove('light');
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
}

/**
 * React hook to observe and change theme mode and theme preset
 */
export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode);
  const [themePresetId, setThemePresetIdState] = useState<ThemePresetId>(getStoredThemePresetId);
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark'>(() =>
    resolveIsDark(getStoredThemeMode()) ? 'dark' : 'light'
  );

  const setThemeMode = (newMode: ThemeMode) => {
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
    setThemeModeState(newMode);

    const isDark = resolveIsDark(newMode);
    let effectivePresetId = themePresetId;
    const currentPreset = getThemePreset(effectivePresetId);

    if (isDark && currentPreset.type === 'light') {
      effectivePresetId = DEFAULT_DARK_THEME_ID;
      localStorage.setItem(PRESET_STORAGE_KEY, effectivePresetId);
      setThemePresetIdState(effectivePresetId);
    } else if (!isDark && currentPreset.type === 'dark') {
      effectivePresetId = DEFAULT_THEME_ID;
      localStorage.setItem(PRESET_STORAGE_KEY, effectivePresetId);
      setThemePresetIdState(effectivePresetId);
    }

    applyTheme(newMode, effectivePresetId);
    setActiveTheme(isDark ? 'dark' : 'light');
  };

  const setThemePreset = (presetId: ThemePresetId) => {
    const preset = getThemePreset(presetId);
    localStorage.setItem(PRESET_STORAGE_KEY, presetId);
    setThemePresetIdState(presetId);

    // If preset is dark, switch mode to dark; if light, switch to light
    const newMode: ThemeMode = preset.type;
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
    setThemeModeState(newMode);

    applyTheme(newMode, presetId);
    setActiveTheme(preset.type);
  };

  useEffect(() => {
    // Initial application
    applyTheme(themeMode, themePresetId);
    setActiveTheme(resolveIsDark(themeMode) ? 'dark' : 'light');

    // Listen to system theme changes when in 'system' mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = getStoredThemeMode();
      if (current === 'system') {
        const isSysDark = mediaQuery.matches;
        const currentPreset = getThemePreset(getStoredThemePresetId());
        let effectivePreset = currentPreset.id;
        if (isSysDark && currentPreset.type === 'light') {
          effectivePreset = DEFAULT_DARK_THEME_ID;
        } else if (!isSysDark && currentPreset.type === 'dark') {
          effectivePreset = DEFAULT_THEME_ID;
        }
        applyTheme('system', effectivePreset);
        setActiveTheme(isSysDark ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode, themePresetId]);

  return {
    themeMode,
    setThemeMode,
    themePresetId,
    setThemePreset,
    activeTheme,
    presets: THEME_PRESETS,
    activePreset: getThemePreset(themePresetId),
  };
}

export { THEME_PRESETS, getThemePreset };
