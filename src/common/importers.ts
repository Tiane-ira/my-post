import YAML from 'yaml';
import * as Sampler from 'openapi-sampler';
import { ApiDetail, HttpMethod, KeyValueItem } from './types';
import { UrlUtils } from './urlUtils';

export interface ParsedApiDocItem {
  name: string;
  method: HttpMethod;
  url: string;
  summary?: string;
  description?: string;
  tags?: string[];
  folderPath?: string[];
  queryParams?: KeyValueItem[];
  pathParams?: KeyValueItem[];
  headers?: KeyValueItem[];
  bodyRaw?: string;
  bodyMode?: 'none' | 'json' | 'form-data' | 'urlencoded' | 'raw';
  formData?: KeyValueItem[];
  urlencoded?: KeyValueItem[];
}

export interface ParsedApiDocResult {
  title: string;
  version: string;
  docFormat: 'swagger' | 'openapi';
  items: ParsedApiDocItem[];
}

export interface ParsedCurlResult {
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValueItem[];
  cookies?: KeyValueItem[];
  bodyRaw: string;
  bodyMode: 'none' | 'json' | 'raw' | 'form-data';
  formData?: KeyValueItem[];
  auth?: {
    type: 'none' | 'bearer' | 'basic';
    bearer?: { token: string };
    basic?: { username: string; password: string };
  };
}

