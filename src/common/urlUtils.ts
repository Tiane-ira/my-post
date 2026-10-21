import { KeyValueItem } from './types';

export class UrlUtils {
  public static syncUrlToParams(
    url: string,
    existingParams: KeyValueItem[] = []
  ): { cleanUrl: string; queryParams: KeyValueItem[] } {
    if (!url.includes('?')) {
      return { cleanUrl: url, queryParams: existingParams };
    }

    const [cleanUrl, queryString] = url.split('?', 2);
    const searchParams = new URLSearchParams(queryString);

    const newParams: KeyValueItem[] = [];
    const seenKeys = new Set<string>();

    // 1. Extract from query string
    searchParams.forEach((value, key) => {
      seenKeys.add(key);
      const existing = existingParams.find((p) => p.key === key);
      newParams.push({
        param_id: existing?.param_id || Math.random().toString(36).substring(2, 9),
        key,
        value,
        description: existing?.description || '',
        is_checked: 1,
      });
    });

    // 2. Retain unchecked/disabled existing params
    existingParams.forEach((p) => {
      if (p.is_checked !== 1 && !seenKeys.has(p.key) && p.key) {
        newParams.push(p);
      }
    });

    return { cleanUrl, queryParams: newParams };
  }

  public static syncParamsToUrl(url: string, params: KeyValueItem[]): string {
    const baseUrl = url.split('?')[0];
    const checked = params.filter((p) => p.is_checked === 1 && p.key);

    if (checked.length === 0) {
      return baseUrl;
    }

    const searchParams = new URLSearchParams();
    checked.forEach((p) => {
      searchParams.append(p.key, p.value || '');
    });

    return `${baseUrl}?${searchParams.toString()}`;
  }

