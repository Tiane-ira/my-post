import { ApiDetail, HttpMethod, KeyValueItem } from './types';
import { UrlUtils } from './urlUtils';

export type SupportedLanguage =
  | 'curl'
  | 'javascript-fetch'
  | 'javascript-axios'
  | 'python-requests'
  | 'go'
  | 'java-okhttp'
  | 'php-curl'
  | 'sse-curl'
  | 'sse-eventsource'
  | 'sse-fetch'
  | 'sse-python'
  | 'sse-go'
  | 'ws-browser'
  | 'ws-node'
  | 'ws-python'
  | 'ws-go'
  | 'ws-wscat';

export interface LanguageOption {
  id: SupportedLanguage;
  name: string;
}

export interface RequestBodyContext {
  mode: string;
  raw: string;
  rawType?: string;
  formItems: KeyValueItem[];
}

export class CodeGenerator {
  public static getLanguagesForApi(api: ApiDetail): LanguageOption[] {
    if (api.target_type === 'sse') {
      return [
        { id: 'sse-curl', name: 'cURL (EventStream)' },
        { id: 'sse-eventsource', name: 'JavaScript (EventSource)' },
        { id: 'sse-fetch', name: 'JavaScript (Fetch Stream)' },
        { id: 'sse-python', name: 'Python (HTTPX SSE)' },
        { id: 'sse-go', name: 'Go (bufio.Scanner)' },
      ];
    }

    if (api.target_type === 'websocket') {
      return [
        { id: 'ws-browser', name: 'Browser (WebSocket API)' },
        { id: 'ws-node', name: 'Node.js (ws)' },
        { id: 'ws-python', name: 'Python (websockets)' },
        { id: 'ws-go', name: 'Go (gorilla/websocket)' },
        { id: 'ws-wscat', name: 'CLI (wscat)' },
      ];
    }

    return [
      { id: 'curl', name: 'cURL' },
      { id: 'javascript-fetch', name: 'JavaScript (Fetch)' },
      { id: 'javascript-axios', name: 'JavaScript (Axios)' },
      { id: 'python-requests', name: 'Python (Requests)' },
      { id: 'go', name: 'Go (net/http)' },
      { id: 'java-okhttp', name: 'Java (OkHttp)' },
      { id: 'php-curl', name: 'PHP (cURL)' },
    ];
  }

  /**
   * Interpolates placeholder variables in a template string (e.g. {{baseUrl}}, {{token}}, {{$guid}}),
   * supporting multiple passes for nested variable references.
   */
  public static interpolate(
    template: string,
    variables?: Record<string, string | { value?: string } | any>
  ): string {
    if (!template || typeof template !== 'string') return template || '';
    if (!template.includes('{{')) return template;

    const vars: Record<string, string> = {};
    if (variables && typeof variables === 'object') {
      for (const [k, v] of Object.entries(variables)) {
        if (v === null || v === undefined) continue;
        const trimmedKey = k.trim();
        let valStr = '';
        if (typeof v === 'string') {
          valStr = v;
        } else if (typeof v === 'object' && 'value' in v) {
          valStr = typeof (v as any).value === 'string' ? (v as any).value : String((v as any).value ?? '');
        } else {
          valStr = String(v);
        }
        vars[k] = valStr;
        vars[trimmedKey] = valStr;
      }
    }

    let result = template;
    for (let i = 0; i < 5; i++) {
      let replaced = false;
      const next = result.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawKey) => {
        const key = rawKey.trim();
        if (vars[key] !== undefined) {
          replaced = true;
          return vars[key];
        }
        if (vars[rawKey] !== undefined) {
          replaced = true;
          return vars[rawKey];
        }

        // Built-in dynamic placeholder variables
        if (key === '$timestamp') {
          replaced = true;
          return Math.floor(Date.now() / 1000).toString();
        }
        if (key === '$isoTimestamp') {
          replaced = true;
          return new Date().toISOString();
        }
        if (key === '$guid' || key === '$uuid') {
          replaced = true;
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const val = c === 'x' ? r : (r & 0x3) | 0x8;
            return val.toString(16);
          });
        }
        if (key === '$randomInt') {
          replaced = true;
          return Math.floor(Math.random() * 1000).toString();
        }

