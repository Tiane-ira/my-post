import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  THEME_PRESETS,
  getThemePreset,
  DEFAULT_THEME_ID,
  DEFAULT_DARK_THEME_ID,
} from '../src/renderer/src/utils/themePresets';
import {
  getStoredThemeMode,
  getStoredThemePresetId,
  resolveIsDark,
  applyTheme,
} from '../src/renderer/src/utils/themeManager';

describe('Theme System and Presets Registry', () => {
  let storage: Record<string, string> = {};
  let rootClasses = new Set<string>();
  let rootAttrs: Record<string, string> = {};

  beforeAll(() => {
    const mockStorage = {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => {
        storage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
      clear: () => {
        storage = {};
      },
    };

    (global as any).localStorage = mockStorage;
    (global as any).window = {
      matchMedia: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      localStorage: mockStorage,
    };

    (global as any).document = {
      documentElement: {
        classList: {
          add: (cls: string) => rootClasses.add(cls),
          remove: (cls: string) => rootClasses.delete(cls),
          contains: (cls: string) => rootClasses.has(cls),
        },
        setAttribute: (k: string, v: string) => {
          rootAttrs[k] = v;
        },
        getAttribute: (k: string) => rootAttrs[k] || null,
        removeAttribute: (k: string) => {
          delete rootAttrs[k];
        },
      },
    };
  });

  beforeEach(() => {
    storage = {};
    rootClasses.clear();
    rootAttrs = {};
  });

  it('should provide complete curated theme presets with all tokens defined', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);

    THEME_PRESETS.forEach((preset) => {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.type === 'dark' || preset.type === 'light').toBe(true);
      expect(preset.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);

      // Verify colors object contains essential tokens
      expect(preset.colors.bgPrimary).toBeTruthy();
      expect(preset.colors.bgSecondary).toBeTruthy();
      expect(preset.colors.bgCard).toBeTruthy();
      expect(preset.colors.borderColor).toBeTruthy();
      expect(preset.colors.textPrimary).toBeTruthy();
      expect(preset.colors.accent).toBeTruthy();
      expect(preset.colors.statusSuccess).toBeTruthy();
      expect(preset.colors.statusError).toBeTruthy();
    });
  });

  it('should fallback to default theme preset when unknown id is passed', () => {
    const unknown = getThemePreset('non-existent-theme');
    expect(unknown.id).toBe(THEME_PRESETS[0].id);

    const cyber = getThemePreset('cyber-teal');
    expect(cyber.id).toBe('cyber-teal');
    expect(cyber.name).toBe('赛博青翠');
    expect(cyber.accentColor).toBe('#06b6d4');
  });

  it('should resolve theme mode and defaults correctly', () => {
    expect(getStoredThemeMode()).toBe('light');
    expect(getStoredThemePresetId()).toBe(DEFAULT_THEME_ID);

    localStorage.setItem('mypost_theme_mode', 'dark');
    expect(getStoredThemeMode()).toBe('dark');
    expect(getStoredThemePresetId()).toBe(DEFAULT_DARK_THEME_ID);

    expect(resolveIsDark('dark')).toBe(true);
    expect(resolveIsDark('light')).toBe(false);
  });

  it('should apply data-theme and dark/light classes to root document element', () => {
    applyTheme('dark', 'midnight-purple');

    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight-purple');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    applyTheme('light', 'default-light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('default-light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should auto-adjust preset type when mode conflicts', () => {
    // If dark mode is requested but light preset is passed, it falls back to dark default preset
    applyTheme('dark', 'default-light');
    expect(document.documentElement.getAttribute('data-theme')).toBe(DEFAULT_DARK_THEME_ID);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // If light mode is requested but dark preset is passed, it falls back to light default preset
    applyTheme('light', 'cyber-teal');
    expect(document.documentElement.getAttribute('data-theme')).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
