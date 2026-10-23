import { describe, it, expect } from 'vitest';
import { UrlUtils } from '../src/common/urlUtils';
import { KeyValueItem } from '../src/common/types';

describe('UrlUtils Bi-directional Synchronizer', () => {
  it('should parse query parameters from URL and preserve unchecked keys', () => {
    const existingParams: KeyValueItem[] = [
      { param_id: 'p1', key: 'custom_disabled', value: '123', is_checked: -1 },
    ];
    const url = 'https://api.example.com/users?page=1&size=20&name=alice';

    const result = UrlUtils.syncUrlToParams(url, existingParams);

    expect(result.queryParams.length).toBe(4);
    expect(result.queryParams.find((p) => p.key === 'page')?.value).toBe('1');
    expect(result.queryParams.find((p) => p.key === 'size')?.value).toBe('20');
    expect(result.queryParams.find((p) => p.key === 'name')?.value).toBe('alice');
    // Preserved disabled param
    expect(result.queryParams.find((p) => p.key === 'custom_disabled')?.is_checked).toBe(-1);
  });

  it('should rebuild URL with checked query parameters', () => {
    const rawUrl = 'https://api.example.com/search?old=true';
    const params: KeyValueItem[] = [
      { param_id: '1', key: 'keyword', value: 'mypost', is_checked: 1 },
      { param_id: '2', key: 'lang', value: 'zh-CN', is_checked: 1 },
      { param_id: '3', key: 'disabled_filter', value: 'skip', is_checked: -1 },
    ];

    const newUrl = UrlUtils.syncParamsToUrl(rawUrl, params);
    expect(newUrl).toBe('https://api.example.com/search?keyword=mypost&lang=zh-CN');
    expect(newUrl).not.toContain('disabled_filter');
    expect(newUrl).not.toContain('old=true');
  });

  it('should handle URL with no query parameters cleanly', () => {
    const rawUrl = 'https://api.example.com/users';
    const params: KeyValueItem[] = [
      { param_id: '1', key: 'type', value: 'admin', is_checked: 1 },
    ];

    const newUrl = UrlUtils.syncParamsToUrl(rawUrl, params);
    expect(newUrl).toBe('https://api.example.com/users?type=admin');

    const emptyParams: KeyValueItem[] = [];
    const strippedUrl = UrlUtils.syncParamsToUrl(newUrl, emptyParams);
    expect(strippedUrl).toBe('https://api.example.com/users');
  });

  it('should extract path parameters from URL path portion (:param and {param})', () => {
    const url = 'http://localhost:8080/api/v1/users/:userId/books/{bookId}?page=1';
    const existing: KeyValueItem[] = [
      { param_id: 'p-user', key: 'userId', value: 'U999', is_checked: 1 },
    ];

    const params = UrlUtils.extractPathParams(url, existing);
    expect(params.length).toBe(2);

    const userParam = params.find((p) => p.key === 'userId');
    expect(userParam?.value).toBe('U999');
    expect(userParam?.param_id).toBe('p-user');

    const bookParam = params.find((p) => p.key === 'bookId');
    expect(bookParam).toBeDefined();
    expect(bookParam?.value).toBe('');
  });

  it('should sync modified path parameters back to URL tokens', () => {
    const url = 'https://api.com/users/:id/books/{bookId}?sort=desc';
    const oldParams: KeyValueItem[] = [
      { param_id: '1', key: 'id', value: '10' },
      { param_id: '2', key: 'bookId', value: '99' },
    ];

    // Rename id to userId
    const renamed = [
      { param_id: '1', key: 'userId', value: '10' },
      { param_id: '2', key: 'bookId', value: '99' },
    ];
    expect(UrlUtils.syncPathParamsToUrl(url, renamed, oldParams)).toBe(
      'https://api.com/users/:userId/books/{bookId}?sort=desc'
    );

    // Add new path parameter
    const added = [
      { param_id: '1', key: 'id', value: '10', is_checked: 1 },
      { param_id: '2', key: 'bookId', value: '99', is_checked: 1 },
      { param_id: '3', key: 'chapter', value: '1', is_checked: 1 },
    ];
    expect(UrlUtils.syncPathParamsToUrl(url, added, oldParams)).toBe(
      'https://api.com/users/:id/books/{bookId}/:chapter?sort=desc'
    );

    // Delete id
    const deleted = [{ param_id: '2', key: 'bookId', value: '99' }];
    expect(UrlUtils.syncPathParamsToUrl(url, deleted, oldParams)).toBe(
      'https://api.com/users/books/{bookId}?sort=desc'
    );
  });

  describe('buildRequestUrl & Environment BaseUrl Concatenation', () => {
    it('when no environment is selected, request url is the URL bar value', () => {
      // Full HTTP / HTTPS URLs
      expect(UrlUtils.buildRequestUrl('https://httpbin.org/get')).toBe('https://httpbin.org/get');
      expect(UrlUtils.buildRequestUrl('http://localhost:3000/api/users')).toBe('http://localhost:3000/api/users');
      // Relative URL or host without protocol
      expect(UrlUtils.buildRequestUrl('localhost:3000/api/users')).toBe('http://localhost:3000/api/users');
      expect(UrlUtils.buildRequestUrl('/api/users')).toBe('/api/users');
      expect(UrlUtils.buildRequestUrl('')).toBe('');
      // Explicit empty preUrl
      expect(UrlUtils.buildRequestUrl('https://httpbin.org/get', '')).toBe('https://httpbin.org/get');
      expect(UrlUtils.buildRequestUrl('http://localhost:3000/api', '   ')).toBe('http://localhost:3000/api');
    });

    it('when an environment is selected, request url is baseUrl concatenated with URL bar value', () => {
      // Normal relative path with leading slash
      expect(UrlUtils.buildRequestUrl('/users', 'https://api.example.com')).toBe('https://api.example.com/users');
      // Relative path without leading slash
      expect(UrlUtils.buildRequestUrl('users', 'https://api.example.com')).toBe('https://api.example.com/users');
      // baseUrl with trailing slash
      expect(UrlUtils.buildRequestUrl('/users', 'https://api.example.com/')).toBe('https://api.example.com/users');
      expect(UrlUtils.buildRequestUrl('users', 'https://api.example.com/')).toBe('https://api.example.com/users');
      // Query string only in URL bar
      expect(UrlUtils.buildRequestUrl('?foo=bar', 'https://api.example.com/v1')).toBe('https://api.example.com/v1?foo=bar');
      // Empty URL bar returns baseUrl
      expect(UrlUtils.buildRequestUrl('', 'https://api.example.com')).toBe('https://api.example.com');
      // BaseUrl missing protocol gets auto-prefixed with http://
      expect(UrlUtils.buildRequestUrl('/api', '127.0.0.1:8000')).toBe('http://127.0.0.1:8000/api');
      // When URL bar already starts with baseUrl, avoid double prefixing
      expect(UrlUtils.buildRequestUrl('https://api.example.com/users', 'https://api.example.com')).toBe(
        'https://api.example.com/users'
      );
      // When URL bar has an external absolute URL (e.g. from pasted cURL), keep it
      expect(UrlUtils.buildRequestUrl('https://httpbin.org/get', 'http://localhost:8080')).toBe(
        'https://httpbin.org/get'
      );
    });
  });

  describe('stripBaseUrl helper for cURL paste parsing', () => {
    it('should strip matching baseUrl from URL leaving relative path', () => {
      expect(UrlUtils.stripBaseUrl('https://api.example.com/users?page=1', 'https://api.example.com')).toBe(
        '/users?page=1'
      );
      expect(UrlUtils.stripBaseUrl('https://api.example.com/users', 'https://api.example.com/')).toBe('/users');
      expect(UrlUtils.stripBaseUrl('http://localhost:8080/v1/orders', 'http://localhost:8080/v1')).toBe('/orders');
    });

    it('should preserve URL when baseUrl does not match or is empty', () => {
      expect(UrlUtils.stripBaseUrl('https://httpbin.org/get', 'http://localhost:8080')).toBe(
        'https://httpbin.org/get'
      );
      expect(UrlUtils.stripBaseUrl('https://api.example.com/users', '')).toBe('https://api.example.com/users');
    });
  });

  describe('buildWsRequestUrl', () => {
    it('should concatenate WebSocket baseUrl with URL bar path', () => {
      expect(UrlUtils.buildWsRequestUrl('/ws/chat', 'http://localhost:8080')).toBe('ws://localhost:8080/ws/chat');
      expect(UrlUtils.buildWsRequestUrl('chat', 'https://api.example.com')).toBe('wss://api.example.com/chat');
      expect(UrlUtils.buildWsRequestUrl('ws://localhost:8080/ws/chat', 'http://localhost:8080')).toBe(
        'ws://localhost:8080/ws/chat'
      );
    });

    it('should handle WebSocket URL without environment', () => {
      expect(UrlUtils.buildWsRequestUrl('ws://localhost:8080/ws')).toBe('ws://localhost:8080/ws');
      expect(UrlUtils.buildWsRequestUrl('localhost:8080/ws')).toBe('ws://localhost:8080/ws');
    });
  });

  describe('applyPathParams', () => {
    it('should replace :param and {param} tokens with encoded values for HTTP, SSE, and WebSocket', () => {
      const httpUrl = '/api/v1/users/:userId/orders/{orderId}?status=paid';
      const pathParams: KeyValueItem[] = [
        { key: 'userId', value: '10086', is_checked: 1 },
        { key: '{orderId}', value: 'ord-999', is_checked: 1 },
      ];

      const res = UrlUtils.applyPathParams(httpUrl, pathParams);
      expect(res.url).toBe('/api/v1/users/10086/orders/ord-999?status=paid');
      expect(res.appliedParams).toEqual({
        userId: '10086',
        orderId: 'ord-999',
      });
    });

    it('should support WebSocket URLs with path parameters', () => {
      const wsUrl = 'wss://echo.websocket.events/chat/:channelId/stream';
      const pathParams: KeyValueItem[] = [
        { key: ':channelId', value: 'room/general', is_checked: 1 },
      ];

      const res = UrlUtils.applyPathParams(wsUrl, pathParams);
      expect(res.url).toBe('wss://echo.websocket.events/chat/room%2Fgeneral/stream');
      expect(res.appliedParams.channelId).toBe('room/general');
    });

    it('should interpolate variable placeholders before applying path parameters', () => {
      const url = '/sse/:topic/events';
      const pathParams: KeyValueItem[] = [
        { key: 'topic', value: '{{env_topic}}', is_checked: 1 },
      ];
      const vars: Record<string, string> = { env_topic: 'news-live' };
      const interp = (v: string) => v.replace(/\{\{([^{}]+)\}\}/g, (_, k) => vars[k.trim()] || '');

      const res = UrlUtils.applyPathParams(url, pathParams, interp);
      expect(res.url).toBe('/sse/news-live/events');
      expect(res.appliedParams.topic).toBe('news-live');
    });

    it('should skip disabled or unchecked path parameters', () => {
      const url = '/api/:id/:disabledId';
      const pathParams: KeyValueItem[] = [
        { key: 'id', value: 'active-1', is_checked: 1 },
        { key: 'disabledId', value: 'skip-me', is_checked: -1 },
      ];

      const res = UrlUtils.applyPathParams(url, pathParams);
      expect(res.url).toBe('/api/active-1/:disabledId');
      expect(res.appliedParams['id']).toBe('active-1');
      expect(res.appliedParams['disabledId']).toBeUndefined();
    });

    it('should return empty array when URL bar has no path parameters, clearing deleted params', () => {
      const existing: KeyValueItem[] = [
        { param_id: 'p1', key: 'userId', value: '123', description: 'User ID' },
      ];
      const params = UrlUtils.extractPathParams('/api/v1/users', existing);
      expect(params).toEqual([]);
    });

    it('should not treat environment placeholders like {{baseUrl}} as path parameters', () => {
      const url = '{{baseUrl}}/api/v1/orders/:orderId/items/{itemId}/{{env}}';
      const params = UrlUtils.extractPathParams(url, []);
      expect(params.map((p) => p.key)).toEqual(['orderId', 'itemId']);
      expect(params.some((p) => p.key.includes('baseUrl') || p.key.includes('env'))).toBe(false);
    });

    it('should handle repeated query parameter keys assigning unique param_ids and preserving types', () => {
      const url = 'https://api.example.com/filter?tag=news&tag=sports#details';
      const res = UrlUtils.syncUrlToParams(url);
      expect(res.cleanUrl).toBe('https://api.example.com/filter');
      expect(res.queryParams.length).toBe(2);
      expect(res.queryParams[0].key).toBe('tag');
      expect(res.queryParams[0].value).toBe('news');
      expect(res.queryParams[1].key).toBe('tag');
      expect(res.queryParams[1].value).toBe('sports');
      expect(res.queryParams[0].param_id).not.toBe(res.queryParams[1].param_id);
    });
  });
});