  /**
   * Extract Path variables (:param or {param}) from URL path portion,
   * while preserving existing values and descriptions.
   */
  public static extractPathParams(
    url: string,
    existingParams: KeyValueItem[] = []
  ): KeyValueItem[] {
    if (!url) return existingParams;

    // 1. Separate path portion from query string and hash
    let pathPart = url.split(/[?#]/)[0];

    // Remove protocol and host if present: e.g. "http://localhost:8080/api" -> "/api"
    const protoIndex = pathPart.indexOf('://');
    if (protoIndex !== -1) {
      const afterProto = pathPart.slice(protoIndex + 3);
      const firstSlash = afterProto.indexOf('/');
      pathPart = firstSlash !== -1 ? afterProto.slice(firstSlash) : '';
    } else {
      // Remove any {{baseUrl}} or {{env}} prefix at the start
      pathPart = pathPart.replace(/^\{\{[^}]+\}\}/, '');
    }

    // 2. Find all :param or {param} in pathPart
    const keys: string[] = [];
    const seen = new Set<string>();

    // Match :param preceded by / or start or delimiter
    const colonRegex = /(?:^|\/):([a-zA-Z0-9_-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = colonRegex.exec(pathPart)) !== null) {
      const k = m[1];
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }

    // Match {param}
    const braceRegex = /\{([a-zA-Z0-9_-]+)\}/g;
    while ((m = braceRegex.exec(pathPart)) !== null) {
      const k = m[1];
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }

    if (keys.length === 0) {
      // If no path params in URL, retain existing manual params if they have values
      return existingParams.filter((p) => !p.key || p.value);
    }

    // 3. Build synced list preserving existing values & descriptions
    return keys.map((key) => {
      const existing = existingParams.find(
        (p) => p.key === key || p.key === `:${key}` || p.key === `{${key}}`
      );
      return {
        param_id: existing?.param_id || Math.random().toString(36).substring(2, 9),
        key,
        value: existing?.value || '',
        description: existing?.description || '',
        is_checked: existing ? existing.is_checked : 1,
        data_type: 'string',
        type: 'text',
      };
    });
  }

  /**
   * Synchronize Path parameter changes in table back to URL tokens
   */
  public static syncPathParamsToUrl(
    url: string,
    newParams: KeyValueItem[],
    oldParams: KeyValueItem[] = []
  ): string {
    if (!url) return '';
    let [pathAndBase, queryAndHash] = url.split('?', 2);
    const suffix = queryAndHash !== undefined ? `?${queryAndHash}` : '';

    // Clean keys for comparison
    const clean = (k: string) => {
      if (!k) return '';
      if (k.startsWith(':')) return k.slice(1);
      if (k.startsWith('{') && k.endsWith('}')) return k.slice(1, -1);
      return k;
    };

    // 1. Check for renames: oldParams vs newParams by param_id
    for (const newP of newParams) {
      const oldP = oldParams.find((o) => o.param_id === newP.param_id);
      const oldKey = clean(oldP?.key || '');
      const newKey = clean(newP.key || '');
      if (oldKey && newKey && oldKey !== newKey) {
        pathAndBase = pathAndBase
          .replace(new RegExp(`:${oldKey}(?=[/?&#]|$)`, 'g'), `:${newKey}`)
          .replace(new RegExp(`\\{${oldKey}\\}`, 'g'), `{${newKey}}`);
      }
    }

    // 2. Check for removed params
    for (const oldP of oldParams) {
      const oldKey = clean(oldP.key || '');
      if (
        oldKey &&
        !newParams.some(
          (n) => n.param_id === oldP.param_id || clean(n.key || '') === oldKey
        )
      ) {
        pathAndBase = pathAndBase
          .replace(new RegExp(`/:${oldKey}(?=[/?&#]|$)`, 'g'), '')
          .replace(new RegExp(`/\\{${oldKey}\\}(?=[/?&#]|$)`, 'g'), '');
      }
    }

    // 3. Check for newly added params that are not yet in pathAndBase
    for (const newP of newParams) {
      const newKey = clean(newP.key || '');
      if (newKey && newP.is_checked === 1) {
        const hasToken = new RegExp(
          `(?::${newKey}|\\{${newKey}\\})(?=[/?&#]|$)`
        ).test(pathAndBase);
        if (!hasToken) {
          pathAndBase = pathAndBase.endsWith('/')
            ? `${pathAndBase}:${newKey}`
            : `${pathAndBase}/:${newKey}`;
        }
      }
    }

    return `${pathAndBase}${suffix}`;
  }

  /**
   * Builds the final request URL according to environment rules:
   * 1. When no environment is selected (or baseUrl is empty):
   *    The requested URL is directly the value from the URL bar.
   *    (If missing protocol, e.g. "localhost:3000/api", auto-prefixed with http:// so network clients don't fail).
   * 2. When an environment is selected (baseUrl is provided):
   *    The requested URL is the environment's baseUrl concatenated with the URL bar value.
   *    - Handles paths with or without leading slashes.
   *    - Handles query strings (?key=val).
   *    - Avoids double-prefixing if the URL bar already starts with the baseUrl.
   *    - If the URL bar contains an absolute URL for a different host (e.g. from pasted cURL), preserves it.
   */
  public static buildRequestUrl(rawUrl: string, baseUrl?: string): string {
    const trimmedUrl = (rawUrl || '').trim();
    let trimmedBase = (baseUrl || '').trim();

    // 1. 无环境时：请求的 URL 就是 URL 栏中的值
    if (!trimmedBase) {
      if (!trimmedUrl) return '';
      // If protocol is missing and it doesn't start with a slash, prefix http:// so axios/fetch doesn't fail
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl) && !trimmedUrl.startsWith('/')) {
        return `http://${trimmedUrl}`;
      }
      return trimmedUrl;
    }

