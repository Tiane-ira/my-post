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
});
