import { describe, it, expect } from 'vitest';
import { NetworkEngine } from '../src/main/network';
import { ApiDetail } from '../src/common/types';

describe('NetworkEngine Request Processor', () => {
  describe('Variable Interpolation', () => {
    it('should replace single and multiple variables correctly', () => {
      const vars = {
        host: 'api.example.com',
        version: 'v2',
        userId: '10086',
      };
      const template = 'https://{{host}}/{{version}}/users/{{userId}}';
      const result = NetworkEngine.interpolate(template, vars);
      expect(result).toBe('https://api.example.com/v2/users/10086');
    });

    it('should leave unknown variables untouched as {{var}}', () => {
      const vars = { known: 'value' };
      const template = 'https://example.com/{{known}}/{{unknown}}';
      const result = NetworkEngine.interpolate(template, vars);
      expect(result).toBe('https://example.com/value/{{unknown}}');
    });

    it('should handle spaces inside variable braces cleanly', () => {
      const vars = { token: 'secret' };
      const template = 'Bearer {{ token }}';
      const result = NetworkEngine.interpolate(template, vars);
      expect(result).toBe('Bearer secret');
    });

    it('should resolve nested and chained variable placeholders', () => {
      const vars = {
        protocol: 'https',
        domain: 'api.io',
        baseUrl: '{{protocol}}://{{domain}}',
        endpoint: '{{baseUrl}}/users',
      };
      const result = NetworkEngine.interpolate('{{endpoint}}/123', vars);
      expect(result).toBe('https://api.io/users/123');
    });
  });

  describe('Request Execution with PreUrl and Variable Verification', { timeout: 20000 }, () => {
    it('should handle preUrl prefixing when relative path is given', async () => {
      const api: ApiDetail = {
        target_id: 'test-1',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Test Get',
        method: 'GET',
        url: '/get?test=1',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(api, {}, {}, 'https://httpbin.org');
      expect(res.statusCode).toBe(200);
      expect(res.data).toBeDefined();
      expect(res.data.args?.test).toBe('1');
    });

    it('should request literal URL bar value when no environment is selected (无环境)', async () => {
      const api: ApiDetail = {
        target_id: 'test-noenv',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'No Env Test',
        method: 'GET',
        url: 'https://httpbin.org/get?env=none',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      // No preUrl passed
      const res = await NetworkEngine.executeRequest(api);
      expect(res.statusCode).toBe(200);
      expect(res.data?.args?.env).toBe('none');
      expect(res.actualRequest?.url).toBe('https://httpbin.org/get?env=none');
    });

    it('should concatenate baseUrl with path without leading slash or with trailing slash on baseUrl', async () => {
      const api: ApiDetail = {
        target_id: 'test-concat',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Concat Test',
        method: 'GET',
        url: 'get?test=concat',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(api, {}, {}, 'https://httpbin.org/');
      expect(res.statusCode).toBe(200);
      expect(res.data?.args?.test).toBe('concat');
      expect(res.actualRequest?.url).toBe('https://httpbin.org/get?test=concat');
    });

    it('should send headers and query parameters marked is_checked=1', async () => {
      const api: ApiDetail = {
        target_id: 'test-2',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Headers Test',
        method: 'GET',
        url: 'https://httpbin.org/headers',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: {
            parameter: [
              { param_id: 'h1', key: 'X-Mypost-Test', value: 'Active-Header', is_checked: 1 },
              { param_id: 'h2', key: 'X-Disabled', value: 'Should-Not-Send', is_checked: -1 },
            ],
          },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(api);
      expect(res.statusCode).toBe(200);
      expect(res.data.headers['X-Mypost-Test']).toBe('Active-Header');
      expect(res.data.headers['X-Disabled']).toBeUndefined();
    });

    it('should inject Bearer token into Authorization header', async () => {
      const api: ApiDetail = {
        target_id: 'test-3',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Auth Test',
        method: 'GET',
        url: 'https://httpbin.org/headers',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: {
            type: 'bearer',
            bearer: { token: 'my-bearer-token' },
          },
        },
      };

      const res = await NetworkEngine.executeRequest(api);
      expect(res.statusCode).toBe(200);
      expect(res.data.headers['Authorization']).toBe('Bearer my-bearer-token');
    });

    it('should send JSON body and execute post-response test assertions', async () => {
      const api: ApiDetail = {
        target_id: 'test-4',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'POST JSON Test',
        method: 'POST',
        url: 'https://httpbin.org/post',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: {
            mode: 'json',
            raw: JSON.stringify({ message: 'hello from mypost', count: 123 }),
          },
          auth: { type: 'none' },
          post_tasks: [
            {
              type: 'script',
              script: `
                pm.test("Status is 200", function () {
                  pm.response.to.have.status(200);
                });
                pm.test("Body parsed correctly", function () {
                  var json = pm.response.json();
                  pm.expect(json.json.count).to.equal(123);
                });
              `,
            },
          ],
        },
      };

      const res = await NetworkEngine.executeRequest(api);
      expect(res.statusCode).toBe(200);
      expect(res.tests).toBeDefined();
      expect(res.tests?.length).toBe(2);
      expect(res.tests?.[0].passed).toBe(true);
      expect(res.tests?.[1].passed).toBe(true);
    });

    it('should capture actualRequest details for actual request inspector', async () => {
      const api: ApiDetail = {
        target_id: 'test-5',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'Actual Request Inspector Test',
        method: 'POST',
        url: 'https://httpbin.org/post',
        sort: 1,
        status: 1,
        request: {
          query: {
            parameter: [{ param_id: 'q1', key: 'tab', value: 'actual', is_checked: 1 }],
          },
          path: {
            parameter: [{ param_id: 'p1', key: 'id', value: '42', is_checked: 1 }],
          },
          header: {
            parameter: [{ param_id: 'h1', key: 'X-App-Source', value: 'mypost', is_checked: 1 }],
          },
          cookie: {
            parameter: [{ param_id: 'c1', key: 'session_token', value: 'abc123xyz', is_checked: 1 }],
          },
          body: {
            mode: 'json',
            raw: JSON.stringify({ key: 'val' }),
          },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(api);
      expect(res.statusCode).toBe(200);
      expect(res.actualRequest).toBeDefined();
      expect(res.actualRequest?.method).toBe('POST');
      expect(res.actualRequest?.queryParams?.tab).toBe('actual');
      expect(res.actualRequest?.headers?.['X-App-Source']).toBe('mypost');
      expect(res.actualRequest?.headers?.['Cookie']).toContain('session_token=abc123xyz');
      expect(res.actualRequest?.fullUrl).toContain('tab=actual');
    });

    it('should parse Set-Cookie headers correctly', () => {
      const sample = [
        'sessionId=38afes7a8; Domain=example.com; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; HttpOnly',
        'theme=dark; Path=/',
      ];
      const parsed = NetworkEngine.parseSetCookie(sample);
      expect(parsed.length).toBe(2);
      expect(parsed[0].name).toBe('sessionId');
      expect(parsed[0].value).toBe('38afes7a8');
      expect(parsed[0].domain).toBe('example.com');
      expect(parsed[0].path).toBe('/');
      expect(parsed[0].httpOnly).toBe(true);
      expect(parsed[0].secure).toBe(true);

      expect(parsed[1].name).toBe('theme');
      expect(parsed[1].value).toBe('dark');
      expect(parsed[1].path).toBe('/');
    });

    it('should send raw body with proper Content-Type for xml and text', async () => {
      const apiXml: ApiDetail = {
        target_id: 'test-xml',
        parent_id: '0',
        project_id: 'proj-1',
        target_type: 'api',
        name: 'XML Raw Test',
        method: 'POST',
        url: 'https://httpbin.org/post',
        sort: 1,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: {
            mode: 'raw',
            raw_type: 'xml',
            raw: '<root><item>test</item></root>',
          },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(apiXml);
      expect(res.statusCode).toBe(200);
      expect(res.actualRequest?.headers?.['Content-Type']).toBe('application/xml');
      expect(res.actualRequest?.bodyData).toBe('<root><item>test</item></root>');
      expect(res.data.data).toContain('<root><item>test</item></root>');
    });

    it('should record actualRequest.bodyData when body mode is raw json', async () => {
      const apiJson: ApiDetail = {
        target_id: 'api-raw-json',
        project_id: 'proj-1',
        parent_id: '0',
        name: 'Raw JSON API',
        method: 'POST',
        url: 'https://httpbin.org/post',
        sort: 2,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: {
            mode: 'raw',
            raw_type: 'json',
            raw: '{"greeting":"hello world","count":42}',
          },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(apiJson);
      expect(res.statusCode).toBe(200);
      expect(res.actualRequest?.bodyData).toContain('"greeting": "hello world"');
      expect(res.actualRequest?.bodyData).toContain('"count": 42');
    });

    it('should handle manual cancellation via pre-aborted AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const api: ApiDetail = {
        target_id: 'api-cancel-pre',
        project_id: 'proj-1',
        parent_id: '0',
        name: 'Cancel Pre',
        method: 'GET',
        url: 'https://httpbin.org/get',
        sort: 3,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      const res = await NetworkEngine.executeRequest(api, {}, {}, '', controller.signal);
      expect(res.statusCode).toBe(0);
      expect(res.statusText).toBe('Canceled');
      expect(res.error).toBe('请求已被手动取消');
    });

    it('should handle in-flight manual cancellation via AbortSignal', async () => {
      const controller = new AbortController();

      const api: ApiDetail = {
        target_id: 'api-cancel-inflight',
        project_id: 'proj-1',
        parent_id: '0',
        name: 'Cancel In-flight',
        method: 'GET',
        url: 'https://httpbin.org/delay/5',
        sort: 4,
        status: 1,
        request: {
          query: { parameter: [] },
          header: { parameter: [] },
          body: { mode: 'none' },
          auth: { type: 'none' },
        },
      };

      setTimeout(() => controller.abort(), 150);
      const res = await NetworkEngine.executeRequest(api, {}, {}, '', controller.signal);
      expect(res.statusCode).toBe(0);
      expect(res.statusText).toBe('Canceled');
      expect(res.error).toBe('请求已被手动取消');
    });
  });
});
