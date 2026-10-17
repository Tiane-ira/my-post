import { ApiDetail, HttpMethod, KeyValueItem } from './types';

export type SupportedLanguage =
  | 'curl'
  | 'javascript-fetch'
  | 'javascript-axios'
  | 'python-requests'
  | 'go'
  | 'java-okhttp'
  | 'php-curl';

export class CodeGenerator {
  public static generate(api: ApiDetail, lang: SupportedLanguage, preUrl?: string): string {
    const method = (api.method || 'GET').toUpperCase() as HttpMethod;
    let url = api.url || '';
    if (preUrl && !url.startsWith('http://') && !url.startsWith('https://')) {
      const cleanPre = preUrl.endsWith('/') ? preUrl.slice(0, -1) : preUrl;
      const cleanPath = url.startsWith('/') ? url : '/' + url;
      url = `${cleanPre}${cleanPath}`;
    }

    // Collect checked Query params
    const queryParams = (api.request?.query?.parameter || []).filter((q) => q.is_checked === 1 && q.key);
    if (queryParams.length > 0) {
      const qs = queryParams.map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`).join('&');
      url += (url.includes('?') ? '&' : '?') + qs;
    }

    // Collect checked Headers
    const headers: Record<string, string> = {};
    (api.request?.header?.parameter || []).forEach((h) => {
      if (h.is_checked === 1 && h.key) {
        headers[h.key] = h.value;
      }
    });

    // Handle Auth
    const auth = api.request?.auth;
    if (auth?.type === 'bearer' && auth.bearer?.token) {
      headers['Authorization'] = `Bearer ${auth.bearer.token}`;
    } else if (auth?.type === 'basic' && auth.basic?.username) {
      const basicStr = Buffer.from(`${auth.basic.username}:${auth.basic.password || ''}`).toString('base64');
      headers['Authorization'] = `Basic ${basicStr}`;
    }

    // Handle Body
    const bodyMode = api.request?.body?.mode || 'none';
    let bodyRaw = '';
    if (bodyMode === 'json') {
      bodyRaw = api.request?.body?.raw || '{}';
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else if (bodyMode === 'raw') {
      bodyRaw = api.request?.body?.raw || '';
    } else if (bodyMode === 'urlencoded') {
      const list: KeyValueItem[] = api.request?.body?.urlencoded || api.request?.body?.parameter || [];
      const urlencoded = list
        .filter((u: KeyValueItem) => u.is_checked === 1 && u.key)
        .map((u: KeyValueItem) => `${encodeURIComponent(u.key)}=${encodeURIComponent(u.value)}`)
        .join('&');
      bodyRaw = urlencoded;
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    switch (lang) {
      case 'curl':
        return this.toCurl(method, url, headers, bodyRaw);
      case 'javascript-fetch':
        return this.toJsFetch(method, url, headers, bodyRaw);
      case 'javascript-axios':
        return this.toJsAxios(method, url, headers, bodyRaw);
      case 'python-requests':
        return this.toPythonRequests(method, url, headers, bodyRaw);
      case 'go':
        return this.toGo(method, url, headers, bodyRaw);
      case 'java-okhttp':
        return this.toJavaOkHttp(method, url, headers, bodyRaw);
      case 'php-curl':
        return this.toPhpCurl(method, url, headers, bodyRaw);
      default:
        return this.toCurl(method, url, headers, bodyRaw);
    }
  }

  private static toCurl(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    const lines: string[] = [`curl -X ${method} "${url}"`];
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`  -H "${key}: ${value}"`);
    }
    if (bodyRaw && method !== 'GET') {
      // Escape inner quotes
      const escapedBody = bodyRaw.replace(/"/g, '\\"');
      lines.push(`  --data "${escapedBody}"`);
    }
    return lines.join(' \\\n');
  }

  private static toJsFetch(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    const hasHeaders = Object.keys(headers).length > 0;
    const hasBody = bodyRaw && method !== 'GET';

    let optionsStr = `  method: "${method}",\n`;
    if (hasHeaders) {
      optionsStr += `  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')},\n`;
    }
    if (hasBody) {
      try {
        JSON.parse(bodyRaw);
        optionsStr += `  body: JSON.stringify(${bodyRaw.trim()}),\n`;
      } catch {
        optionsStr += `  body: ${JSON.stringify(bodyRaw)},\n`;
      }
    }

    return `fetch("${url}", {\n${optionsStr.trimEnd()}\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
  }

  private static toJsAxios(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    let dataSection = '';
    if (bodyRaw && method !== 'GET') {
      try {
        JSON.parse(bodyRaw);
        dataSection = `,\n  data: ${bodyRaw.trim()}`;
      } catch {
        dataSection = `,\n  data: ${JSON.stringify(bodyRaw)}`;
      }
    }

    return `import axios from 'axios';\n\naxios({\n  method: "${method.toLowerCase()}",\n  url: "${url}",\n  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')}${dataSection}\n})\n  .then(response => {\n    console.log(response.data);\n  })\n  .catch(error => {\n    console.error(error);\n  });`;
  }

  private static toPythonRequests(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    let bodyCode = '';
    if (bodyRaw && method !== 'GET') {
      try {
        JSON.parse(bodyRaw);
        bodyCode = `\npayload = ${bodyRaw.trim()}\n`;
      } catch {
        bodyCode = `\npayload = ${JSON.stringify(bodyRaw)}\n`;
      }
    }

    let callStr = `response = requests.${method.toLowerCase()}("${url}", headers=headers`;
    if (bodyCode) {
      callStr += bodyRaw.trim().startsWith('{') ? ', json=payload' : ', data=payload';
    }
    callStr += ')';

    return `import requests\n\nheaders = ${JSON.stringify(headers, null, 4)}${bodyCode}\n${callStr}\nprint(response.status_code)\nprint(response.json())`;
  }

  private static toGo(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    let bodyInit = 'nil';
    let bodyImport = '';
    if (bodyRaw && method !== 'GET') {
      bodyInit = `bytes.NewBuffer([]byte(${JSON.stringify(bodyRaw)}))`;
      bodyImport = '\n\t"bytes"';
    }

    let headerLines = '';
    for (const [k, v] of Object.entries(headers)) {
      headerLines += `\treq.Header.Set("${k}", "${v}")\n`;
    }

    return `package main\n\nimport (\n\t"fmt"\n\t"io"${bodyImport}\n\t"net/http"\n)\n\nfunc main() {\n\treq, err := http.NewRequest("${method}", "${url}", ${bodyInit})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n${headerLines}\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tbody, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(body))\n}`;
  }

  private static toJavaOkHttp(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    let bodyDeclaration = 'RequestBody body = null;';
    if (bodyRaw && method !== 'GET') {
      bodyDeclaration = `MediaType mediaType = MediaType.parse("${headers['Content-Type'] || 'application/json'}");\nRequestBody body = RequestBody.create(mediaType, ${JSON.stringify(bodyRaw)});`;
    }

    let headerCalls = '';
    for (const [k, v] of Object.entries(headers)) {
      headerCalls += `\n  .addHeader("${k}", "${v}")`;
    }

    let methodCall = '.get()';
    if (method === 'POST') methodCall = '.post(body)';
    else if (method === 'PUT') methodCall = '.put(body)';
    else if (method === 'PATCH') methodCall = '.patch(body)';
    else if (method === 'DELETE') methodCall = bodyRaw ? '.delete(body)' : '.delete()';
    else methodCall = `.method("${method}", body)`;

    return `import okhttp3.*;\nimport java.io.IOException;\n\npublic class Main {\n  public static void main(String[] args) throws IOException {\n    OkHttpClient client = new OkHttpClient();\n    ${bodyDeclaration}\n\n    Request request = new Request.Builder()\n      .url("${url}")\n      ${methodCall}${headerCalls}\n      .build();\n\n    Response response = client.newCall(request).execute();\n    System.out.println(response.body().string());\n  }\n}`;
  }

  private static toPhpCurl(method: string, url: string, headers: Record<string, string>, bodyRaw: string): string {
    const headerArr = Object.entries(headers).map(([k, v]) => `  "${k}: ${v}",`);
    const headerStr = headerArr.length > 0 ? `[\n${headerArr.join('\n')}\n]` : '[]';

    let bodyOption = '';
    if (bodyRaw && method !== 'GET') {
      bodyOption = `\ncurl_setopt($curl, CURLOPT_POSTFIELDS, ${JSON.stringify(bodyRaw)});`;
    }

    return `<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n  CURLOPT_URL => "${url}",\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_CUSTOMREQUEST => "${method}",\n  CURLOPT_HTTPHEADER => ${headerStr},\n]);${bodyOption}\n\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;`;
  }
}
