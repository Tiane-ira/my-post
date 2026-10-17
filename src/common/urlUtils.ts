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
}