        return match;
      });
      result = next;
      if (!replaced) break;
    }
    return result;
  }

  public static generate(
    api: ApiDetail,
    lang: SupportedLanguage,
    preUrl?: string,
    variables?: Record<string, string | { value?: string } | any>
  ): string {
    const isWs = api.target_type === 'websocket';
    const isSse = api.target_type === 'sse';
    const method = (api.method || 'GET').toUpperCase() as HttpMethod;

    // Resolve preUrl and api.url placeholders
    const resolvedPreUrl = this.interpolate(preUrl || '', variables);
    const resolvedRawUrl = this.interpolate(api.url || '', variables);

    const resolvedPathParams = (api.request?.path?.parameter || []).map((p) => ({
      ...p,
      key: this.interpolate(p.key || '', variables),
      value: this.interpolate(p.value || '', variables),
    }));

    const { url: pathAppliedUrl } = UrlUtils.applyPathParams(
      resolvedRawUrl,
      resolvedPathParams,
      (v) => this.interpolate(v, variables)
    );

    let url = isWs
      ? UrlUtils.buildWsRequestUrl(pathAppliedUrl, resolvedPreUrl)
      : UrlUtils.buildRequestUrl(pathAppliedUrl, resolvedPreUrl);
    url = this.interpolate(url, variables);

    // Collect checked Query params (supports multi-value array params)
    const queryParams = (api.request?.query?.parameter || [])
      .filter((q) => q.is_checked === 1 && q.key)
      .map((q) => ({
        ...q,
        key: this.interpolate(q.key, variables),
        value: this.interpolate(q.value || '', variables),
      }));

    if (queryParams.length > 0) {
      if (url.includes('?')) {
        const [baseUrlPart, queryStringPart] = url.split('?', 2);
        const urlSearchParams = new URLSearchParams(queryStringPart);
        for (const q of queryParams) {
          const vals = urlSearchParams.getAll(q.key);
          if (vals.includes(q.value || '')) {
            urlSearchParams.delete(q.key);
            for (const v of vals) {
              if (v !== (q.value || '')) {
                urlSearchParams.append(q.key, v);
              }
            }
          }
        }
        const remaining = urlSearchParams.toString();
        url = remaining ? `${baseUrlPart}?${remaining}` : baseUrlPart;
      }
      const qsParts: string[] = [];
      for (const q of queryParams) {
        if ((q.data_type === 'array' || q.type === 'array') && q.value?.startsWith('[') && q.value?.endsWith(']')) {
          try {
            const parsed = JSON.parse(q.value);
            if (Array.isArray(parsed)) {
              for (const elem of parsed) {
                qsParts.push(`${encodeURIComponent(q.key)}=${encodeURIComponent(String(elem))}`);
              }
              continue;
            }
          } catch {}
        }
        qsParts.push(`${encodeURIComponent(q.key)}=${encodeURIComponent(q.value || '')}`);
      }
      url += (url.includes('?') ? '&' : '?') + qsParts.join('&');
    }

    // Collect checked Headers
    const headers: Record<string, string> = {};
    (api.request?.header?.parameter || []).forEach((h) => {
      if (h.is_checked === 1 && h.key) {
        const k = this.interpolate(h.key, variables).trim();
        const v = this.interpolate(h.value || '', variables);
        headers[k] = v;
      }
    });

    // Collect checked Cookies
    const cookieParts: string[] = [];
    (api.request?.cookie?.parameter || []).forEach((c) => {
      if (c.is_checked === 1 && c.key) {
        const k = this.interpolate(c.key, variables).trim();
        const v = this.interpolate(c.value || '', variables);
        cookieParts.push(`${k}=${v}`);
      }
    });
    if (cookieParts.length > 0) {
      headers['Cookie'] = headers['Cookie']
        ? `${headers['Cookie']}; ${cookieParts.join('; ')}`
        : cookieParts.join('; ');
    }

    if (isSse && !headers['Accept']) {
      headers['Accept'] = 'text/event-stream';
    }

    // Handle Auth
    const auth = api.request?.auth;
    if (auth?.type === 'bearer' && auth.bearer?.token) {
      const token = this.interpolate(auth.bearer.token, variables);
      headers['Authorization'] = `Bearer ${token}`;
    } else if (auth?.type === 'basic' && auth.basic?.username) {
      const u = this.interpolate(auth.basic.username, variables);
      const p = this.interpolate(auth.basic.password || '', variables);
      const basicStr = Buffer.from(`${u}:${p}`).toString('base64');
      headers['Authorization'] = `Basic ${basicStr}`;
    } else if (auth?.type === 'apikey' && auth.apikey?.key && auth.apikey?.value) {
      const k = this.interpolate(auth.apikey.key, variables);
      const v = this.interpolate(auth.apikey.value, variables);
      if (auth.apikey.in === 'header') {
        headers[k] = v;
      } else if (auth.apikey.in === 'query') {
        const joinChar = url.includes('?') ? '&' : '?';
        url += `${joinChar}${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      }
    }

    // Handle Body
    const bodyMode = api.request?.body?.mode || 'none';
    let bodyRaw = '';
    const formItems: KeyValueItem[] = (
      api.request?.body?.parameter ||
      (api.request?.body as any)?.form_data ||
      []
    )
      .filter((p: KeyValueItem) => p.is_checked === 1 && p.key)
      .map((p: KeyValueItem) => ({
        ...p,
        key: this.interpolate(p.key, variables),
        value: this.interpolate(p.value || '', variables),
        file_path: p.file_path ? this.interpolate(p.file_path, variables) : p.file_path,
        file_name: p.file_name ? this.interpolate(p.file_name, variables) : p.file_name,
        content_type: p.content_type ? this.interpolate(p.content_type, variables) : p.content_type,
      }));

    if (bodyMode === 'json') {
      bodyRaw = this.interpolate(api.request?.body?.raw || '{}', variables);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else if (bodyMode === 'raw') {
      bodyRaw = this.interpolate(api.request?.body?.raw || '', variables);
      const rawType = api.request?.body?.raw_type || 'json';
      if (!headers['Content-Type']) {
        if (rawType === 'json') headers['Content-Type'] = 'application/json';
        else if (rawType === 'xml') headers['Content-Type'] = 'application/xml';
        else headers['Content-Type'] = 'text/plain';
      }
    } else if (bodyMode === 'msgpack') {
      bodyRaw = this.interpolate(api.request?.body?.msgpack_raw || api.request?.body?.raw || '{}', variables);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-msgpack';
      }
    } else if (bodyMode === 'urlencoded') {
      const list: KeyValueItem[] = api.request?.body?.urlencoded || api.request?.body?.parameter || [];
      const urlencoded = list
        .filter((u: KeyValueItem) => u.is_checked === 1 && u.key)
        .map((u: KeyValueItem) => {
          const k = this.interpolate(u.key, variables);
          const v = this.interpolate(u.value || '', variables);
          return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        })
        .join('&');
      bodyRaw = urlencoded;
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    } else if (bodyMode === 'binary') {
      bodyRaw = this.interpolate(api.request?.body?.binary_file || api.request?.body?.raw || '', variables);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/octet-stream';
      }
    } else if (bodyMode === 'form-data') {
      // For form-data, remove manual Content-Type header so clients can set boundary automatically
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'content-type') {
          delete headers[k];
        }
      }
    }

    const bodyContext: RequestBodyContext = {
      mode: bodyMode,
      raw: bodyRaw,
      rawType: api.request?.body?.raw_type,
      formItems,
    };

    // SSE Dispatch
    if (isSse || lang.startsWith('sse-')) {
      switch (lang) {
        case 'sse-curl':
          return this.toSseCurl(method, url, headers, bodyRaw);
        case 'sse-eventsource':
          return this.toSseEventSource(url);
        case 'sse-fetch':
          return this.toSseFetch(method, url, headers, bodyRaw);
        case 'sse-python':
          return this.toSsePython(method, url, headers, bodyRaw);
        case 'sse-go':
          return this.toSseGo(method, url, headers);
        default:
          return this.toSseCurl(method, url, headers, bodyRaw);
      }
    }

    const wsMessageDraft = this.interpolate(api.websocket?.messageDraft || '', variables);

    // WebSocket Dispatch
    if (isWs || lang.startsWith('ws-')) {
      switch (lang) {
        case 'ws-browser':
          return this.toWsBrowser(url, wsMessageDraft);
        case 'ws-node':
          return this.toWsNode(url, headers, wsMessageDraft);
        case 'ws-python':
          return this.toWsPython(url, wsMessageDraft);
        case 'ws-go':
          return this.toWsGo(url, wsMessageDraft);
        case 'ws-wscat':
          return this.toWsWscat(url, headers);
        default:
          return this.toWsBrowser(url, wsMessageDraft);
      }
    }

    // HTTP Dispatch
    switch (lang) {
      case 'curl':
        return this.toCurl(method, url, headers, bodyContext);
      case 'javascript-fetch':
        return this.toJsFetch(method, url, headers, bodyContext);
      case 'javascript-axios':
        return this.toJsAxios(method, url, headers, bodyContext);
      case 'python-requests':
        return this.toPythonRequests(method, url, headers, bodyContext);
      case 'go':
        return this.toGo(method, url, headers, bodyContext);
      case 'java-okhttp':
        return this.toJavaOkHttp(method, url, headers, bodyContext);
      case 'php-curl':
        return this.toPhpCurl(method, url, headers, bodyContext);
      default:
        return this.toCurl(method, url, headers, bodyContext);
    }
  }

  // --- HTTP Generators ---

  private static toCurl(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const lines: string[] = [`curl -X ${method} "${url}"`];
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`  -H "${key}: ${value}"`);
    }

    if (method !== 'GET') {
      if (bodyContext.mode === 'form-data') {
        for (const item of bodyContext.formItems) {
          const isFile = item.type === 'file' || item.data_type === 'file';
          if (isFile) {
            const rawPath = item.file_path || item.value || '';
            const pathVal = rawPath.startsWith('@') ? rawPath.slice(1) : rawPath;
            const fileName = item.file_name || (pathVal ? pathVal.split(/[/\\]/).pop() : '') || 'file.bin';
            const targetPath = pathVal || fileName;
            let fieldPart = `${item.key}=@${targetPath}`;
            if (item.content_type) {
              fieldPart += `;type=${item.content_type}`;
            }
            if (item.file_name && item.file_name !== targetPath.split(/[/\\]/).pop()) {
              fieldPart += `;filename=${item.file_name}`;
            }
            lines.push(`  -F "${fieldPart}"`);
          } else {
            const escapedVal = (item.value || '').replace(/"/g, '\\"');
            lines.push(`  -F "${item.key}=${escapedVal}"`);
          }
        }
      } else if (bodyContext.mode === 'binary' && bodyContext.raw) {
        lines.push(`  --data-binary "@${bodyContext.raw}"`);
      } else if (bodyContext.raw) {
        const escapedBody = bodyContext.raw.replace(/"/g, '\\"');
        lines.push(`  --data "${escapedBody}"`);
      }
    }
    return lines.join(' \\\n');
  }

  private static toJsFetch(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const hasHeaders = Object.keys(headers).length > 0;
    const isFormData = bodyContext.mode === 'form-data';
    const isNonGet = method !== 'GET';

    let preCode = '';
    let bodyOption = '';

    if (isNonGet) {
      if (isFormData && bodyContext.formItems.length > 0) {
        preCode = 'const formData = new FormData();\n';
        for (const item of bodyContext.formItems) {
          const isFile = item.type === 'file' || item.data_type === 'file';
          if (isFile) {
            const rawPath = item.file_path || item.value || '';
            const fileName = item.file_name || (rawPath ? rawPath.split(/[/\\]/).pop() : '') || 'file.bin';
            preCode += `// 浏览器环境下使用 fileInput.files[0]，或 Node.js 环境下使用 openAsBlob / fs.openAsBlob\n`;
            preCode += `formData.append("${item.key}", fileBlob /* ${rawPath || fileName} */, "${fileName}");\n`;
          } else {
            preCode += `formData.append("${item.key}", ${JSON.stringify(item.value || '')});\n`;
          }
        }
        preCode += '\n';
        bodyOption = '  body: formData,\n';
      } else if (bodyContext.raw) {
        if (bodyContext.mode === 'json') {
          try {
            JSON.parse(bodyContext.raw);
            bodyOption = `  body: JSON.stringify(${bodyContext.raw.trim()}),\n`;
          } catch {
            bodyOption = `  body: ${JSON.stringify(bodyContext.raw)},\n`;
          }
        } else {
          bodyOption = `  body: ${JSON.stringify(bodyContext.raw)},\n`;
        }
      }
    }

    let optionsStr = `  method: "${method}",\n`;
    if (hasHeaders) {
      optionsStr += `  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')},\n`;
    }
    if (bodyOption) {
      optionsStr += bodyOption;
    }

    return `${preCode}fetch("${url}", {\n${optionsStr.trimEnd()}\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
  }

  private static toJsAxios(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const isFormData = bodyContext.mode === 'form-data';
    const isNonGet = method !== 'GET';

    let preCode = "import axios from 'axios';\n";
    let dataSection = '';
    let hasFile = false;

    if (isNonGet) {
      if (isFormData && bodyContext.formItems.length > 0) {
        hasFile = bodyContext.formItems.some((i) => i.type === 'file' || i.data_type === 'file');
        preCode += "import FormData from 'form-data';\n";
        if (hasFile) {
          preCode += "import fs from 'fs';\n";
        }
        preCode += '\nconst formData = new FormData();\n';
        for (const item of bodyContext.formItems) {
          const isFile = item.type === 'file' || item.data_type === 'file';
          if (isFile) {
            const rawPath = item.file_path || item.value || './file.bin';
            preCode += `formData.append("${item.key}", fs.createReadStream(${JSON.stringify(rawPath)}));\n`;
          } else {
            preCode += `formData.append("${item.key}", ${JSON.stringify(item.value || '')});\n`;
          }
        }
        preCode += '\n';
        dataSection = ',\n  data: formData';
      } else if (bodyContext.raw) {
        if (bodyContext.mode === 'json') {
          try {
            JSON.parse(bodyContext.raw);
            dataSection = `,\n  data: ${bodyContext.raw.trim()}`;
          } catch {
            dataSection = `,\n  data: ${JSON.stringify(bodyContext.raw)}`;
          }
        } else {
          dataSection = `,\n  data: ${JSON.stringify(bodyContext.raw)}`;
        }
      }
    }

    const headerObj = { ...headers };
    let headerStr = JSON.stringify(headerObj, null, 4).replace(/\n/g, '\n  ');
    if (isFormData && hasFile) {
      headerStr = headerStr.replace(/\n\}$/, ',\n    ...formData.getHeaders()\n  }');
    }

    return `${preCode}axios({\n  method: "${method.toLowerCase()}",\n  url: "${url}",\n  headers: ${headerStr}${dataSection}\n})\n  .then(response => {\n    console.log(response.data);\n  })\n  .catch(error => {\n    console.error(error);\n  });`;
  }

  private static toPythonRequests(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const isFormData = bodyContext.mode === 'form-data';
    const isNonGet = method !== 'GET';

    let preCode = 'import requests\n\n';
    let dataArg = '';

    if (isNonGet) {
      if (isFormData && bodyContext.formItems.length > 0) {
        const textItems = bodyContext.formItems.filter((i) => i.type !== 'file' && i.data_type !== 'file');
        const fileItems = bodyContext.formItems.filter((i) => i.type === 'file' || i.data_type === 'file');

        if (textItems.length > 0) {
          const dataDict: Record<string, string> = {};
          textItems.forEach((t) => { dataDict[t.key] = t.value || ''; });
          preCode += `data = ${JSON.stringify(dataDict, null, 4)}\n\n`;
        }
        if (fileItems.length > 0) {
          preCode += 'files = [\n';
          for (const f of fileItems) {
            const rawPath = f.file_path || f.value || 'file.bin';
            const fileName = f.file_name || rawPath.split(/[/\\]/).pop() || 'file.bin';
            const cType = f.content_type || 'application/octet-stream';
            preCode += `    ("${f.key}", ("${fileName}", open(${JSON.stringify(rawPath)}, "rb"), "${cType}")),\n`;
          }
          preCode += ']\n\n';
        }

        const args: string[] = [];
        if (textItems.length > 0) args.push('data=data');
        if (fileItems.length > 0) args.push('files=files');
        dataArg = args.length > 0 ? `, ${args.join(', ')}` : '';
      } else if (bodyContext.raw) {
        if (bodyContext.mode === 'json') {
          try {
            JSON.parse(bodyContext.raw);
            preCode += `payload = ${bodyContext.raw.trim()}\n\n`;
          } catch {
            preCode += `payload = ${JSON.stringify(bodyContext.raw)}\n\n`;
          }
          dataArg = ', json=payload';
        } else {
          preCode += `payload = ${JSON.stringify(bodyContext.raw)}\n\n`;
          dataArg = ', data=payload';
        }
      }
    }

    preCode += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
    const callStr = `response = requests.${method.toLowerCase()}("${url}", headers=headers${dataArg})\nprint(response.status_code)\nprint(response.json())`;

    return `${preCode}${callStr}`;
  }

  private static toGo(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const isFormData = bodyContext.mode === 'form-data';
    const isNonGet = method !== 'GET';

    if (isNonGet && isFormData && bodyContext.formItems.length > 0) {
      const fileItems = bodyContext.formItems.filter((i) => i.type === 'file' || i.data_type === 'file');
      const textItems = bodyContext.formItems.filter((i) => i.type !== 'file' && i.data_type !== 'file');
      const hasFile = fileItems.length > 0;

      let importStr = '\n\t"bytes"\n\t"fmt"\n\t"io"\n\t"mime/multipart"\n\t"net/http"';
      if (hasFile) {
        importStr += '\n\t"os"';
      }

      let formWriteCode = '';
      for (const t of textItems) {
        formWriteCode += `\t_ = writer.WriteField("${t.key}", ${JSON.stringify(t.value || '')})\n`;
      }
      for (const f of fileItems) {
        const rawPath = f.file_path || f.value || 'file.bin';
        const fileName = f.file_name || rawPath.split(/[/\\]/).pop() || 'file.bin';
        formWriteCode += `\t{\n\t\tfile, err := os.Open(${JSON.stringify(rawPath)})\n\t\tif err == nil {\n\t\t\tdefer file.Close()\n\t\t\tpart, _ := writer.CreateFormFile("${f.key}", "${fileName}")\n\t\t\t_, _ = io.Copy(part, file)\n\t\t}\n\t}\n`;
      }

      let headerLines = `\treq.Header.Set("Content-Type", writer.FormDataContentType())\n`;
      for (const [k, v] of Object.entries(headers)) {
        headerLines += `\treq.Header.Set("${k}", "${v}")\n`;
      }

      return `package main\n\nimport (${importStr}\n)\n\nfunc main() {\n\tbody := &bytes.Buffer{}\n\twriter := multipart.NewWriter(body)\n${formWriteCode}\twriter.Close()\n\n\treq, err := http.NewRequest("${method}", "${url}", body)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n${headerLines}\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tresBody, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(resBody))\n}`;
    }

    let bodyInit = 'nil';
    let bodyImport = '';
    if (bodyContext.raw && isNonGet) {
      bodyInit = `bytes.NewBuffer([]byte(${JSON.stringify(bodyContext.raw)}))`;
      bodyImport = '\n\t"bytes"';
    }

    let headerLines = '';
    for (const [k, v] of Object.entries(headers)) {
      headerLines += `\treq.Header.Set("${k}", "${v}")\n`;
    }

    return `package main\n\nimport (\n\t"fmt"\n\t"io"${bodyImport}\n\t"net/http"\n)\n\nfunc main() {\n\treq, err := http.NewRequest("${method}", "${url}", ${bodyInit})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n${headerLines}\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tbody, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(body))\n}`;
  }

  private static toJavaOkHttp(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const isFormData = bodyContext.mode === 'form-data';
    const isNonGet = method !== 'GET';

    let bodyDeclaration = 'RequestBody body = null;';
    let extraImports = '';

    if (isNonGet) {
      if (isFormData && bodyContext.formItems.length > 0) {
        const hasFile = bodyContext.formItems.some((i) => i.type === 'file' || i.data_type === 'file');
        if (hasFile) {
          extraImports = 'import java.io.File;\n';
        }
        let builderParts = 'RequestBody body = new MultipartBody.Builder()\n      .setType(MultipartBody.FORM)';
        for (const item of bodyContext.formItems) {
          const isFile = item.type === 'file' || item.data_type === 'file';
          if (isFile) {
            const rawPath = item.file_path || item.value || 'file.bin';
            const fileName = item.file_name || rawPath.split(/[/\\]/).pop() || 'file.bin';
            const cType = item.content_type || 'application/octet-stream';
            builderParts += `\n      .addFormDataPart("${item.key}", "${fileName}",\n        RequestBody.create(MediaType.parse("${cType}"), new File(${JSON.stringify(rawPath)})))`;
          } else {
            builderParts += `\n      .addFormDataPart("${item.key}", ${JSON.stringify(item.value || '')})`;
          }
        }
        builderParts += '\n      .build();';
        bodyDeclaration = builderParts;
      } else if (bodyContext.raw) {
        bodyDeclaration = `MediaType mediaType = MediaType.parse("${headers['Content-Type'] || 'application/json'}");\n    RequestBody body = RequestBody.create(mediaType, ${JSON.stringify(bodyContext.raw)});`;
      }
    }

    let headerCalls = '';
    for (const [k, v] of Object.entries(headers)) {
      headerCalls += `\n      .addHeader("${k}", "${v}")`;
    }

    let methodCall = '.get()';
    if (method === 'POST') methodCall = '.post(body)';
    else if (method === 'PUT') methodCall = '.put(body)';
    else if (method === 'PATCH') methodCall = '.patch(body)';
    else if (method === 'DELETE') methodCall = bodyDeclaration !== 'RequestBody body = null;' ? '.delete(body)' : '.delete()';
    else methodCall = `.method("${method}", body)`;

    return `import okhttp3.*;\n${extraImports}import java.io.IOException;\n\npublic class Main {\n  public static void main(String[] args) throws IOException {\n    OkHttpClient client = new OkHttpClient();\n    ${bodyDeclaration}\n\n    Request request = new Request.Builder()\n      .url("${url}")\n      ${methodCall}${headerCalls}\n      .build();\n\n    Response response = client.newCall(request).execute();\n    System.out.println(response.body().string());\n  }\n}`;
  }

  private static toPhpCurl(
    method: string,
    url: string,
    headers: Record<string, string>,
    bodyContext: RequestBodyContext
  ): string {
    const isFormData = bodyContext.mode === 'form-data';
    const isNonGet = method !== 'GET';

    let bodyOption = '';
    if (isNonGet) {
      if (isFormData && bodyContext.formItems.length > 0) {
        const parts: string[] = [];
        for (const item of bodyContext.formItems) {
          const isFile = item.type === 'file' || item.data_type === 'file';
          if (isFile) {
            const rawPath = item.file_path || item.value || 'file.bin';
            const fileName = item.file_name || rawPath.split(/[/\\]/).pop() || 'file.bin';
            const cType = item.content_type || 'application/octet-stream';
            parts.push(`  "${item.key}" => new CURLFile(${JSON.stringify(rawPath)}, "${cType}", "${fileName}")`);
          } else {
            parts.push(`  "${item.key}" => ${JSON.stringify(item.value || '')}`);
          }
        }
        bodyOption = `\n$postFields = [\n${parts.join(',\n')}\n];\ncurl_setopt($curl, CURLOPT_POSTFIELDS, $postFields);`;
      } else if (bodyContext.raw) {
        bodyOption = `\ncurl_setopt($curl, CURLOPT_POSTFIELDS, ${JSON.stringify(bodyContext.raw)});`;
      }
    }

    const headerArr = Object.entries(headers).map(([k, v]) => `  "${k}: ${v}",`);
    const headerStr = headerArr.length > 0 ? `[\n${headerArr.join('\n')}\n]` : '[]';

    return `<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n  CURLOPT_URL => "${url}",\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_CUSTOMREQUEST => "${method}",\n  CURLOPT_HTTPHEADER => ${headerStr},\n]);${bodyOption}\n\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;`;
  }

  // --- SSE Generators ---

  private static toSseCurl(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    const lines: string[] = [`curl -N -X ${method} "${url}"`];
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`  -H "${key}: ${value}"`);
    }
    if (bodyRaw && method !== 'GET') {
      const escapedBody = bodyRaw.replace(/"/g, '\\"');
      lines.push(`  --data "${escapedBody}"`);
    }
    return lines.join(' \\\n');
  }

  private static toSseEventSource(url: string): string {
    return `// 浏览器原生 EventSource 客户端 (仅支持 GET 请求)\nconst eventSource = new EventSource("${url}");\n\neventSource.onopen = () => {\n  console.log("SSE 事件流连接已建立");\n};\n\neventSource.onmessage = (event) => {\n  console.log("收到数据:", event.data);\n};\n\neventSource.addEventListener("custom_event", (event) => {\n  console.log("收到自定义事件:", event.data);\n});\n\neventSource.onerror = (err) => {\n  console.error("SSE 连接异常或断开:", err);\n  eventSource.close();\n};`;
  }

  private static toSseFetch(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    const hasBody = bodyRaw && method !== 'GET';
    let bodyOption = '';
    if (hasBody) {
      bodyOption = `\n  body: ${JSON.stringify(bodyRaw)},`;
    }

    return `// 基于 Fetch + ReadableStream 的流式响应读取器 (支持自定义 Header 与 POST 请求)\nasync function listenSseStream() {\n  const response = await fetch("${url}", {\n    method: "${method}",\n    headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n    ')},${bodyOption}\n  });\n\n  if (!response.body) throw new Error("ReadableStream not supported");\n  const reader = response.body.getReader();\n  const decoder = new TextDecoder();\n\n  while (true) {\n    const { done, value } = await reader.read();\n    if (done) {\n      console.log("流式数据传输结束");\n      break;\n    }\n    const chunk = decoder.decode(value, { stream: true });\n    console.log("收到事件数据块:", chunk);\n  }\n}\n\nlistenSseStream().catch(console.error);`;
  }

  private static toSsePython(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    let bodyArg = '';
    if (bodyRaw && method !== 'GET') {
      bodyArg = `, content=${JSON.stringify(bodyRaw)}`;
    }

    return `import httpx\n\n# 需要安装: pip install httpx\nurl = "${url}"\nheaders = ${JSON.stringify(headers, null, 4)}\n\nwith httpx.Client() as client:\n    with client.stream("${method}", url, headers=headers${bodyArg}) as response:\n        for line in response.iter_lines():\n            if line:\n                print(line)`;
  }

  private static toSseGo(method: string, url: string, headers: Record<string, string>): string {
    let headerLines = '';
    for (const [k, v] of Object.entries(headers)) {
      headerLines += `\treq.Header.Set("${k}", "${v}")\n`;
    }

    return `package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\treq, err := http.NewRequest("${method}", "${url}", nil)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n${headerLines}\n\tresp, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer resp.Body.Close()\n\n\tscanner := bufio.NewScanner(resp.Body)\n\tfor scanner.Scan() {\n\t\tfmt.Println("SSE Event:", scanner.Text())\n\t}\n}`;
  }

  // --- WebSocket Generators ---

  private static toWsBrowser(url: string, msgDraft?: string): string {
    const sendLine = msgDraft
      ? `  ws.send(${JSON.stringify(msgDraft)});`
      : `  ws.send("Hello from Browser client!");`;

    return `// 浏览器原生 WebSocket 客户端\nconst ws = new WebSocket("${url}");\n\nws.onopen = () => {\n  console.log("WebSocket 连接建立成功");\n${sendLine}\n};\n\nws.onmessage = (event) => {\n  console.log("收到服务器消息:", event.data);\n};\n\nws.onerror = (error) => {\n  console.error("WebSocket 发生错误:", error);\n};\n\nws.onclose = (event) => {\n  console.log("连接已断开，状态码:", event.code, "原因:", event.reason);\n};`;
  }

  private static toWsNode(url: string, headers: Record<string, string>, msgDraft?: string): string {
    const hasHeaders = Object.keys(headers).length > 0;
    const headerStr = hasHeaders
      ? `, {\n  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')}\n}`
      : '';
    const sendLine = msgDraft
      ? `  ws.send(${JSON.stringify(msgDraft)});`
      : `  ws.send('Hello from Node.js!');`;

    return `import WebSocket from 'ws';\n// 需要安装: npm install ws\n\nconst ws = new WebSocket("${url}"${headerStr});\n\nws.on('open', () => {\n  console.log('WebSocket 连接成功');\n${sendLine}\n});\n\nws.on('message', (data) => {\n  console.log('收到消息:', data.toString());\n});\n\nws.on('error', (err) => {\n  console.error('连接异常:', err);\n});\n\nws.on('close', () => {\n  console.log('连接已关闭');\n});`;
  }

  private static toWsPython(url: string, msgDraft?: string): string {
    const sendLine = msgDraft
      ? `        await websocket.send(${JSON.stringify(msgDraft)})`
      : `        await websocket.send("Hello from Python client!")`;

    return `import asyncio\nimport websockets\n# 需要安装: pip install websockets\n\nasync def connect_ws():\n    uri = "${url}"\n    async with websockets.connect(uri) as websocket:\n        print("WebSocket 连接成功")\n${sendLine}\n        \n        while True:\n            msg = await websocket.recv()\n            print(f"收到消息: {msg}")\n\nasyncio.run(connect_ws())`;
  }

  private static toWsGo(url: string, msgDraft?: string): string {
    const sendLine = msgDraft
      ? `\terr = c.WriteMessage(websocket.TextMessage, []byte(${JSON.stringify(msgDraft)}))\n\tif err != nil {\n\t\tlog.Println("Write error:", err)\n\t}`
      : `\terr = c.WriteMessage(websocket.TextMessage, []byte("Hello from Go!"))\n\tif err != nil {\n\t\tlog.Println("Write error:", err)\n\t}`;

    return `package main\n\nimport (\n\t"fmt"\n\t"log"\n\t"github.com/gorilla/websocket"\n)\n\nfunc main() {\n\tu := "${url}"\n\tc, _, err := websocket.DefaultDialer.Dial(u, nil)\n\tif err != nil {\n\t\tlog.Fatal("Dial error:", err)\n\t}\n\tdefer c.Close()\n\n\t// 发送示例数据\n${sendLine}\n\n\t// 监听接收消息\n\tfor {\n\t\t_, message, err := c.ReadMessage()\n\t\tif err != nil {\n\t\t\tlog.Println("Read error:", err)\n\t\t\treturn\n\t\t}\n\t\tfmt.Printf("收到消息: %s\\n", message)\n\t}\n}`;
  }

  private static toWsWscat(url: string, headers: Record<string, string>): string {
    const lines = [`wscat -c "${url}"`];
    for (const [k, v] of Object.entries(headers)) {
      lines.push(`  -H "${k}: ${v}"`);
    }
    return lines.join(' \\\n');
  }
}