export class DataImporters {
  /**
   * Detects if the string is a cURL command (compatible with bash, cmd, powershell, and terminal prompts)
   */
  public static isCurl(str: string): boolean {
    if (!str) return false;
    const clean = str.trim().replace(/^[$>#]\s+/, '');
    return /^(curl|curl\.exe)(\s|\r|\n|$)/i.test(clean);
  }

  /**
   * Tokenizes a cURL command string respecting bash single quotes, double quotes, ANSI-C quotes ($''),
   * and Windows CMD escaping.
   */
  private static tokenize(str: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inAnsiCQuote = false;
    let isEscaped = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (isEscaped) {
        if (inDoubleQuote || inAnsiCQuote) {
          if (char === 'n') current += '\n';
          else if (char === 'r') current += '\r';
          else if (char === 't') current += '\t';
          else if (char === '\\') current += '\\';
          else if (char === '"') current += '"';
          else if (char === "'") current += "'";
          else current += char;
        } else {
          current += char;
        }
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        if (inSingleQuote) {
          current += '\\';
        } else {
          isEscaped = true;
        }
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && !inAnsiCQuote) {
        // Bash ANSI-C Quoting: $'...'
        if (char === '$' && str[i + 1] === "'") {
          inAnsiCQuote = true;
          i++; // skip '
          continue;
        }

        if (char === "'") {
          inSingleQuote = true;
          continue;
        }

        if (char === '"') {
          inDoubleQuote = true;
          continue;
        }

        if (/\s/.test(char)) {
          if (current.length > 0) {
            tokens.push(current);
            current = '';
          }
          continue;
        }

        current += char;
      } else if (inSingleQuote) {
        if (char === "'") {
          inSingleQuote = false;
        } else {
          current += char;
        }
      } else if (inAnsiCQuote) {
        if (char === "'") {
          inAnsiCQuote = false;
        } else {
          current += char;
        }
      } else if (inDoubleQuote) {
        if (char === '"') {
          inDoubleQuote = false;
        } else {
          current += char;
        }
      }
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Normalizes raw cURL command strings from Bash, CMD, and PowerShell
   */
  public static normalizeCurlString(rawStr: string): string {
    let text = rawStr.trim();

    // Strip leading shell prompts ($ curl, > curl, # curl)
    text = text.replace(/^[$>#]\s+/, '');

    // Handle multiline continuations:
    // Bash \ at end of line
    text = text.replace(/\\\r?\n/g, ' ');
    // CMD ^ at end of line
    text = text.replace(/\^\r?\n/g, ' ');
    // PowerShell ` at end of line
    text = text.replace(/`\r?\n/g, ' ');

    // Normalize Windows CMD caret escaping
    // CMD uses ^ to escape characters: ", {, }, [, ], (, ), %, ;, =, &, |, <, >, !, ,, ', ~, +, ^, and characters after %
    if (text.includes('^')) {
      // 1. Double quotes escaped for CMD inside quoted strings:
      // Examples from Chrome DevTools: ^\^" -> \" or \^" -> \" or ^^" -> \"
      text = text
        .replace(/(\^\\|\\)\^"/g, '\\"')
        .replace(/\^\^"/g, '\\"')
        .replace(/\^"/g, '"');

      // 2. Protect literal carets (^^ in CMD denotes a literal ^)
      const CARET_PLACEHOLDER = '__MYPOST_ESCAPED_CARET__';
      text = text.replace(/\^\^/g, CARET_PLACEHOLDER);

      // 3. Unescape any character escaped by a single caret in CMD (^X -> X)
      text = text.replace(/\^([\s\S])/g, '$1');

      // 4. Restore literal carets
      text = text.replace(new RegExp(CARET_PLACEHOLDER, 'g'), '^');
    }

    return text;
  }

  public static parseCurl(curlStr: string): ParsedCurlResult {
    const normalized = this.normalizeCurlString(curlStr);
    const tokens = this.tokenize(normalized);

    let method: HttpMethod = 'GET';
    let methodExplicitlySet = false;
    let url = '';
    const headers: KeyValueItem[] = [];
    const cookies: KeyValueItem[] = [];
    const bodyParts: string[] = [];
    const formDataParts: KeyValueItem[] = [];
    let isFormData = false;
    let authUserPass = '';

    const addCookieString = (cookieStr: string) => {
      const parts = cookieStr.split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          cookies.push({
            param_id: Math.random().toString(36).substring(2, 9),
            key: trimmed.slice(0, eqIdx).trim(),
            value: trimmed.slice(eqIdx + 1).trim(),
            is_checked: 1,
          });
        }
      }
    };

    const addHeader = (headerStr: string) => {
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx > 0) {
        const key = headerStr.slice(0, colonIdx).trim();
        const value = headerStr.slice(colonIdx + 1).trim();
        if (key.toLowerCase() === 'cookie') {
          addCookieString(value);
        }
        headers.push({
          param_id: Math.random().toString(36).substring(2, 9),
          key,
          value,
          is_checked: 1,
        });
      } else if (headerStr.trim()) {
        let key = headerStr.trim();
        if (key.endsWith(';')) {
          key = key.slice(0, -1).trim();
        }
        if (key) {
          headers.push({
            param_id: Math.random().toString(36).substring(2, 9),
            key,
            value: '',
            is_checked: 1,
          });
        }
      }
    };

    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];

      // Skip the 'curl' or 'curl.exe' command itself
      if (i === 0 && /^(curl|curl\.exe)$/i.test(token)) {
        continue;
      }

      // Method: -X <METHOD>, --request <METHOD>, -X<METHOD>, --request=<METHOD>
      if (token === '-X' || token === '--request') {
        if (i + 1 < tokens.length) {
          method = tokens[++i].replace(/^['"]|['"]$/g, '').toUpperCase() as HttpMethod;
          methodExplicitlySet = true;
        }
        continue;
      }
      if (token.startsWith('-X') && token.length > 2) {
        method = token.slice(2).replace(/^['"]|['"]$/g, '').toUpperCase() as HttpMethod;
        methodExplicitlySet = true;
        continue;
      }
      if (token.startsWith('--request=')) {
        method = token.slice(10).replace(/^['"]|['"]$/g, '').toUpperCase() as HttpMethod;
        methodExplicitlySet = true;
        continue;
      }

      // Head: -I, --head
      if (token === '-I' || token === '--head') {
        method = 'HEAD';
        methodExplicitlySet = true;
        continue;
      }

      // URL: --url <URL>, --url=<URL>
      if (token === '--url') {
        if (i + 1 < tokens.length) {
          url = tokens[++i].replace(/^['"]|['"]$/g, '');
        }
        continue;
      }
      if (token.startsWith('--url=')) {
        url = token.slice(6).replace(/^['"]|['"]$/g, '');
        continue;
      }

      // Headers: -H <HEADER>, --header <HEADER>, --header=<HEADER>
      if (token === '-H' || token === '--header') {
        if (i + 1 < tokens.length) {
          addHeader(tokens[++i]);
        }
        continue;
      }
      if (token.startsWith('-H') && token.length > 2 && token[2] !== ' ') {
        addHeader(token.slice(2));
        continue;
      }
      if (token.startsWith('--header=')) {
        addHeader(token.slice(9));
        continue;
      }

      // User-Agent: -A, --user-agent
      if (token === '-A' || token === '--user-agent') {
        if (i + 1 < tokens.length) {
          headers.push({
            param_id: Math.random().toString(36).substring(2, 9),
            key: 'User-Agent',
            value: tokens[++i],
            is_checked: 1,
          });
        }
        continue;
      }

      // Cookie: -b, --cookie
      if (token === '-b' || token === '--cookie') {
        if (i + 1 < tokens.length) {
          const cookieVal = tokens[++i];
          addCookieString(cookieVal);
          headers.push({
            param_id: Math.random().toString(36).substring(2, 9),
            key: 'Cookie',
            value: cookieVal,
            is_checked: 1,
          });
        }
        continue;
      }
      if (token.startsWith('--cookie=')) {
        const cookieVal = token.slice(9);
        addCookieString(cookieVal);
        headers.push({
          param_id: Math.random().toString(36).substring(2, 9),
          key: 'Cookie',
          value: cookieVal,
          is_checked: 1,
        });
        continue;
      }
      if (token.startsWith('-b') && token.length > 2 && token[2] !== ' ') {
        const cookieVal = token.slice(2);
        addCookieString(cookieVal);
        headers.push({
          param_id: Math.random().toString(36).substring(2, 9),
          key: 'Cookie',
          value: cookieVal,
          is_checked: 1,
        });
        continue;
      }

      // Referer: -e, --referer
      if (token === '-e' || token === '--referer') {
        if (i + 1 < tokens.length) {
          headers.push({
            param_id: Math.random().toString(36).substring(2, 9),
            key: 'Referer',
            value: tokens[++i],
            is_checked: 1,
          });
        }
        continue;
      }

      // Basic auth: -u, --user
      if (token === '-u' || token === '--user') {
        if (i + 1 < tokens.length) {
          authUserPass = tokens[++i];
        }
        continue;
      }
      if (token.startsWith('-u') && token.length > 2) {
        authUserPass = token.slice(2);
        continue;
      }
      if (token.startsWith('--user=')) {
        authUserPass = token.slice(7);
        continue;
      }

      // Data / Body: -d, --data, --data-raw, --data-binary, --data-ascii, --data-urlencode
      if (
        token === '-d' ||
        token === '--data' ||
        token === '--data-raw' ||
        token === '--data-binary' ||
        token === '--data-ascii' ||
        token === '--data-urlencode'
      ) {
        if (i + 1 < tokens.length) {
          bodyParts.push(tokens[++i]);
          if (!methodExplicitlySet) method = 'POST';
        }
        continue;
      }
      if (
        token.startsWith('--data=') ||
        token.startsWith('--data-raw=') ||
        token.startsWith('--data-binary=') ||
        token.startsWith('--data-ascii=')
      ) {
        bodyParts.push(token.slice(token.indexOf('=') + 1));
        if (!methodExplicitlySet) method = 'POST';
        continue;
      }
      if (token.startsWith('-d') && token.length > 2 && token[2] !== ' ') {
        bodyParts.push(token.slice(2));
        if (!methodExplicitlySet) method = 'POST';
        continue;
      }

      // Form Data: -F, --form
      if (token === '-F' || token === '--form') {
        if (i + 1 < tokens.length) {
          isFormData = true;
          const formItem = tokens[++i];
          const eqIdx = formItem.indexOf('=');
          if (eqIdx > 0) {
            const k = formItem.slice(0, eqIdx).trim();
            const v = formItem.slice(eqIdx + 1).trim();
            formDataParts.push({
              param_id: Math.random().toString(36).substring(2, 9),
              key: k,
              value: v.startsWith('@') ? v.slice(1) : v,
              type: v.startsWith('@') ? 'file' : 'text',
              is_checked: 1,
            });
          }
          if (!methodExplicitlySet) method = 'POST';
        }
        continue;
      }

      // Ignore common flags taking 1 argument
      if (
        ['-o', '--output', '-m', '--max-time', '--connect-timeout', '--cacert', '-x', '--proxy'].includes(token)
      ) {
        i++;
        continue;
      }

      // Ignore common boolean flags
      if (
        /^-[sSkvLGg]+$/.test(token) ||
        [
          '--silent',
          '--show-error',
          '--insecure',
          '--verbose',
          '--location',
          '--compressed',
          '--get',
        ].includes(token)
      ) {
        continue;
      }

      // If token is not an option (doesn't start with '-') and url hasn't been set yet:
      if (!token.startsWith('-') && !url) {
        url = token.replace(/^['"]|['"]$/g, '');
      }
    }

    // Combine body parts
    let bodyRaw = bodyParts.join('&');

    // If bodyRaw was enclosed in extra quotes e.g. "..." or '...'
    if (
      (bodyRaw.startsWith('"') && bodyRaw.endsWith('"')) ||
      (bodyRaw.startsWith("'") && bodyRaw.endsWith("'"))
    ) {
      const unquoted = bodyRaw.slice(1, -1);
      try {
        JSON.parse(unquoted);
        bodyRaw = unquoted;
      } catch {}
    }

    // Auth handling
    let auth: ParsedCurlResult['auth'] = { type: 'none' };
    if (authUserPass) {
      const [u, ...p] = authUserPass.split(':');
      auth = {
        type: 'basic',
        basic: { username: u, password: p.join(':') },
      };
    } else {
      for (const h of headers) {
        if (h.key.toLowerCase() === 'authorization') {
          if (h.value.startsWith('Bearer ')) {
            auth = {
              type: 'bearer',
              bearer: { token: h.value.substring(7).trim() },
            };
          } else if (h.value.startsWith('Basic ')) {
            try {
              const decoded = atob(h.value.substring(6).trim());
              const [u, ...p] = decoded.split(':');
              auth = {
                type: 'basic',
                basic: { username: u, password: p.join(':') },
              };
            } catch {}
          }
        }
      }
    }

    // Determine body mode
    let bodyMode: ParsedCurlResult['bodyMode'] = 'none';
    if (isFormData && formDataParts.length > 0) {
      bodyMode = 'form-data';
    } else if (bodyRaw) {
      try {
        JSON.parse(bodyRaw);
        bodyMode = 'json';
      } catch {
        try {
          const unescaped = bodyRaw.replace(/\\"/g, '"');
          JSON.parse(unescaped);
          bodyRaw = unescaped;
          bodyMode = 'json';
        } catch {
          const hasJsonHeader = headers.some(
            (h) => h.key.toLowerCase() === 'content-type' && h.value.includes('application/json')
          );
          bodyMode = hasJsonHeader ? 'json' : 'raw';
        }
      }
    }

    let name = 'cURL 导入接口';
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
          name = parsedUrl.pathname;
        }
      }
    } catch {}

    return {
      name,
      method,
      url,
      headers,
      cookies,
      bodyRaw,
      bodyMode,
      formData: formDataParts,
      auth,
    };
  }

  public static curlToApiDetail(curlStr: string, baseApi?: Partial<ApiDetail>): ApiDetail {
    const parsed = this.parseCurl(curlStr);
    const { queryParams } = UrlUtils.syncUrlToParams(parsed.url);
    const pathParams = UrlUtils.extractPathParams(parsed.url, []);

    // Filter out redundant raw Cookie header if cookies were structured into request.cookie.parameter
    const filteredHeaders =
      parsed.cookies && parsed.cookies.length > 0
        ? parsed.headers.filter((h) => h.key.toLowerCase() !== 'cookie')
        : parsed.headers;

    const base = baseApi || {};
    return {
      target_id: base.target_id || `api-${Date.now()}`,
      parent_id: base.parent_id || '0',
      project_id: base.project_id || '',
      target_type: 'api',
      name:
        base.name &&
        base.name !== '新建接口' &&
        base.name !== '未命名快捷请求' &&
        base.name !== '未命名请求'
          ? base.name
          : parsed.name,
      method: parsed.method,
      url: parsed.url,
      sort: base.sort || 1000,
      status: base.status ?? 1,
      request: {
        query: { parameter: queryParams },
        path: { parameter: pathParams },
        header: { parameter: filteredHeaders },
        cookie: {
          parameter:
            parsed.cookies && parsed.cookies.length > 0
              ? parsed.cookies
              : base.request?.cookie?.parameter || [],
        },
        body: {
          mode: parsed.bodyMode,
          raw: parsed.bodyRaw,
          raw_type: parsed.bodyMode === 'json' ? 'json' : undefined,
          parameter: parsed.formData?.length ? parsed.formData : undefined,
        },
        auth: parsed.auth || { type: 'none' },
        pre_tasks: base.request?.pre_tasks || [],
        post_tasks: base.request?.post_tasks || [],
      },
      response: base.response || { example: [] },
    };
  }

  public static parsePostmanCollection(jsonStr: string): {
    name: string;
    method: HttpMethod;
    url: string;
    headers: KeyValueItem[];
    bodyRaw: string;
  }[] {
    const obj = JSON.parse(jsonStr);
    const results: any[] = [];

    const traverse = (items: any[]) => {
      for (const item of items) {
        if (item.request) {
          const method = (item.request.method || 'GET').toUpperCase() as HttpMethod;
          const url = typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw || '';
          const headers = (item.request.header || []).map((h: any) => ({
            param_id: Math.random().toString(36).substring(2, 8),
            key: h.key,
            value: h.value,
            is_checked: 1,
          }));

          results.push({
            name: item.name || 'Postman 接口',
            method,
            url,
            headers,
            bodyRaw: item.request.body?.raw || '',
          });
        }
        if (Array.isArray(item.item)) {
          traverse(item.item);
        }
      }
    };

    if (Array.isArray(obj.item)) {
      traverse(obj.item);
    }

    return results;
  }

  /**
   * Resolves a JSON reference (e.g. #/definitions/User or #/components/schemas/User)
   */
  private static resolveRef(root: any, ref: string, visited = new Set<string>()): any {
    if (!ref || typeof ref !== 'string' || !ref.startsWith('#/')) return null;
    if (visited.has(ref)) return null;
    visited.add(ref);

    const parts = ref.substring(2).split('/');
    let current: any = root;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return null;
      const decoded = decodeURIComponent(part.replace(/~1/g, '/').replace(/~0/g, '~'));
      current = current[decoded];
    }
    if (current && typeof current === 'object' && current.$ref) {
      return this.resolveRef(root, current.$ref, visited);
    }
    return current;
  }

  /**
   * Recursively generates a sample JSON / JavaScript value from a Swagger / OpenAPI schema
   * Powered by openapi-sampler with fallback and cycle detection
   */
  private static generateSampleFromSchema(
    schema: any,
    root: any,
    depth = 0,
    visitedRefs = new Set<string>(),
    visitedObjects = new WeakSet<object>()
  ): any {
    if (!schema || typeof schema !== 'object' || depth > 6) return '';
    if (visitedObjects.has(schema)) return {};
    visitedObjects.add(schema);

    try {
      const sampled = Sampler.sample(schema, { skipReadOnly: true }, root);
      if (sampled !== undefined && sampled !== null) {
        return sampled;
      }
    } catch {
      // Fallback if openapi-sampler encountered an unsupported edge case
    }

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    if (schema.$ref) {
      if (visitedRefs.has(schema.$ref) || depth > 6) return {};
      const nextVisited = new Set(visitedRefs);
      nextVisited.add(schema.$ref);
      const resolved = this.resolveRef(root, schema.$ref);
      if (resolved) {
        return this.generateSampleFromSchema(resolved, root, depth + 1, nextVisited, visitedObjects);
      }
      return {};
    }

    if (Array.isArray(schema.allOf)) {
      const merged: Record<string, any> = {};
      for (const sub of schema.allOf) {
        const subSample = this.generateSampleFromSchema(sub, root, depth + 1, visitedRefs, visitedObjects);
        if (subSample && typeof subSample === 'object') {
          Object.assign(merged, subSample);
        }
      }
      return merged;
    }

    if (schema.type === 'object' || schema.properties) {
      const res: Record<string, any> = {};
      const props = schema.properties || {};
      for (const [propName, propSchema] of Object.entries<any>(props)) {
        res[propName] = this.generateSampleFromSchema(propSchema, root, depth + 1, visitedRefs, visitedObjects);
      }
      return res;
    }

    if (schema.type === 'array' || schema.items) {
      if (schema.items) {
        return [this.generateSampleFromSchema(schema.items, root, depth + 1, visitedRefs, visitedObjects)];
      }
      return [];
    }

    if (schema.type === 'integer' || schema.type === 'number') {
      return schema.minimum !== undefined ? schema.minimum : 0;
    }

    if (schema.type === 'boolean') {
      return true;
    }

    return 'string';
  }

  /**
   * Extracts schema properties into KeyValueItem list for form-data and urlencoded
   */
  private static extractSchemaToKeyValues(
    schema: any,
    root: any,
    visitedRefs = new Set<string>(),
    depth = 0,
    visitedObjects = new WeakSet<object>()
  ): KeyValueItem[] {
    if (!schema || typeof schema !== 'object' || depth > 6) return [];
    if (visitedObjects.has(schema)) return [];
    visitedObjects.add(schema);

    if (schema.$ref) {
      if (visitedRefs.has(schema.$ref)) return [];
      visitedRefs.add(schema.$ref);
      const resolved = this.resolveRef(root, schema.$ref);
      if (resolved) return this.extractSchemaToKeyValues(resolved, root, visitedRefs, depth + 1, visitedObjects);
      return [];
    }

    const items: KeyValueItem[] = [];
    const props = schema.properties || {};
    const requiredList = Array.isArray(schema.required) ? schema.required : [];

    for (const [key, prop] of Object.entries<any>(props)) {
      if (!prop) continue;
      const isFile = prop.type === 'file' || prop.format === 'binary' || prop.format === 'byte';
      let sampleVal = '';
      if (!isFile) {
        const s = this.generateSampleFromSchema(prop, root, depth + 1, visitedRefs, visitedObjects);
        if (s !== undefined && s !== null) {
          sampleVal = typeof s === 'object' ? JSON.stringify(s) : String(s);
        }
      }
      items.push({
        param_id: Math.random().toString(36).substring(2, 9),
        key,
        value: sampleVal,
        description: prop.description || '',
        type: isFile ? 'file' : 'text',
        data_type: prop.type || 'string',
        is_checked: 1,
        is_required: requiredList.includes(key) ? 1 : 0,
      });
    }

    return items;
  }

  /**
   * Asynchronous Swagger 2.0 & OpenAPI 3.x document parser
   * Safe for browser environments (delegates to parseApiDoc)
   */
  public static async parseApiDocAsync(content: string): Promise<ParsedApiDocResult> {
    return this.parseApiDoc(content);
  }

  /**
   * Synchronous Swagger 2.0 & OpenAPI 3.x document parser
   */
  public static parseApiDoc(content: string): ParsedApiDocResult {
    const cleanContent = (content || '').trim().replace(/^\uFEFF/, '');
    let obj: any;
    try {
      obj = YAML.parse(cleanContent);
    } catch {
      try {
        obj = JSON.parse(cleanContent);
      } catch (err: any) {
        throw new Error(`无法解析文档内容为 JSON 或 YAML: ${err.message || err}`);
      }
    }

    if (!obj || typeof obj !== 'object') {
      throw new Error('无效的接口文档内容');
    }

    return this.parseApiDocFromObject(obj);
  }

  /**
   * Core extraction engine transforming parsed OpenAPI/Swagger object into ParsedApiDocResult
   */
  public static parseApiDocFromObject(obj: any): ParsedApiDocResult {
    const paths = obj.paths || {};
    const results: ParsedApiDocItem[] = [];

    let docFormat: 'swagger' | 'openapi' = 'swagger';
    let version = '';
    const title = obj.info?.title || 'API 接口文档';

    if (obj.openapi) {
      docFormat = 'openapi';
      version = String(obj.openapi);
    } else if (obj.swagger) {
      docFormat = 'swagger';
      version = String(obj.swagger);
    }

    // Base path or server URL
    let basePath = '';
    if (typeof obj.basePath === 'string' && obj.basePath !== '/') {
      basePath = obj.basePath.replace(/\/$/, '');
    } else if (Array.isArray(obj.servers) && obj.servers[0]?.url) {
      const serverUrl = obj.servers[0].url;
      try {
        if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
          const parsed = new URL(serverUrl);
          if (parsed.pathname && parsed.pathname !== '/') {
            basePath = parsed.pathname.replace(/\/$/, '');
          }
        } else if (serverUrl.startsWith('/') && serverUrl !== '/') {
          basePath = serverUrl.replace(/\/$/, '');
        }
      } catch {}
    }

    for (const [rawPath, pathItem] of Object.entries<any>(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      let fullPath = rawPath;
      if (basePath && !fullPath.startsWith(basePath)) {
        fullPath = `${basePath}${fullPath.startsWith('/') ? '' : '/'}${fullPath}`;
      }

      const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

      for (const [m, op] of Object.entries<any>(pathItem)) {
        const method = m.toUpperCase() as HttpMethod;
        if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method)) {
          continue;
        }

        const opParams = Array.isArray(op.parameters) ? op.parameters : [];
        const rawAllParams = [...commonParams, ...opParams];

        const queryParams: KeyValueItem[] = [];
        const pathParams: KeyValueItem[] = [];
        const headers: KeyValueItem[] = [];
        const formDataItems: KeyValueItem[] = [];
        const urlencodedItems: KeyValueItem[] = [];
        let bodyRaw = '';
        let bodyMode: 'none' | 'json' | 'form-data' | 'urlencoded' | 'raw' = 'none';

        // 1. Process parameters
        for (let p of rawAllParams) {
          if (!p) continue;
          if (p.$ref) {
            p = this.resolveRef(obj, p.$ref) || p;
          }
          if (!p.name) continue;

          // Schema / type resolution for parameter
          const paramSchema = p.schema ? (p.schema.$ref ? this.resolveRef(obj, p.schema.$ref) || p.schema : p.schema) : p;
          let defaultVal = '';
          if (p.example !== undefined) defaultVal = String(p.example);
          else if (p.default !== undefined) defaultVal = String(p.default);
          else if (paramSchema?.example !== undefined) defaultVal = String(paramSchema.example);
          else if (paramSchema?.default !== undefined) defaultVal = String(paramSchema.default);
          else if (paramSchema?.enum?.[0] !== undefined) defaultVal = String(paramSchema.enum[0]);

          const item: KeyValueItem = {
            param_id: Math.random().toString(36).substring(2, 9),
            key: p.name,
            value: defaultVal,
            description: p.description || paramSchema?.description || '',
            is_checked: 1,
            is_required: p.required ? 1 : 0,
            data_type: p.type || paramSchema?.type || 'string',
            type: p.type === 'file' ? 'file' : 'text',
          };

          if (p.in === 'query') {
            queryParams.push(item);
          } else if (p.in === 'path') {
            if (!item.value) item.value = '1';
            pathParams.push(item);
          } else if (p.in === 'header') {
            headers.push(item);
          } else if (p.in === 'formData') {
            bodyMode = 'form-data';
            item.type = p.type === 'file' ? 'file' : 'text';
            formDataItems.push(item);
          } else if (p.in === 'body') {
            bodyMode = 'json';
            const bodySchema = p.schema ? (p.schema.$ref ? this.resolveRef(obj, p.schema.$ref) || p.schema : p.schema) : {};
            const sample = this.generateSampleFromSchema(bodySchema, obj);
            bodyRaw = typeof sample === 'object' ? JSON.stringify(sample, null, 2) : String(sample || '{}');
            if (!headers.some((h) => h.key.toLowerCase() === 'content-type')) {
              headers.push({
                param_id: Math.random().toString(36).substring(2, 9),
                key: 'Content-Type',
                value: 'application/json',
                is_checked: 1,
              });
            }
          }
        }

        // 2. Ensure all {varName} in the URL path are extracted into pathParams
        const pathVarMatches = fullPath.match(/\{([^{}]+)\}/g);
        if (pathVarMatches) {
          for (const match of pathVarMatches) {
            const varName = match.slice(1, -1).trim();
            if (varName && !pathParams.some((p) => p.key === varName)) {
              pathParams.push({
                param_id: Math.random().toString(36).substring(2, 9),
                key: varName,
                value: '1',
                description: '路径变量',
                is_checked: 1,
                is_required: 1,
                type: 'text',
                data_type: 'string',
              });
            }
          }
        }

        // 3. OpenAPI 3.x requestBody
        let reqBody = op.requestBody;
        if (reqBody?.$ref) {
          reqBody = this.resolveRef(obj, reqBody.$ref) || reqBody;
        }

        if (reqBody?.content) {
          const contentMap = reqBody.content;
          if (contentMap['application/json']) {
            bodyMode = 'json';
            const jsonSpec = contentMap['application/json'];
            if (jsonSpec.example !== undefined) {
              bodyRaw =
                typeof jsonSpec.example === 'string'
                  ? jsonSpec.example
                  : JSON.stringify(jsonSpec.example, null, 2);
            } else if (jsonSpec.examples && Object.values(jsonSpec.examples)[0]) {
              const firstEx: any = Object.values(jsonSpec.examples)[0];
              const exVal = firstEx.value !== undefined ? firstEx.value : firstEx;
              bodyRaw = typeof exVal === 'string' ? exVal : JSON.stringify(exVal, null, 2);
            } else if (jsonSpec.schema) {
              const sample = this.generateSampleFromSchema(jsonSpec.schema, obj);
              bodyRaw = typeof sample === 'object' ? JSON.stringify(sample, null, 2) : String(sample || '{}');
            } else {
              bodyRaw = '{}';
            }
            if (!headers.some((h) => h.key.toLowerCase() === 'content-type')) {
              headers.push({
                param_id: Math.random().toString(36).substring(2, 9),
                key: 'Content-Type',
                value: 'application/json',
                is_checked: 1,
              });
            }
          } else if (contentMap['multipart/form-data']) {
            bodyMode = 'form-data';
            const formSpec = contentMap['multipart/form-data'];
            if (formSpec.schema) {
              const items = this.extractSchemaToKeyValues(formSpec.schema, obj);
              formDataItems.push(...items);
            }
            if (!headers.some((h) => h.key.toLowerCase() === 'content-type')) {
              headers.push({
                param_id: Math.random().toString(36).substring(2, 9),
                key: 'Content-Type',
                value: 'multipart/form-data',
                is_checked: 1,
              });
            }
          } else if (contentMap['application/x-www-form-urlencoded']) {
            bodyMode = 'urlencoded';
            const urlencSpec = contentMap['application/x-www-form-urlencoded'];
            if (urlencSpec.schema) {
              const items = this.extractSchemaToKeyValues(urlencSpec.schema, obj);
              urlencodedItems.push(...items);
            }
            if (!headers.some((h) => h.key.toLowerCase() === 'content-type')) {
              headers.push({
                param_id: Math.random().toString(36).substring(2, 9),
                key: 'Content-Type',
                value: 'application/x-www-form-urlencoded',
                is_checked: 1,
              });
            }
          } else if (contentMap['text/plain'] || contentMap['application/xml']) {
            bodyMode = 'raw';
          }
        }

        // 4. Extract folder structure (tags -> folder chain)
        const rawTags = Array.isArray(op.tags) ? op.tags : (op.tag ? [op.tag] : []);
        let folderPath: string[] = [];
        if (rawTags.length > 0 && typeof rawTags[0] === 'string' && rawTags[0].trim()) {
          const firstTag = rawTags[0].trim();
          folderPath = firstTag.includes('/')
            ? firstTag.split('/').map((s: string) => s.trim()).filter(Boolean)
            : [firstTag];
        } else {
          // Fallback to first path segment
          const cleanPath = fullPath.replace(/^\/+/, '');
          const segs = cleanPath.split('/').filter(Boolean);
          if (segs.length > 1) {
            folderPath = [segs[0]];
          }
        }

        const name = op.summary || op.description || op.operationId || `${method} ${fullPath}`;

        results.push({
          name: name.slice(0, 100),
          method,
          url: fullPath,
          summary: op.summary,
          description: op.description,
          tags: rawTags,
          folderPath,
          queryParams,
          pathParams,
          headers,
          bodyRaw,
          bodyMode,
          formData: formDataItems.length > 0 ? formDataItems : undefined,
          urlencoded: urlencodedItems.length > 0 ? urlencodedItems : undefined,
        });
      }
    }

    return {
      title,
      version,
      docFormat,
      items: results,
    };
  }

  public static parseSwaggerOrOpenApi(content: string): ParsedApiDocItem[] {
    return this.parseApiDoc(content).items;
  }

  public static parseSwagger(content: string): ParsedApiDocItem[] {
    return this.parseSwaggerOrOpenApi(content);
  }

  public static parseOpenApi(content: string): ParsedApiDocItem[] {
    return this.parseSwaggerOrOpenApi(content);
  }

  public static apiDocItemToApiDetail(
    item: ParsedApiDocItem,
    targetId: string,
    projectId: string,
    parentId: string = '0'
  ): ApiDetail {
    const safeUrl = (item.url || '').trim();
    const { queryParams } = UrlUtils.syncUrlToParams(safeUrl, item.queryParams || []);
    const pathParams = UrlUtils.extractPathParams(safeUrl, item.pathParams || []);

    return {
      target_id: targetId,
      parent_id: parentId,
      project_id: projectId,
      target_type: 'api',
      name: (item.name || safeUrl || '未命名接口').trim(),
      method: (item.method || 'GET').toUpperCase() as HttpMethod,
      url: safeUrl,
      sort: Date.now(),
      status: 1,
      request: {
        query: { parameter: queryParams || [] },
        path: { parameter: pathParams || [] },
        header: { parameter: item.headers || [] },
        cookie: { parameter: [] },
        body: {
          mode: item.bodyMode || 'none',
          raw: item.bodyRaw || '',
          raw_type: item.bodyMode === 'json' ? 'json' : undefined,
          parameter: item.formData?.length ? item.formData : undefined,
          urlencoded: item.urlencoded?.length ? item.urlencoded : undefined,
        },
        auth: { type: 'none' },
        pre_tasks: [],
        post_tasks: [],
      },
      response: { example: [] },
    };
  }
}
