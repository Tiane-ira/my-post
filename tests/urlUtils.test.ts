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
});

