import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import { encode } from '@msgpack/msgpack';
import { ApiDetail, HttpResponseResult } from '../common/types';
import { UrlUtils } from '../common/urlUtils';
import { ScriptRunner } from './scriptRunner';

export class NetworkEngine {
  private static httpAgent = new http.Agent({ keepAlive: true });
  private static httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

  public static interpolate(template: string, vars: Record<string, string>): string {
    if (!template) return '';
    let result = template;
    for (let i = 0; i < 5; i++) {
      let replaced = false;
      const next = result.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (match, key) => {
        if (vars[key] !== undefined) {
          replaced = true;
          return vars[key];
        }
        return match;
      });
      result = next;
      if (!replaced) break;
    }
    return result;
  }

  public static parseSetCookie(setCookieHeaders: string | string[] | undefined): Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
    httpOnly?: boolean;
    secure?: boolean;
    raw?: string;
  }> {
    if (!setCookieHeaders) return [];
    const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const results: any[] = [];

    for (const raw of list) {
      if (!raw || typeof raw !== 'string') continue;
      const parts = raw.split(';').map((p) => p.trim());
      if (parts.length === 0) continue;
      const [first, ...rest] = parts;
      const eqIdx = first.indexOf('=');
      const name = eqIdx > 0 ? first.substring(0, eqIdx).trim() : first.trim();
      const value = eqIdx > 0 ? first.substring(eqIdx + 1).trim() : '';

      let domain: string | undefined;
      let cookiePath: string | undefined;
      let expires: string | undefined;
      let httpOnly = false;
      let secure = false;

      for (const attr of rest) {
        const [k, ...vParts] = attr.split('=');
        const key = k.trim().toLowerCase();
        const val = vParts.join('=').trim();
        if (key === 'domain') domain = val;
        else if (key === 'path') cookiePath = val;
        else if (key === 'expires') expires = val;
        else if (key === 'httponly') httpOnly = true;
        else if (key === 'secure') secure = true;
      }

      results.push({
        name,
        value,
        domain,
        path: cookiePath,
        expires,
        httpOnly,
        secure,
        raw,
      });
    }

    return results;
  }

  public static async executeRequest(
    api: ApiDetail,
    envVars: Record<string, string> = {},
    globalVars: Record<string, string> = {},
    preUrl: string = '',
    signal?: AbortSignal
  ): Promise<HttpResponseResult> {
    const startTime = performance.now();
    let currentEnv = { ...envVars };
    let currentGlobals = { ...globalVars };
    const allLogs: string[] = [];

    if (signal?.aborted) {
      return {
        statusCode: 0,
        statusText: 'Canceled',
        timeMs: 0,
        sizeBytes: 0,
        headers: {},
        cookies: [],
        data: null,
        rawText: '',
        error: '请求已被手动取消',
        logs: [`[${new Date().toLocaleTimeString()}] [CANCEL] 请求已被手动取消`],
        actualRequest: undefined,
      };
    }

    // 1. Run Pre-request Scripts
    if (api.request.pre_tasks && api.request.pre_tasks.length > 0) {
      for (const task of api.request.pre_tasks) {
        if (task.script) {
          const preRes = ScriptRunner.runPreScript(task.script, {
            env: currentEnv,
            globals: currentGlobals,
          });
          currentEnv = preRes.env;
          currentGlobals = preRes.globals;
          allLogs.push(...preRes.logs);
        }
      }
    }

    const mergedVars = { ...currentGlobals, ...currentEnv };

    // 2. Resolve URL and Path Parameters
    const resolvedPreUrl = this.interpolate(preUrl || '', mergedVars);
    const { url: pathResolvedUrl, appliedParams: pathParams } = UrlUtils.applyPathParams(
      api.url ? api.url.trim() : '',
      api.request.path?.parameter,
      (val) => this.interpolate(val, mergedVars)
    );
    let targetUrl = UrlUtils.buildRequestUrl(pathResolvedUrl, resolvedPreUrl);

    // 3. Resolve Query Params (supports multi-value array params: ids=1&ids=2, ids[]=1&ids[]=2, and type === 'array')
    const queryParams: Record<string, string | string[]> = {};
    const querySearchParams = new URLSearchParams();
    if (api.request.query?.parameter) {
      for (const item of api.request.query.parameter) {
        if (item.is_checked === 1 && item.key) {
          const resolvedKey = this.interpolate(item.key, mergedVars);
          const rawVal = this.interpolate(item.value || '', mergedVars);

          // Support type === 'array' with JSON array value e.g. ["a", "b"]
          if ((item.data_type === 'array' || item.type === 'array') && rawVal.startsWith('[') && rawVal.endsWith(']')) {
            try {
              const parsed = JSON.parse(rawVal);
              if (Array.isArray(parsed)) {
                for (const elem of parsed) {
                  const elemStr = String(elem);
                  querySearchParams.append(resolvedKey, elemStr);
                  if (queryParams[resolvedKey] !== undefined) {
                    queryParams[resolvedKey] = Array.isArray(queryParams[resolvedKey])
                      ? [...(queryParams[resolvedKey] as string[]), elemStr]
                      : [queryParams[resolvedKey] as string, elemStr];
                  } else {
                    queryParams[resolvedKey] = [elemStr];
                  }
                }
                continue;
              }
            } catch {}
          }

          querySearchParams.append(resolvedKey, rawVal);
          if (queryParams[resolvedKey] !== undefined) {
            queryParams[resolvedKey] = Array.isArray(queryParams[resolvedKey])
              ? [...(queryParams[resolvedKey] as string[]), rawVal]
              : [queryParams[resolvedKey] as string, rawVal];
          } else {
            queryParams[resolvedKey] = rawVal;
          }
        }
      }
    }

    // Prevent duplicate query parameters if targetUrl already contains parameters defined in querySearchParams
    if (targetUrl.includes('?') && querySearchParams.size > 0) {
      const [baseUrlPart, queryStringPart] = targetUrl.split('?', 2);
      const urlSearchParams = new URLSearchParams(queryStringPart);
      let modified = false;
      for (const key of querySearchParams.keys()) {
        if (urlSearchParams.has(key)) {
          urlSearchParams.delete(key);
          modified = true;
        }
      }
      if (modified) {
        const remainingQuery = urlSearchParams.toString();
        targetUrl = remainingQuery ? `${baseUrlPart}?${remainingQuery}` : baseUrlPart;
      }
    }

    // 4. Resolve Headers
    const headers: Record<string, string> = {
      'User-Agent': 'mypost/1.0 (Desktop; Offline)',
    };
    const headerKeyLookup: Record<string, string> = {
      'user-agent': 'User-Agent',
    };
    if (api.request.header?.parameter) {
      for (const item of api.request.header.parameter) {
        if (item.is_checked === 1 && item.key) {
          const resolvedKey = this.interpolate(item.key, mergedVars).trim();
          const resolvedVal = this.interpolate(item.value || '', mergedVars);
          const lower = resolvedKey.toLowerCase();
          const existingKey = headerKeyLookup[lower];
          if (existingKey && existingKey !== resolvedKey) {
            delete headers[existingKey];
          }
          headers[resolvedKey] = resolvedVal;
          headerKeyLookup[lower] = resolvedKey;
        }
      }
    }

    // 5. Resolve Cookies
    if (api.request.cookie?.parameter) {
      const cookieParts: string[] = [];
      for (const item of api.request.cookie.parameter) {
        if (item.is_checked === 1 && item.key) {
          const ck = this.interpolate(item.key, mergedVars);
          const cv = this.interpolate(item.value || '', mergedVars);
          cookieParts.push(`${ck}=${cv}`);
        }
      }
      if (cookieParts.length > 0) {
        headers['Cookie'] = headers['Cookie']
          ? `${headers['Cookie']}; ${cookieParts.join('; ')}`
          : cookieParts.join('; ');
      }
    }

    // 6. Resolve Auth
    if (api.request.auth) {
      if (api.request.auth.type === 'bearer' && api.request.auth.bearer?.token) {
        headers['Authorization'] = `Bearer ${this.interpolate(api.request.auth.bearer.token, mergedVars)}`;
      } else if (api.request.auth.type === 'basic' && api.request.auth.basic) {
        const u = this.interpolate(api.request.auth.basic.username || '', mergedVars);
        const p = this.interpolate(api.request.auth.basic.password || '', mergedVars);
        const cred = Buffer.from(`${u}:${p}`).toString('base64');
        headers['Authorization'] = `Basic ${cred}`;
      } else if (api.request.auth.type === 'apikey' && api.request.auth.apikey) {
        const k = this.interpolate(api.request.auth.apikey.key || '', mergedVars);
        const v = this.interpolate(api.request.auth.apikey.value || '', mergedVars);
        if (api.request.auth.apikey.in === 'header') {
          headers[k] = v;
        } else {
          queryParams[k] = v;
        }
      }
    }

    // 7. Resolve Body
    let dataPayload: any = undefined;
    const bodyMode = api.request.body?.mode || 'none';
    const formParamsRecorded: Record<string, { value: string; type: string; fileName?: string }> = {};

    if (bodyMode === 'json') {
      const rawBody = this.interpolate(api.request.body?.raw || '{}', mergedVars);
      try {
        dataPayload = JSON.parse(rawBody);
      } catch {
        dataPayload = rawBody;
      }
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    } else if (bodyMode === 'form-data') {
      const formData = new FormData();
      if (api.request.body?.parameter) {
        for (const item of api.request.body.parameter) {
          if (item.is_checked === 1 && item.key) {
            const resolvedKey = this.interpolate(item.key, mergedVars);
            const isFile = item.type === 'file' || item.data_type === 'file';

            if (isFile) {
              const filePath = item.file_path || item.value || '';
              if (filePath && fs.existsSync(filePath)) {
                try {
                  const fileBuffer = fs.readFileSync(filePath);
                  const fileName = item.file_name || path.basename(filePath);
                  const blob = new Blob([fileBuffer], {
                    type: item.content_type || 'application/octet-stream',
                  });
                  formData.append(resolvedKey, blob, fileName);
                  formParamsRecorded[resolvedKey] = {
                    value: filePath,
                    type: 'file',
                    fileName,
                  };
                } catch (e: any) {
                  allLogs.push(`[Form-Data] 读取文件异常 ${filePath}: ${e.message}`);
                }
              } else {
                if (filePath) {
                  allLogs.push(`[Form-Data] 未找到指定文件: ${filePath}`);
                }
                formParamsRecorded[resolvedKey] = {
                  value: filePath || '(未选择文件)',
                  type: 'file',
                };
              }
            } else {
              const resolvedVal = this.interpolate(item.value || '', mergedVars);
              formData.append(resolvedKey, resolvedVal);
              formParamsRecorded[resolvedKey] = {
                value: resolvedVal,
                type: item.data_type || 'string',
              };
            }
          }
        }
      }
      dataPayload = formData;
      // Let Axios automatically construct multipart/form-data boundary
      delete headers['Content-Type'];
    } else if (bodyMode === 'urlencoded') {
      const formParams = new URLSearchParams();
      if (api.request.body?.parameter) {
        for (const item of api.request.body.parameter) {
          if (item.is_checked === 1 && item.key) {
            const k = this.interpolate(item.key, mergedVars);
            const v = this.interpolate(item.value || '', mergedVars);
            formParams.append(k, v);
            formParamsRecorded[k] = { value: v, type: item.data_type || 'string' };
          }
        }
      }
      dataPayload = formParams.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (bodyMode === 'binary') {
      const rawPath = api.request.body?.binary_file || api.request.body?.raw || '';
      if (rawPath && fs.existsSync(rawPath)) {
        try {
          dataPayload = fs.readFileSync(rawPath);
        } catch {
          dataPayload = Buffer.from(this.interpolate(rawPath, mergedVars));
        }
      } else {
        dataPayload = Buffer.from(this.interpolate(rawPath, mergedVars));
      }
      headers['Content-Type'] = headers['Content-Type'] || 'application/octet-stream';
    } else if (bodyMode === 'msgpack') {
      const rawText = this.interpolate(api.request.body?.msgpack_raw || api.request.body?.raw || '', mergedVars);
      headers['Content-Type'] = headers['Content-Type'] || 'application/msgpack';
      try {
        const parsed = JSON.parse(rawText);
        dataPayload = Buffer.from(encode(parsed));
      } catch {
        dataPayload = Buffer.from(encode(rawText));
      }
    } else if (bodyMode === 'raw') {
      const rawText = this.interpolate(api.request.body?.raw || '', mergedVars);
      const rawType = api.request.body?.raw_type || 'json';
      dataPayload = rawText;
      if (rawType === 'json') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        try {
          dataPayload = JSON.parse(rawText);
        } catch {
          dataPayload = rawText;
        }
      } else if (rawType === 'xml') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/xml';
      } else {
        headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
      }
    }

    // Capture Actual Request info for "实际请求" tab
    const queryStr = querySearchParams.toString();
    const fullSentUrl = queryStr
      ? targetUrl.includes('?')
        ? `${targetUrl}&${queryStr}`
        : `${targetUrl}?${queryStr}`
      : targetUrl;

    let recordedBodyData: string | undefined = undefined;
    if (bodyMode === 'raw' || bodyMode === 'json') {
      if (typeof dataPayload === 'string') {
        recordedBodyData = dataPayload;
      } else if (dataPayload !== undefined && dataPayload !== null) {
        recordedBodyData = JSON.stringify(dataPayload, null, 2);
      } else if (api.request.body?.raw) {
        recordedBodyData = this.interpolate(api.request.body.raw, mergedVars);
      }
    } else if (bodyMode === 'msgpack') {
      recordedBodyData = this.interpolate(api.request.body?.msgpack_raw || api.request.body?.raw || '', mergedVars);
    } else if (typeof dataPayload === 'string') {
      recordedBodyData = dataPayload;
    }

    const actualRequestInfo = {
      method: (api.method || 'GET').toUpperCase(),
      url: targetUrl,
      fullUrl: fullSentUrl,
      headers: { ...headers },
      queryParams: { ...queryParams },
      pathParams: { ...pathParams },
      bodyMode,
      bodyData: recordedBodyData,
      formParams: formParamsRecorded,
    };

    // Detailed diagnostic logging for console
    const reqTimeStr = new Date().toLocaleTimeString();
    allLogs.push(`[${reqTimeStr}] [REQ] 发起请求: ${(api.method || 'GET').toUpperCase()} ${fullSentUrl}`);
    if (Object.keys(headers).length > 0) {
      allLogs.push(`[${reqTimeStr}] [REQ-HEADER] ${JSON.stringify(headers)}`);
    }
    if (Object.keys(queryParams).length > 0) {
      allLogs.push(`[${reqTimeStr}] [REQ-QUERY] ${JSON.stringify(queryParams)}`);
    }
    if (Object.keys(pathParams).length > 0) {
      allLogs.push(`[${reqTimeStr}] [REQ-PATH] ${JSON.stringify(pathParams)}`);
    }
    if (bodyMode !== 'none') {
      const bodySummary =
        recordedBodyData ||
        (Object.keys(formParamsRecorded).length > 0 ? JSON.stringify(formParamsRecorded) : '');
      allLogs.push(`[${reqTimeStr}] [REQ-BODY] (mode: ${bodyMode}) ${bodySummary || '<空载荷>'}`);
    }

    // 8. Execute Request via Axios
    const config: AxiosRequestConfig = {
      method: api.method || 'GET',
      url: targetUrl,
      params: querySearchParams.size > 0 ? querySearchParams : undefined,
      headers,
      data: dataPayload,
      timeout: 0, // No timeout limit as requested
      validateStatus: () => true, // Don't throw on 4xx/5xx
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      transformResponse: [(d) => d], // Keep raw string
      signal,
    };

    try {
      const response = await axios(config);
      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);

      const rawText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const sizeBytes = Buffer.byteLength(rawText || '', 'utf-8');

      let parsedData: any = null;
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = rawText;
      }

      const resHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(response.headers)) {
        if (v !== undefined) resHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
      }

      const parsedCookies = this.parseSetCookie(response.headers['set-cookie']);

      const resTimeStr = new Date().toLocaleTimeString();
      allLogs.push(
        `[${resTimeStr}] [RES] 响应完成: HTTP ${response.status} ${response.statusText || 'OK'} (耗时: ${timeMs}ms, 大小: ${sizeBytes} B)`
      );
      if (Object.keys(resHeaders).length > 0) {
        allLogs.push(`[${resTimeStr}] [RES-HEADER] ${JSON.stringify(resHeaders)}`);
      }

      // 9. Run Post-response Test Scripts
      let testResults: any[] = [];
      if (api.request.post_tasks && api.request.post_tasks.length > 0) {
        for (const task of api.request.post_tasks) {
          if (task.script) {
            const testRes = ScriptRunner.runTests(
              task.script,
              {
                code: response.status,
                responseTime: timeMs,
                responseSize: sizeBytes,
                rawText,
                data: parsedData,
              },
              {
                env: currentEnv,
                globals: currentGlobals,
              }
            );
            testResults.push(...testRes.tests);
            allLogs.push(...testRes.logs);
          }
        }
      }

      return {
        statusCode: response.status,
        statusText: response.statusText || 'OK',
        timeMs,
        sizeBytes,
        headers: resHeaders,
        cookies: parsedCookies,
        data: parsedData,
        rawText,
        tests: testResults,
        logs: allLogs,
        actualRequest: actualRequestInfo,
      };
    } catch (err: any) {
      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);
      const errTimeStr = new Date().toLocaleTimeString();

      const isCanceled =
        axios.isCancel(err) ||
        err?.name === 'CanceledError' ||
        err?.code === 'ERR_CANCELED' ||
        signal?.aborted;

      if (isCanceled) {
        allLogs.push(`[${errTimeStr}] [CANCEL] 请求已被手动取消`);
        return {
          statusCode: 0,
          statusText: 'Canceled',
          timeMs,
          sizeBytes: 0,
          headers: {},
          cookies: [],
          data: null,
          rawText: '',
          error: '请求已被手动取消',
          logs: allLogs,
          actualRequest: actualRequestInfo,
        };
      }

      allLogs.push(`[${errTimeStr}] [ERROR] 请求异常: ${err.message || err}`);
      if (err.code) {
        allLogs.push(`[${errTimeStr}] [ERROR-CODE] ${err.code}`);
      }
      return {
        statusCode: 0,
        statusText: 'Network Error',
        timeMs,
        sizeBytes: 0,
        headers: {},
        cookies: [],
        data: null,
        rawText: '',
        error: err.message || '请求发送失败，请检查目标服务或网络连接',
        logs: allLogs,
        actualRequest: actualRequestInfo,
      };
    }
  }
}
