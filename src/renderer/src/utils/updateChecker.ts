export const APP_VERSION = '20261024.1.0';
export const GITHUB_REPO_URL = 'https://github.com/Tiane-ira/my-post';
export const GITHUB_RELEASES_URL = 'https://github.com/Tiane-ira/my-post/releases';
export const GITHUB_API_LATEST_RELEASE = 'https://api.github.com/repos/Tiane-ira/my-post/releases/latest';

export const STORAGE_KEY_AUTO_CHECK = 'mypost:updates:autoCheck';
export const STORAGE_KEY_LAST_CHECKED = 'mypost:updates:lastChecked';

export interface UpdateCheckResult {
  success: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  checkedAt: number;
  error?: string;
}

/**
 * Compare two version strings (e.g., '20261024_01' vs '20261024_02' or '2026.10.24' vs '20261024_01')
 * Returns:
 *   > 0 if v1 > v2
 *   < 0 if v1 < v2
 *   0 if v1 === v2
 */
export function compareVersions(v1: string, v2: string): number {
  const clean1 = (v1 || '').replace(/^[vV]/, '').trim();
  const clean2 = (v2 || '').replace(/^[vV]/, '').trim();

  const parts1 = clean1.split(/[._-]/).map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? p : num;
  });
  const parts2 = clean2.split(/[._-]/).map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? p : num;
  });

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;

    if (typeof p1 === 'number' && typeof p2 === 'number') {
      if (p1 !== p2) return p1 - p2;
    } else {
      const s1 = String(p1);
      const s2 = String(p2);
      if (s1 !== s2) return s1.localeCompare(s2);
    }
  }

  return 0;
}

/**
 * Get whether automatic update checking is enabled. Defaults to false.
 */
export function getAutoCheckEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_AUTO_CHECK);
    return val === 'true'; // Defaults to false
  } catch {
    return false;
  }
}

/**
 * Set whether automatic update checking is enabled.
 */
export function setAutoCheckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTO_CHECK, String(enabled));
  } catch (err) {
    console.error('Failed to save auto-check update preference:', err);
  }
}

/**
 * Get timestamp of the last update check.
 */
export function getLastCheckedTimestamp(): number | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY_LAST_CHECKED);
    if (!val) return null;
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

/**
 * Check for updates against GitHub Releases API.
 */
export async function checkForUpdates(timeoutMs: number = 8000): Promise<UpdateCheckResult> {
  const now = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY_LAST_CHECKED, String(now));
  } catch {
    // Ignore localStorage errors
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GITHUB_API_LATEST_RELEASE, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'mypost-client/' + APP_VERSION,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      // No releases published yet on repository
      return {
        success: true,
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        checkedAt: now,
      };
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API 访问速率超限，请稍后重试');
      }
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rawTag: string = data.tag_name || data.name || '';
    const latestVersion = rawTag.replace(/^[vV]/, '').trim();

    if (!latestVersion) {
      return {
        success: true,
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        checkedAt: now,
      };
    }

    // Determine if newer
    const isNewer = compareVersions(latestVersion, APP_VERSION) > 0;

    // Pick best download URL if assets exist
    let downloadUrl = data.html_url || GITHUB_RELEASES_URL;
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      // Prefer Windows installer or standard package
      const winAsset = data.assets.find(
        (a: any) => a.name && (a.name.endsWith('.exe') || a.name.endsWith('.msi'))
      );
      if (winAsset?.browser_download_url) {
        downloadUrl = winAsset.browser_download_url;
      }
    }

    return {
      success: true,
      hasUpdate: isNewer,
      currentVersion: APP_VERSION,
      latestVersion,
      releaseName: data.name || rawTag,
      releaseNotes: data.body || '',
      publishedAt: data.published_at || '',
      releaseUrl: data.html_url || GITHUB_RELEASES_URL,
      downloadUrl,
      checkedAt: now,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    let errMsg = err.message || '检测更新失败';
    if (err.name === 'AbortError') {
      errMsg = '请求超时，无法连接至 GitHub 服务';
    } else if (errMsg.includes('Failed to fetch')) {
      errMsg = '网络连接失败，请检查网络或是否处于离线环境';
    }

    return {
      success: false,
      hasUpdate: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      checkedAt: now,
      error: errMsg,
    };
  }
}
