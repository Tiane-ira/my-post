import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  APP_VERSION,
  GITHUB_REPO_URL,
  GITHUB_RELEASES_URL,
  compareVersions,
  getAutoCheckEnabled,
  setAutoCheckEnabled,
  getLastCheckedTimestamp,
  checkForUpdates,
} from '../src/renderer/src/utils/updateChecker';

describe('UpdateChecker Service', () => {
  let storage: Record<string, string> = {};

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
  });

  beforeEach(() => {
    storage = {};
    vi.restoreAllMocks();
  });

  it('should expose valid current app version and repository constants', () => {
    expect(APP_VERSION).toBe('20261024_01');
    expect(GITHUB_REPO_URL).toBe('https://github.com/Tiane-ira/my-post');
    expect(GITHUB_RELEASES_URL).toBe('https://github.com/Tiane-ira/my-post/releases');
  });

  it('should correctly compare versions with and without prefix', () => {
    // New yyyyMMdd_序号 format
    expect(compareVersions('20261024_02', '20261024_01')).toBeGreaterThan(0);
    expect(compareVersions('v20261024_01', '20261024_01')).toBe(0);
    expect(compareVersions('20261024_01', 'v20261024_01')).toBe(0);
    expect(compareVersions('20261025_01', '20261024_01')).toBeGreaterThan(0);
    expect(compareVersions('20261024_01', '2026.10.24')).toBeGreaterThan(0);

    // Legacy date-dot format
    expect(compareVersions('2026.10.25', '2026.10.24')).toBeGreaterThan(0);
    expect(compareVersions('v2026.11.01', '2026.10.24')).toBeGreaterThan(0);
    expect(compareVersions('2026.10.24', 'v2026.10.24')).toBe(0);
    expect(compareVersions('2026.09.15', '2026.10.24')).toBeLessThan(0);
    expect(compareVersions('v1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('should default auto-check to false and support toggling', () => {
    // Default is explicitly FALSE
    expect(getAutoCheckEnabled()).toBe(false);

    setAutoCheckEnabled(true);
    expect(getAutoCheckEnabled()).toBe(true);

    setAutoCheckEnabled(false);
    expect(getAutoCheckEnabled()).toBe(false);
  });

  it('should detect when an update is available from GitHub', async () => {
    const mockReleaseData = {
      tag_name: 'v20261025_01',
      name: 'Release 20261025_01',
      body: '### What is new\n- Added SSE & WebSocket multi-protocol inspector\n- Added Theme Preset System',
      html_url: 'https://github.com/Tiane-ira/my-post/releases/tag/v20261025_01',
      published_at: '2026-10-25T12:00:00Z',
      assets: [
        {
          name: 'mypost-Setup-20261025_01-win.exe',
          browser_download_url: 'https://github.com/Tiane-ira/my-post/releases/download/v20261025_01/mypost-Setup-win.exe',
        },
      ],
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockReleaseData,
    });

    const result = await checkForUpdates();
    expect(result.success).toBe(true);
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('20261025_01');
    expect(result.currentVersion).toBe(APP_VERSION);
    expect(result.releaseNotes).toContain('Added SSE & WebSocket');
    expect(result.downloadUrl).toBe(
      'https://github.com/Tiane-ira/my-post/releases/download/v20261025_01/mypost-Setup-win.exe'
    );
    expect(getLastCheckedTimestamp()).toBeTruthy();
  });

  it('should report up to date when current version is equal to remote latest', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v20261024_01',
        name: 'Release 20261024_01',
        body: 'Current stable release',
        html_url: 'https://github.com/Tiane-ira/my-post/releases/tag/v20261024_01',
      }),
    });

    const result = await checkForUpdates();
    expect(result.success).toBe(true);
    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersion).toBe('20261024_01');
  });

  it('should handle network or GitHub API errors gracefully without throwing', async () => {
    (global as any).fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await checkForUpdates();
    expect(result.success).toBe(false);
    expect(result.hasUpdate).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
