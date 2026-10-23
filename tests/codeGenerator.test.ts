import { describe, it, expect } from 'vitest';
import { CodeGenerator } from '../src/common/codeGenerator';
import { ApiDetail } from '../src/common/types';

describe('CodeGenerator Engine', () => {
  const sampleApi: ApiDetail = {
    target_id: 'api-1',
    parent_id: '0',
    project_id: 'proj-1',
    target_type: 'api',
    name: 'Create User',
    method: 'POST',
    url: 'https://api.example.com/users?source=web',
    sort: 1000,
    status: 1,
    request: {
      query: {
        parameter: [
          { param_id: 'q1', key: 'role', value: 'admin', is_checked: 1 },
          { param_id: 'q2', key: 'disabled_q', value: 'skip', is_checked: -1 },
        ],
      },
      header: {
        parameter: [
          { param_id: 'h1', key: 'Content-Type', value: 'application/json', is_checked: 1 },
          { param_id: 'h2', key: 'X-Trace-Id', value: 'trace-888', is_checked: 1 },
          { param_id: 'h3', key: 'Unchecked-Header', value: 'none', is_checked: -1 },
        ],
      },
      body: {
        mode: 'json',
        raw: JSON.stringify({ name: 'Alice', age: 25 }),
      },
      auth: {
        type: 'bearer',
        bearer: { token: 'secret-token-123' },
      },
    },
  };

  it('should generate valid cURL command', () => {
    const code = CodeGenerator.generate(sampleApi, 'curl');
    expect(code).toContain('curl -X POST "https://api.example.com/users?source=web&role=admin"');
    expect(code).toContain('-H "Content-Type: application/json"');
    expect(code).toContain('-H "X-Trace-Id: trace-888"');
    expect(code).toContain('-H "Authorization: Bearer secret-token-123"');
    expect(code).not.toContain('Unchecked-Header');
    expect(code).toContain('--data');
    expect(code).toContain('Alice');
  });

  it('should generate valid JavaScript Fetch code', () => {
    const code = CodeGenerator.generate(sampleApi, 'javascript-fetch');
    expect(code).toContain('fetch("https://api.example.com/users?source=web&role=admin"');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('"Authorization": "Bearer secret-token-123"');
    expect(code).toContain('body: JSON.stringify(');
    expect(code).toContain('.then(res => res.json())');
  });

  it('should generate valid JavaScript Axios code', () => {
    const code = CodeGenerator.generate(sampleApi, 'javascript-axios');
    expect(code).toContain('axios({');
    expect(code).toContain('method: "post"');
    expect(code).toContain('url: "https://api.example.com/users?source=web&role=admin"');
    expect(code).toContain('"X-Trace-Id": "trace-888"');
  });

  it('should generate valid Python Requests code', () => {
    const code = CodeGenerator.generate(sampleApi, 'python-requests');
    expect(code).toContain('import requests');
    expect(code).toContain('response = requests.post(');
    expect(code).toContain('"Authorization": "Bearer secret-token-123"');
    expect(code).toContain('json=');
  });

  it('should generate valid Go net/http code', () => {
    const code = CodeGenerator.generate(sampleApi, 'go');
    expect(code).toContain('http.NewRequest("POST"');
    expect(code).toContain('req.Header.Set("Authorization", "Bearer secret-token-123")');
    expect(code).toContain('http.DefaultClient.Do(req)');
  });

  it('should generate valid Java OkHttp code', () => {
    const code = CodeGenerator.generate(sampleApi, 'java-okhttp');
    expect(code).toContain('OkHttpClient client = new OkHttpClient();');
    expect(code).toContain('.post(body)');
    expect(code).toContain('.addHeader("Authorization", "Bearer secret-token-123")');
  });

  it('should generate valid PHP cURL code', () => {
    const code = CodeGenerator.generate(sampleApi, 'php-curl');
    expect(code).toContain('curl_init()');
    expect(code).toContain('CURLOPT_CUSTOMREQUEST => "POST"');
    expect(code).toContain('Authorization: Bearer secret-token-123');
  });

  it('should handle preUrl prefix for relative paths', () => {
    const relativeApi: ApiDetail = {
      ...sampleApi,
      url: '/users/profile',
    };
    const code = CodeGenerator.generate(relativeApi, 'curl', 'https://gateway.example.com/api');
    expect(code).toContain('https://gateway.example.com/api/users/profile');
  });

  it('should generate valid SSE snippets', () => {
    const sseApi: ApiDetail = {
      ...sampleApi,
      target_type: 'sse',
      url: '/stream/events',
    };
    const langs = CodeGenerator.getLanguagesForApi(sseApi);
    expect(langs.some((l) => l.id === 'sse-eventsource')).toBe(true);

    const esCode = CodeGenerator.generate(sseApi, 'sse-eventsource', 'https://api.example.com');
    expect(esCode).toContain('new EventSource("https://api.example.com/stream/events?role=admin")');
    expect(esCode).toContain('eventSource.onmessage');

    const fetchCode = CodeGenerator.generate(sseApi, 'sse-fetch', 'https://api.example.com');
    expect(fetchCode).toContain('fetch("https://api.example.com/stream/events?role=admin"');
    expect(fetchCode).toContain('getReader()');

    const pyCode = CodeGenerator.generate(sseApi, 'sse-python', 'https://api.example.com');
    expect(pyCode).toContain('import httpx');
    expect(pyCode).toContain('client.stream(');
  });

  it('should generate valid WebSocket snippets and format ws url', () => {
    const wsApi: ApiDetail = {
      ...sampleApi,
      target_type: 'websocket',
      url: '/chat/ws',
    };
    const langs = CodeGenerator.getLanguagesForApi(wsApi);
    expect(langs.some((l) => l.id === 'ws-browser')).toBe(true);
    expect(langs.some((l) => l.id === 'ws-node')).toBe(true);

    const browserCode = CodeGenerator.generate(wsApi, 'ws-browser', 'https://echo.example.com');
    expect(browserCode).toContain('new WebSocket("wss://echo.example.com/chat/ws?role=admin")');
    expect(browserCode).toContain('ws.onmessage');

    const nodeCode = CodeGenerator.generate(wsApi, 'ws-node', 'https://echo.example.com');
    expect(nodeCode).toContain("import WebSocket from 'ws'");

    const pyWsCode = CodeGenerator.generate(wsApi, 'ws-python', 'http://localhost:8080');
    expect(pyWsCode).toContain('ws://localhost:8080/chat/ws?role=admin');

    const wscatCode = CodeGenerator.generate(wsApi, 'ws-wscat', 'wss://example.com');
    expect(wscatCode).toContain('wscat -c "wss://example.com/chat/ws?role=admin"');
  });

  it('should not duplicate query parameters if url already has same query param key', () => {
    const apiWithDuplicateQuery: ApiDetail = {
      ...sampleApi,
      url: 'https://api.example.com/users?source=web&role=admin',
      request: {
        ...sampleApi.request,
        query: {
          parameter: [
            { param_id: 'q1', key: 'role', value: 'admin', is_checked: 1 },
          ],
        },
      },
    };
    const code = CodeGenerator.generate(apiWithDuplicateQuery, 'curl');
    expect(code).toContain('curl -X POST "https://api.example.com/users?source=web&role=admin"');
    expect(code).not.toContain('role=admin&role=admin');
  });

  it('should support array query parameters with multiple rows and JSON array values', () => {
    const apiWithArray: ApiDetail = {
      ...sampleApi,
      url: 'https://api.example.com/search',
      request: {
        ...sampleApi.request,
        query: {
          parameter: [
            { param_id: 'q1', key: 'filter', value: 'news', is_checked: 1 },
            { param_id: 'q2', key: 'filter', value: 'video', is_checked: 1 },
            { param_id: 'q3', key: 'tag', value: '["tech","ai"]', type: 'array', is_checked: 1 },
          ],
        },
      },
    };
    const code = CodeGenerator.generate(apiWithArray, 'curl');
    expect(code).toContain('filter=news&filter=video');
    expect(code).toContain('tag=tech&tag=ai');
  });

  it('should generate form-data with text and file parameters across all language generators without losing file params', () => {
    const formDataApi: ApiDetail = {
      ...sampleApi,
      method: 'POST',
      url: 'https://api.example.com/upload',
      request: {
        ...sampleApi.request,
        body: {
          mode: 'form-data',
          parameter: [
            { param_id: 'p1', key: 'username', value: 'john_doe', type: 'text', is_checked: 1 },
            {
              param_id: 'p2',
              key: 'avatar',
              value: 'avatar.png',
              file_path: '/path/to/avatar.png',
              file_name: 'avatar.png',
              content_type: 'image/png',
              type: 'file',
              is_checked: 1,
            },
            {
              param_id: 'p3',
              key: 'doc',
              value: '',
              file_path: 'report.pdf',
              file_name: 'report.pdf',
              content_type: 'application/pdf',
              data_type: 'file',
              is_checked: 1,
            },
            { param_id: 'p4', key: 'ignored', value: 'skip', is_checked: -1 },
          ],
        },
      },
    };

    // cURL
    const curlCode = CodeGenerator.generate(formDataApi, 'curl');
    expect(curlCode).toContain('-F "username=john_doe"');
    expect(curlCode).toContain('-F "avatar=@/path/to/avatar.png;type=image/png"');
    expect(curlCode).toContain('-F "doc=@report.pdf;type=application/pdf"');
    expect(curlCode).not.toContain('ignored');

    // JS Fetch
    const fetchCode = CodeGenerator.generate(formDataApi, 'javascript-fetch');
    expect(fetchCode).toContain('const formData = new FormData();');
    expect(fetchCode).toContain('formData.append("username", "john_doe");');
    expect(fetchCode).toContain('formData.append("avatar",');
    expect(fetchCode).toContain('formData.append("doc",');
    expect(fetchCode).toContain('body: formData');

    // JS Axios
    const axiosCode = CodeGenerator.generate(formDataApi, 'javascript-axios');
    expect(axiosCode).toContain("import FormData from 'form-data';");
    expect(axiosCode).toContain("import fs from 'fs';");
    expect(axiosCode).toContain('formData.append("username", "john_doe");');
    expect(axiosCode).toContain('formData.append("avatar", fs.createReadStream("/path/to/avatar.png"));');
    expect(axiosCode).toContain('formData.append("doc", fs.createReadStream("report.pdf"));');
    expect(axiosCode).toContain('data: formData');

    // Python
    const pyCode = CodeGenerator.generate(formDataApi, 'python-requests');
    expect(pyCode).toContain('"username": "john_doe"');
    expect(pyCode).toContain('files = [');
    expect(pyCode).toContain('("avatar", ("avatar.png", open("/path/to/avatar.png", "rb"), "image/png"))');
    expect(pyCode).toContain('("doc", ("report.pdf", open("report.pdf", "rb"), "application/pdf"))');
    expect(pyCode).toContain('data=data, files=files');

    // Go
    const goCode = CodeGenerator.generate(formDataApi, 'go');
    expect(goCode).toContain('multipart.NewWriter(body)');
    expect(goCode).toContain('writer.WriteField("username", "john_doe")');
    expect(goCode).toContain('writer.CreateFormFile("avatar", "avatar.png")');
    expect(goCode).toContain('writer.CreateFormFile("doc", "report.pdf")');

    // Java OkHttp
    const javaCode = CodeGenerator.generate(formDataApi, 'java-okhttp');
    expect(javaCode).toContain('new MultipartBody.Builder()');
    expect(javaCode).toContain('.addFormDataPart("username", "john_doe")');
    expect(javaCode).toContain('.addFormDataPart("avatar", "avatar.png"');
    expect(javaCode).toContain('new File("/path/to/avatar.png")');

    // PHP cURL
    const phpCode = CodeGenerator.generate(formDataApi, 'php-curl');
    expect(phpCode).toContain('"username" => "john_doe"');
    expect(phpCode).toContain('"avatar" => new CURLFile("/path/to/avatar.png", "image/png", "avatar.png")');
    expect(phpCode).toContain('"doc" => new CURLFile("report.pdf", "application/pdf", "report.pdf")');
  });

  describe('Placeholder Variable Interpolation in Code Generation', () => {
    it('should correctly interpolate simple, nested, and dynamic placeholder variables', () => {
      const vars = {
        domain: 'example.com',
        baseUrl: 'https://{{domain}}/api/v1',
        token: 'secret-xyz-789',
        user: { value: 'alice_123' },
      };

      expect(CodeGenerator.interpolate('{{baseUrl}}/users', vars)).toBe('https://example.com/api/v1/users');
      expect(CodeGenerator.interpolate('Bearer {{token}}', vars)).toBe('Bearer secret-xyz-789');
      expect(CodeGenerator.interpolate('User: {{ user }}', vars)).toBe('User: alice_123');
      expect(CodeGenerator.interpolate('Undefined: {{not_exist}}', vars)).toBe('Undefined: {{not_exist}}');

      // Dynamic variables
      const ts = CodeGenerator.interpolate('{{$timestamp}}');
      expect(Number(ts)).toBeGreaterThan(1700000000);
      const uuid = CodeGenerator.interpolate('{{$guid}}');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should replace placeholder variables across url, path, query, headers, cookies, auth, and body', () => {
      const varApi: ApiDetail = {
        target_id: 'api-var-1',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Variable Test API',
        method: 'POST',
        url: '{{baseUrl}}/users/:userId',
        sort: 1000,
        status: 1,
        request: {
          path: {
            parameter: [{ param_id: 'p1', key: ':userId', value: '{{currentUserId}}', is_checked: 1 }],
          },
          query: {
            parameter: [
              { param_id: 'q1', key: 'search', value: '{{searchTerm}}', is_checked: 1 },
            ],
          },
          header: {
            parameter: [
              { param_id: 'h1', key: 'X-App-Env', value: '{{envName}}', is_checked: 1 },
              { param_id: 'h2', key: '{{customHeaderKey}}', value: '{{customHeaderVal}}', is_checked: 1 },
            ],
          },
          cookie: {
            parameter: [
              { param_id: 'c1', key: 'session', value: '{{sessionId}}', is_checked: 1 },
            ],
          },
          auth: {
            type: 'bearer',
            bearer: { token: '{{token}}' },
          },
          body: {
            mode: 'json',
            raw: '{\n  "id": "{{currentUserId}}",\n  "env": "{{envName}}"\n}',
          },
        },
      };

      const variables = {
        baseUrl: 'https://test.api.io',
        currentUserId: 'usr_8888',
        searchTerm: 'find_me',
        envName: 'production',
        customHeaderKey: 'X-Client-Ver',
        customHeaderVal: 'v2.5.0',
        sessionId: 'sess_abc123',
        token: 'jwt_valid_token_value',
      };

      // 1. With variables provided
      const curlCode = CodeGenerator.generate(varApi, 'curl', '', variables);
      expect(curlCode).toContain('curl -X POST "https://test.api.io/users/usr_8888?search=find_me"');
      expect(curlCode).toContain('-H "X-App-Env: production"');
      expect(curlCode).toContain('-H "X-Client-Ver: v2.5.0"');
      expect(curlCode).toContain('-H "Authorization: Bearer jwt_valid_token_value"');
      expect(curlCode).toContain('-H "Cookie: session=sess_abc123"');
      expect(curlCode).toContain('\\"id\\": \\"usr_8888\\"');
      expect(curlCode).toContain('\\"env\\": \\"production\\"');

      // JS Fetch with variables
      const fetchCode = CodeGenerator.generate(varApi, 'javascript-fetch', '', variables);
      expect(fetchCode).toContain('fetch("https://test.api.io/users/usr_8888?search=find_me"');
      expect(fetchCode).toContain('"Authorization": "Bearer jwt_valid_token_value"');
      expect(fetchCode).toContain('"Cookie": "session=sess_abc123"');
      expect(fetchCode).toContain('"id": "usr_8888"');

      // Python Requests with variables
      const pyCode = CodeGenerator.generate(varApi, 'python-requests', '', variables);
      expect(pyCode).toContain('"https://test.api.io/users/usr_8888?search=find_me"');
      expect(pyCode).toContain('"Authorization": "Bearer jwt_valid_token_value"');

      // 2. Without variables provided (retains placeholder templates)
      const rawCurl = CodeGenerator.generate(varApi, 'curl');
      expect(rawCurl).toContain('{{baseUrl}}');
      expect(rawCurl).toContain('X-App-Env: {{envName}}');
      expect(rawCurl).toContain('Bearer {{token}}');
      expect(rawCurl).toContain('session={{sessionId}}');
    });

    it('should interpolate variables in form-data file path and WebSocket message drafts', () => {
      const formApi: ApiDetail = {
        target_id: 'form-var-1',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Form Var API',
        method: 'POST',
        url: 'https://example.com/upload',
        sort: 1000,
        status: 1,
        request: {
          body: {
            mode: 'form-data',
            parameter: [
              { param_id: 'f1', key: 'avatar', type: 'file', value: '{{avatar_file}}', file_path: '{{avatar_file}}', file_name: '{{avatar_name}}', content_type: 'image/jpeg', is_checked: 1 },
              { param_id: 'f2', key: 'desc', type: 'text', value: 'User avatar for {{username}}', is_checked: 1 },
            ],
          },
        },
      };

      const vars = {
        avatar_file: '/uploads/custom_pic.jpg',
        avatar_name: 'custom_pic.jpg',
        username: 'john_doe',
      };

      const curl = CodeGenerator.generate(formApi, 'curl', '', vars);
      expect(curl).toContain('-F "avatar=@/uploads/custom_pic.jpg;type=image/jpeg"');
      expect(curl).toContain('-F "desc=User avatar for john_doe"');

      // WebSocket with messageDraft
      const wsApi: ApiDetail = {
        target_id: 'ws-var-1',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'websocket',
        name: 'WS Var API',
        method: 'GET',
        url: 'wss://echo.websocket.events/chat',
        sort: 1000,
        status: 1,
        websocket: {
          protocols: '',
          heartbeat: { enabled: false, interval: 30, message: 'ping' },
          messageDraft: '{"action": "greet", "user": "{{username}}"}',
          messageMode: 'json',
        },
      };

      const wsBrowser = CodeGenerator.generate(wsApi, 'ws-browser', '', vars);
      expect(wsBrowser).toContain('ws.send("{\\"action\\": \\"greet\\", \\"user\\": \\"john_doe\\"}");');
    });
  });
});

