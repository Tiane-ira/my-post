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
});