    // Ensure baseUrl has protocol
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedBase)) {
      trimmedBase = `http://${trimmedBase}`;
    }
    const cleanBase = trimmedBase.replace(/\/+$/, '');

    // 2. 有选环境时：环境的 baseUrl 拼接 URL 栏的值
    if (!trimmedUrl) {
      return cleanBase;
    }

    // If the URL bar value already begins with baseUrl, don't double-prefix
    if (trimmedUrl.startsWith(cleanBase)) {
      return trimmedUrl;
    }

    // If URL bar has an absolute URL to a different host (e.g. from an external pasted cURL)
    if (/^https?:\/\//i.test(trimmedUrl)) {
      try {
        const u = new URL(trimmedUrl);
        const b = new URL(cleanBase);
        if (u.host === b.host && u.pathname.startsWith(b.pathname)) {
          return trimmedUrl;
        }
      } catch {}
      return trimmedUrl;
    }

    // If URL bar starts with query string
    if (trimmedUrl.startsWith('?')) {
      return `${cleanBase}${trimmedUrl}`;
    }

    // Normal concatenation: baseUrl + / + path
    const cleanPath = trimmedUrl.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  /**
   * Strips the baseUrl from a full URL if it matches, returning the relative path portion.
   * Useful when pasting a cURL command into an environment with a configured baseUrl.
   */
  public static stripBaseUrl(url: string, baseUrl?: string): string {
    if (!url || !baseUrl) return url;
    let cleanBase = baseUrl.trim().replace(/\/+$/, '');
    let cleanUrl = url.trim();

    if (!cleanBase || !cleanUrl) return cleanUrl;

    // Direct prefix match:
    if (cleanUrl.startsWith(cleanBase)) {
      const rest = cleanUrl.slice(cleanBase.length);
      return rest.startsWith('/') || rest.startsWith('?') || !rest ? (rest || '/') : `/${rest}`;
    }

    // Host & pathname match (ignoring http vs https mismatch if host and base path match)
    try {
      const parsedBase = new URL(cleanBase.startsWith('http') ? cleanBase : `http://${cleanBase}`);
      const parsedTarget = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
      if (parsedBase.host === parsedTarget.host) {
        const basePath = parsedBase.pathname.replace(/\/+$/, '');
        if (!basePath || parsedTarget.pathname.startsWith(basePath)) {
          const restPath = parsedTarget.pathname.slice(basePath.length);
          const search = parsedTarget.search || '';
          const hash = parsedTarget.hash || '';
          const combined = `${restPath}${search}${hash}`;
          return combined.startsWith('/') || combined.startsWith('?') || !combined ? (combined || '/') : `/${combined}`;
        }
      }
    } catch {}

    return cleanUrl;
  }

  /**
   * Builds the WebSocket URL according to environment rules
   */
  public static buildWsRequestUrl(rawUrl: string, wsBaseUrl?: string): string {
    let finalUrl = (rawUrl || '').trim();
    let base = (wsBaseUrl || '').trim().replace(/\/+$/, '');

    // Normalize wsBaseUrl to ws:// or wss:// if provided
    if (base) {
      if (base.startsWith('http://')) base = 'ws://' + base.slice(7);
      else if (base.startsWith('https://')) base = 'wss://' + base.slice(8);
      else if (!base.startsWith('ws://') && !base.startsWith('wss://')) base = 'ws://' + base;
    }

    if (!base) {
      // 无环境时
      if (!finalUrl) return '';
      if (finalUrl.startsWith('ws://') || finalUrl.startsWith('wss://')) return finalUrl;
      if (finalUrl.startsWith('http://')) return 'ws://' + finalUrl.slice(7);
      if (finalUrl.startsWith('https://')) return 'wss://' + finalUrl.slice(8);
      return 'ws://' + finalUrl.replace(/^\/+/, '');
    }

    // 有选环境时
    if (!finalUrl) return base;

    if (finalUrl.startsWith(base)) {
      return finalUrl;
    }

    if (
      finalUrl.startsWith('ws://') ||
      finalUrl.startsWith('wss://') ||
      finalUrl.startsWith('http://') ||
      finalUrl.startsWith('https://')
    ) {
      try {
        const u = new URL(finalUrl.replace(/^ws/i, 'http'));
        const b = new URL(base.replace(/^ws/i, 'http'));
        if (u.host === b.host && u.pathname.startsWith(b.pathname)) {
          return finalUrl;
        }
      } catch {}
      // External absolute WebSocket URL
      if (finalUrl.startsWith('http://')) return 'ws://' + finalUrl.slice(7);
      if (finalUrl.startsWith('https://')) return 'wss://' + finalUrl.slice(8);
      return finalUrl;
    }

    if (finalUrl.startsWith('?')) {
      return `${base}${finalUrl}`;
    }

    return `${base}/${finalUrl.replace(/^\/+/, '')}`;
  }
}

