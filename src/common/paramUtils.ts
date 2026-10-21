import { ApiDetail, ApiTreeNode, KeyValueItem } from './types';

export interface InheritedParamItem {
  key: string;
  value: string;
  source: 'folder' | 'auth' | 'system';
  sourceName: string;
  description?: string;
  is_checked: number;
  overridden?: boolean;
}

export class ParamUtils {
  /**
   * Retrieves all ancestor folder nodes for a given item from bottom to top (including root '0')
   */
  public static getAncestorFolders(treeItems: ApiTreeNode[], startParentId?: string): ApiTreeNode[] {
    const ancestors: ApiTreeNode[] = [];
    const visited = new Set<string>();
    let curId = startParentId;

    while (curId && curId !== '0' && !visited.has(curId)) {
      visited.add(curId);
      const node = (treeItems || []).find((t) => t.target_id === curId);
      if (!node) break;
      ancestors.push(node);
      curId = node.parent_id;
    }

    return ancestors;
  }

  /**
   * Computes all implicit and inherited headers & query parameters for any interface type (HTTP, SSE, WebSocket)
   */
  public static computeImplicitParams(
    api: ApiDetail,
    treeItems: ApiTreeNode[] = [],
    folderDetailsCache: Record<string, any> = {},
    options: { isSse?: boolean; isWs?: boolean } = {}
  ): { headers: InheritedParamItem[]; query: InheritedParamItem[] } {
    const headers: InheritedParamItem[] = [];
    const query: InheritedParamItem[] = [];

    // 1. Ancestor Folder Parameters (Root -> Immediate Parent)
    const ancestorNodes = this.getAncestorFolders(treeItems, api.parent_id).reverse();

    // Check root folder ('0') first
    const rootDetail = folderDetailsCache['0'];
    if (rootDetail?.request?.header?.parameter) {
      for (const item of rootDetail.request.header.parameter) {
        if (item.key && item.is_checked === 1) {
          headers.push({
            key: item.key,
            value: item.value || '',
            source: 'folder',
            sourceName: '根目录公共请求头',
            description: item.description || '继承自根目录全局配置',
            is_checked: 1,
          });
        }
      }
    }
    if (rootDetail?.request?.query?.parameter) {
      for (const item of rootDetail.request.query.parameter) {
        if (item.key && item.is_checked === 1) {
          query.push({
            key: item.key,
            value: item.value || '',
            source: 'folder',
            sourceName: '根目录公共 Query 参数',
            description: item.description || '继承自根目录全局配置',
            is_checked: 1,
          });
        }
      }
    }

    // Then folders from top to bottom
    for (const folderNode of ancestorNodes) {
      const folderDetail = folderDetailsCache[folderNode.target_id];
      if (folderDetail?.request?.header?.parameter) {
        for (const item of folderDetail.request.header.parameter) {
          if (item.key && item.is_checked === 1) {
            headers.push({
              key: item.key,
              value: item.value || '',
              source: 'folder',
              sourceName: `目录: ${folderNode.name}`,
              description: item.description || `继承自上级目录 [${folderNode.name}]`,
              is_checked: 1,
            });
          }
        }
      }
      if (folderDetail?.request?.query?.parameter) {
        for (const item of folderDetail.request.query.parameter) {
          if (item.key && item.is_checked === 1) {
            query.push({
              key: item.key,
              value: item.value || '',
              source: 'folder',
              sourceName: `目录: ${folderNode.name}`,
              description: item.description || `继承自上级目录 [${folderNode.name}]`,
              is_checked: 1,
            });
          }
        }
      }
    }

    // 2. Auth Authorization Parameters
    const auth = api.request?.auth;
    if (auth && auth.type !== 'none') {
      if (auth.type === 'bearer' && auth.bearer?.token) {
        headers.push({
          key: 'Authorization',
          value: `Bearer ${auth.bearer.token}`,
          source: 'auth',
          sourceName: 'Auth (Bearer Token)',
          description: '由接口 Auth 配置自动生成鉴权头',
          is_checked: 1,
        });
      } else if (auth.type === 'basic' && auth.basic?.username) {
        headers.push({
          key: 'Authorization',
          value: `Basic (Base64 [${auth.basic.username}:***])`,
          source: 'auth',
          sourceName: 'Auth (Basic Auth)',
          description: '由接口 Auth 用户名密码自动 Base64 编码注入',
          is_checked: 1,
        });
      } else if (auth.type === 'apikey' && auth.apikey?.key) {
        if (auth.apikey.in === 'header') {
          headers.push({
            key: auth.apikey.key,
            value: auth.apikey.value || '',
            source: 'auth',
            sourceName: 'Auth (API Key Header)',
            description: '由接口 Auth ApiKey 自动注入请求头',
            is_checked: 1,
          });
        } else {
          query.push({
            key: auth.apikey.key,
            value: auth.apikey.value || '',
            source: 'auth',
            sourceName: 'Auth (API Key Query)',
            description: '由接口 Auth ApiKey 自动追加 URL 参数',
            is_checked: 1,
          });
        }
      }
    }

    // 3. System Protocol Headers
    if (options.isSse) {
      headers.push({
        key: 'Accept',
        value: 'text/event-stream',
        source: 'system',
        sourceName: 'SSE 协议标准',
        description: '流式事件流必须的协商请求头',
        is_checked: 1,
      });
      headers.push({
        key: 'Cache-Control',
        value: 'no-cache',
        source: 'system',
        sourceName: '系统防缓存',
        description: '确保实时接收数据流',
        is_checked: 1,
      });
    } else if (!options.isWs) {
      // Standard HTTP
      headers.push({
        key: 'User-Agent',
        value: 'mypost/1.0 (Desktop; Offline)',
        source: 'system',
        sourceName: '客户端身份标识',
        description: '系统预设客户端 User-Agent',
        is_checked: 1,
      });

      const bodyMode = api.request?.body?.mode;
      if (bodyMode === 'json' || (bodyMode === 'raw' && (!api.request?.body?.raw_type || api.request.body.raw_type === 'json'))) {
        headers.push({
          key: 'Content-Type',
          value: 'application/json',
          source: 'system',
          sourceName: '请求体类型推导',
          description: '根据 Body Mode (JSON) 自动注入的内容格式头',
          is_checked: 1,
        });
      } else if (bodyMode === 'urlencoded') {
        headers.push({
          key: 'Content-Type',
          value: 'application/x-www-form-urlencoded',
          source: 'system',
          sourceName: '表单类型推导',
          description: '根据 Body Mode (URL-Encoded) 自动注入的内容格式头',
          is_checked: 1,
        });
      }
    }

    // 4. Mark items overridden if defined in api's own explicit items
    const explicitHeaderKeys = new Set(
      (api.request?.header?.parameter || [])
        .filter((h) => h.is_checked === 1 && h.key)
        .map((h) => h.key.trim().toLowerCase())
    );
    headers.forEach((h) => {
      if (explicitHeaderKeys.has(h.key.trim().toLowerCase())) {
        h.overridden = true;
      }
    });

    const explicitQueryKeys = new Set(
      (api.request?.query?.parameter || [])
        .filter((q) => q.is_checked === 1 && q.key)
        .map((q) => q.key.trim().toLowerCase())
    );
    query.forEach((q) => {
      if (explicitQueryKeys.has(q.key.trim().toLowerCase())) {
        q.overridden = true;
      }
    });

    return { headers, query };
  }
}
