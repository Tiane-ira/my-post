import { describe, it, expect } from 'vitest';
import {
  getHeaderKeySuggestions,
  getHeaderValueSuggestions,
  COMMON_HTTP_HEADERS,
} from '../src/common/headerConstants';
import { ParamUtils } from '../src/common/paramUtils';
import { ApiDetail, ApiTreeNode } from '../src/common/types';

describe('Header Candidates and ParamUtils Optimization', () => {
  describe('Header Candidates Auto-Completion', () => {
    it('provides common HTTP header key suggestions', () => {
      const suggestions = getHeaderKeySuggestions();
      expect(suggestions.length).toBeGreaterThan(15);
      const ct = suggestions.find((s) => s.value === 'Content-Type');
      expect(ct).toBeDefined();
      expect(ct?.badge).toBe('Header');
      expect(ct?.description).toContain('请求体');

      const auth = suggestions.find((s) => s.value === 'Authorization');
      expect(auth).toBeDefined();
      expect(auth?.description).toContain('认证');
    });

    it('provides contextual header value suggestions for Content-Type', () => {
      const vals = getHeaderValueSuggestions('Content-Type');
      expect(vals.length).toBeGreaterThan(0);
      const jsonMime = vals.find((v) => v.value === 'application/json');
      expect(jsonMime).toBeDefined();
      const formMime = vals.find((v) => v.value === 'application/x-www-form-urlencoded');
      expect(formMime).toBeDefined();
    });

    it('matches header value suggestions case-insensitively', () => {
      const lowerVals = getHeaderValueSuggestions('content-type');
      expect(lowerVals.length).toBeGreaterThan(0);
      expect(lowerVals.some((v) => v.value === 'application/json')).toBe(true);

      const authVals = getHeaderValueSuggestions('authorization');
      expect(authVals.some((v) => v.value.includes('Bearer'))).toBe(true);
    });

    it('returns empty list for unrecognized header key', () => {
      const vals = getHeaderValueSuggestions('X-Custom-Unknown-12345');
      expect(vals).toEqual([]);
    });
  });

  describe('ParamUtils Ancestor Folder Parameter Merging', () => {
    const treeItems: ApiTreeNode[] = [
      {
        target_id: 'folder-root-child',
        parent_id: '0',
        target_type: 'folder',
        name: '一级目录',
        method: '',
        url: '',
        sort: 100,
        status: 1,
      },
      {
        target_id: 'folder-sub',
        parent_id: 'folder-root-child',
        target_type: 'folder',
        name: '二级子目录',
        method: '',
        url: '',
        sort: 200,
        status: 1,
      },
    ];

    const folderDetailsCache: Record<string, ApiDetail> = {
      '0': {
        target_id: '0',
        parent_id: '',
        project_id: 'p1',
        target_type: 'folder',
        name: '根目录',
        method: '' as any,
        url: '',
        sort: 0,
        status: 1,
        request: {
          header: {
            parameter: [
              {
                param_id: 'h0-1',
                key: 'X-Global-App',
                value: 'mypost-root',
                is_checked: 1,
              },
              {
                param_id: 'h0-2',
                key: 'Authorization',
                value: 'Bearer root-token',
                is_checked: 1,
              },
            ],
          },
          query: {
            parameter: [
              {
                param_id: 'q0-1',
                key: 'app_version',
                value: '1.0.0',
                is_checked: 1,
              },
            ],
          },
        },
      },
      'folder-root-child': {
        target_id: 'folder-root-child',
        parent_id: '0',
        project_id: 'p1',
        target_type: 'folder',
        name: '一级目录',
        method: '' as any,
        url: '',
        sort: 100,
        status: 1,
        request: {
          header: {
            parameter: [
              {
                param_id: 'hf1-1',
                key: 'X-Module',
                value: 'user-service',
                is_checked: 1,
              },
            ],
          },
          query: {
            parameter: [
              {
                param_id: 'qf1-1',
                key: 'region',
                value: 'cn-north',
                is_checked: 1,
              },
            ],
          },
        },
      },
      'folder-sub': {
        target_id: 'folder-sub',
        parent_id: 'folder-root-child',
        project_id: 'p1',
        target_type: 'folder',
        name: '二级子目录',
        method: '' as any,
        url: '',
        sort: 200,
        status: 1,
        request: {
          header: {
            parameter: [
              {
                param_id: 'hf2-1',
                key: 'X-Sub-Module',
                value: 'profile',
                is_checked: 1,
              },
            ],
          },
        },
      },
    };

    it('merges ancestor parameters from root to immediate parent', () => {
      const api: ApiDetail = {
        target_id: 'api-test-1',
        parent_id: 'folder-sub',
        project_id: 'p1',
        target_type: 'api',
        name: 'Get Profile',
        method: 'GET',
        url: '/profile',
        sort: 10,
        status: 1,
        request: {
          header: {
            parameter: [
              {
                param_id: 'api-h1',
                key: 'X-Custom-Client',
                value: 'mobile',
                is_checked: 1,
              },
            ],
          },
          query: {
            parameter: [],
          },
        },
      };

      const merged = ParamUtils.mergeApiWithFolderParams(api, treeItems, folderDetailsCache);

      // Verify inherited headers
      const headers = merged.request.header?.parameter || [];
      expect(headers.some((h) => h.key === 'X-Global-App' && h.value === 'mypost-root')).toBe(true);
      expect(headers.some((h) => h.key === 'X-Module' && h.value === 'user-service')).toBe(true);
      expect(headers.some((h) => h.key === 'X-Sub-Module' && h.value === 'profile')).toBe(true);
      expect(headers.some((h) => h.key === 'X-Custom-Client' && h.value === 'mobile')).toBe(true);

      // Verify inherited queries
      const queries = merged.request.query?.parameter || [];
      expect(queries.some((q) => q.key === 'app_version' && q.value === '1.0.0')).toBe(true);
      expect(queries.some((q) => q.key === 'region' && q.value === 'cn-north')).toBe(true);
    });

    it('overrides ancestor folder headers case-insensitively when API defines explicit header', () => {
      const api: ApiDetail = {
        target_id: 'api-test-2',
        parent_id: 'folder-sub',
        project_id: 'p1',
        target_type: 'api',
        name: 'Get User With Custom Auth',
        method: 'GET',
        url: '/user',
        sort: 20,
        status: 1,
        request: {
          header: {
            parameter: [
              // Notice lowercase 'authorization' overriding uppercase 'Authorization' from root
              {
                param_id: 'api-h-override',
                key: 'authorization',
                value: 'Bearer api-custom-token',
                is_checked: 1,
              },
            ],
          },
        },
      };

      const merged = ParamUtils.mergeApiWithFolderParams(api, treeItems, folderDetailsCache);
      const headers = (merged.request.header?.parameter || []).filter(
        (h) => h.key.toLowerCase() === 'authorization'
      );

      // Should only have 1 effective Authorization header, which is the api's explicit one
      expect(headers.length).toBe(1);
      expect(headers[0].value).toBe('Bearer api-custom-token');
      expect(headers[0].key).toBe('authorization');
    });

    it('overrides ancestor folder query params when API defines matching query key', () => {
      const api: ApiDetail = {
        target_id: 'api-test-3',
        parent_id: 'folder-sub',
        project_id: 'p1',
        target_type: 'api',
        name: 'Get User Region Override',
        method: 'GET',
        url: '/user',
        sort: 30,
        status: 1,
        request: {
          query: {
            parameter: [
              {
                param_id: 'api-q-override',
                key: 'region',
                value: 'us-west',
                is_checked: 1,
              },
            ],
          },
        },
      };

      const merged = ParamUtils.mergeApiWithFolderParams(api, treeItems, folderDetailsCache);
      const queries = (merged.request.query?.parameter || []).filter((q) => q.key === 'region');

      expect(queries.length).toBe(1);
      expect(queries[0].value).toBe('us-west');
    });

    it('reactively updates inherited parameters when an API is moved to a new folder', () => {
      const dynamicFolderDetails: Record<string, ApiDetail> = {
        ...folderDetailsCache,
        'folder-finance': {
          target_id: 'folder-finance',
          parent_id: '0',
          project_id: 'p1',
          target_type: 'folder',
          name: '财务模块',
          method: '' as any,
          url: '',
          sort: 300,
          status: 1,
          request: {
            header: {
              parameter: [
                {
                  param_id: 'hf-fin-1',
                  key: 'X-Finance-Auth',
                  value: 'fin-sec-token',
                  is_checked: 1,
                },
              ],
            },
            query: {
              parameter: [
                {
                  param_id: 'qf-fin-1',
                  key: 'currency',
                  value: 'CNY',
                  is_checked: 1,
                },
              ],
            },
          },
        },
      };

      const dynamicTree: ApiTreeNode[] = [
        ...treeItems,
        {
          target_id: 'folder-finance',
          parent_id: '0',
          target_type: 'folder',
          name: '财务模块',
          method: '',
          url: '',
          sort: 300,
          status: 1,
        },
        {
          target_id: 'api-moving-1',
          parent_id: 'folder-sub',
          target_type: 'api',
          name: 'Order Statement',
          method: 'GET',
          url: '/statement',
          sort: 50,
          status: 1,
        },
      ];

      const api: ApiDetail = {
        target_id: 'api-moving-1',
        parent_id: 'folder-sub',
        project_id: 'p1',
        target_type: 'api',
        name: 'Order Statement',
        method: 'GET',
        url: '/statement',
        sort: 50,
        status: 1,
        request: { header: { parameter: [] }, query: { parameter: [] } },
      };

      // 1. In folder-sub: inherits X-Sub-Module, X-Module, X-Global-App
      const initialParams = ParamUtils.computeImplicitParams(api, dynamicTree, dynamicFolderDetails);
      expect(initialParams.headers.some((h) => h.key === 'X-Sub-Module')).toBe(true);
      expect(initialParams.headers.some((h) => h.key === 'X-Module')).toBe(true);
      expect(initialParams.headers.some((h) => h.key === 'X-Finance-Auth')).toBe(false);

      // 2. Move API to folder-finance in tree: even if api.parent_id is not updated yet, treeItems takes precedence!
      const movedTree: ApiTreeNode[] = dynamicTree.map((t) =>
        t.target_id === 'api-moving-1' ? { ...t, parent_id: 'folder-finance' } : t
      );
      const afterMoveParams = ParamUtils.computeImplicitParams(api, movedTree, dynamicFolderDetails);
      expect(afterMoveParams.headers.some((h) => h.key === 'X-Sub-Module')).toBe(false);
      expect(afterMoveParams.headers.some((h) => h.key === 'X-Module')).toBe(false);
      expect(afterMoveParams.headers.some((h) => h.key === 'X-Finance-Auth')).toBe(true);
      expect(afterMoveParams.query.some((q) => q.key === 'currency')).toBe(true);
      expect(afterMoveParams.headers.some((h) => h.key === 'X-Global-App')).toBe(true);

      // 3. Move API to root directory ('0')
      const rootTree: ApiTreeNode[] = dynamicTree.map((t) =>
        t.target_id === 'api-moving-1' ? { ...t, parent_id: '0' } : t
      );
      const afterRootMoveParams = ParamUtils.computeImplicitParams(
        { ...api, parent_id: '0' },
        rootTree,
        dynamicFolderDetails
      );
      expect(afterRootMoveParams.headers.some((h) => h.key === 'X-Sub-Module')).toBe(false);
      expect(afterRootMoveParams.headers.some((h) => h.key === 'X-Finance-Auth')).toBe(false);
      // Still inherits root parameters
      expect(afterRootMoveParams.headers.some((h) => h.key === 'X-Global-App')).toBe(true);
      expect(afterRootMoveParams.query.some((q) => q.key === 'app_version')).toBe(true);
    });

    it('correctly inherits folder parameters with placeholder variables for WebSocket interfaces', () => {
      const wsTree: ApiTreeNode[] = [
        {
          target_id: 'folder-ws-group',
          parent_id: '0',
          target_type: 'folder',
          name: '实时通信组',
          method: '',
          url: '',
          sort: 10,
          status: 1,
        },
        {
          target_id: 'ws-chat-api',
          parent_id: 'folder-ws-group',
          target_type: 'websocket',
          name: '聊天长连接',
          method: 'GET',
          url: '/ws/chat',
          sort: 1,
          status: 1,
        },
      ];

      const wsFolderCache: Record<string, ApiDetail> = {
        '0': {
          target_id: '0',
          parent_id: '',
          project_id: 'p1',
          target_type: 'folder',
          name: '根目录',
          method: '' as any,
          url: '',
          sort: 0,
          status: 1,
          request: {
            header: {
              parameter: [
                {
                  param_id: 'h0-app',
                  key: 'X-App-Env',
                  value: '{{current_env}}',
                  is_checked: 1,
                },
              ],
            },
            query: {
              parameter: [
                {
                  param_id: 'q0-ver',
                  key: 'v',
                  value: '{{apiVersion}}',
                  is_checked: 1,
                },
              ],
            },
          },
        },
        'folder-ws-group': {
          target_id: 'folder-ws-group',
          parent_id: '0',
          project_id: 'p1',
          target_type: 'folder',
          name: '实时通信组',
          method: '' as any,
          url: '',
          sort: 10,
          status: 1,
          request: {
            header: {
              parameter: [
                {
                  param_id: 'h-ws-auth',
                  key: 'Authorization',
                  value: 'Bearer {{wsToken}}',
                  is_checked: true as any, // boolean checked support
                },
              ],
            },
            query: {
              parameter: [
                {
                  param_id: 'q-ws-token',
                  key: 'token',
                  value: '{{wsToken}}',
                  is_checked: 1,
                },
                {
                  param_id: 'q-ws-room',
                  key: 'room',
                  value: '{{roomId}}',
                  is_checked: undefined as any, // default checked support
                },
              ],
            },
          },
        },
      };

      const wsApi: ApiDetail = {
        target_id: 'ws-chat-api',
        parent_id: 'folder-ws-group',
        project_id: 'p1',
        target_type: 'websocket',
        name: '聊天长连接',
        method: 'GET',
        url: '/ws/chat',
        sort: 1,
        status: 1,
        request: {
          header: { parameter: [] },
          query: {
            parameter: [
              {
                param_id: 'q-explicit',
                key: 'client',
                value: 'desktop',
                is_checked: 1,
              },
            ],
          },
        },
      };

      // 1. Compute implicit parameters with { isWs: true }
      const implicit = ParamUtils.computeImplicitParams(wsApi, wsTree, wsFolderCache, { isWs: true });

      // Verify inherited query parameters with placeholder variables
      expect(implicit.query.some((q) => q.key === 'token' && q.value === '{{wsToken}}')).toBe(true);
      expect(implicit.query.some((q) => q.key === 'room' && q.value === '{{roomId}}')).toBe(true);
      expect(implicit.query.some((q) => q.key === 'v' && q.value === '{{apiVersion}}')).toBe(true);

      // Verify inherited headers with placeholder variables
      expect(implicit.headers.some((h) => h.key === 'Authorization' && h.value === 'Bearer {{wsToken}}')).toBe(true);
      expect(implicit.headers.some((h) => h.key === 'X-App-Env' && h.value === '{{current_env}}')).toBe(true);

      // 2. Merge API with folder parameters for WebSocket
      const mergedWs = ParamUtils.mergeApiWithFolderParams(wsApi, wsTree, wsFolderCache);
      expect(mergedWs.request?.query?.parameter?.some((q) => q.key === 'token' && q.value === '{{wsToken}}')).toBe(true);
      expect(mergedWs.request?.query?.parameter?.some((q) => q.key === 'client' && q.value === 'desktop')).toBe(true);
      expect(mergedWs.request?.header?.parameter?.some((h) => h.key === 'Authorization' && h.value === 'Bearer {{wsToken}}')).toBe(true);

      // 3. Verify variable resolution against variables map
      const sampleVars: Record<string, string> = {
        wsToken: 'tok_live_998877',
        roomId: 'room_vip_001',
        apiVersion: '2.5',
      };

      const interpolate = (val: string) =>
        val.replace(/\{\{([^{}]+)\}\}/g, (_, key) => sampleVars[key.trim()] || `{{${key}}}`);

      const resolvedQueryPairs = (mergedWs.request?.query?.parameter || []).map((q) => ({
        key: interpolate(q.key),
        value: interpolate(q.value),
      }));

      expect(resolvedQueryPairs.find((q) => q.key === 'token')?.value).toBe('tok_live_998877');
      expect(resolvedQueryPairs.find((q) => q.key === 'room')?.value).toBe('room_vip_001');
      expect(resolvedQueryPairs.find((q) => q.key === 'v')?.value).toBe('2.5');
      expect(resolvedQueryPairs.find((q) => q.key === 'client')?.value).toBe('desktop');
    });
  });
});

