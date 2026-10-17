import { ApiDetail, ApiTreeNode } from './types';

function formatStatus(status?: number): string {
  switch (status) {
    case 1:
      return '🟢 已发布';
    case 2:
      return '🟡 测试中';
    case 3:
      return '🔵 开发中';
    case 0:
      return '🔴 已废弃';
    default:
      return '🟢 正常';
  }
}

function formatAuth(auth?: ApiDetail['request']['auth']): string {
  if (!auth || auth.type === 'none') return '无需认证 (No Auth)';
  if (auth.type === 'bearer') {
    return `Bearer Token \`${auth.bearer?.token || '{{token}}'}\``;
  }
  if (auth.type === 'basic') {
    return `Basic Auth (\`${auth.basic?.username || 'user'}\`)`;
  }
  return String(auth.type);
}

export class DocGenerator {
  public static generateMarkdown(
    api: ApiDetail,
    baseHeadingLevel: number = 1,
    folderBreadcrumb?: string
  ): string {
    const lines: string[] = [];
    const name = api.name || '未命名接口';
    const method = (api.method || 'GET').toUpperCase();
    const url = api.url || '';
    const h1 = '#'.repeat(baseHeadingLevel);
    const h2 = '#'.repeat(baseHeadingLevel + 1);
    const h3 = '#'.repeat(baseHeadingLevel + 2);

    const isSse = api.target_type === 'sse';
    const isWs = api.target_type === 'websocket';
    const typeLabel = isSse ? 'SSE 流式接口' : isWs ? 'WebSocket 实时接口' : 'HTTP 接口';

    lines.push(`${h1} ${name}\n`);
    lines.push(`- **接口类型**：\`${typeLabel}\``);
    if (!isWs) {
      lines.push(`- **请求方法**：\`${method}\``);
    }
    lines.push(`- **${isWs ? '连接地址' : '接口路径'}**：\`${url}\``);
    if (api.status !== undefined) {
      lines.push(`- **接口状态**：${formatStatus(api.status)}`);
    }
    if (folderBreadcrumb) {
      lines.push(`- **所属目录**：\`📁 ${folderBreadcrumb}\``);
    }
    const desc = api.description || (api as any).mark || (api as any).summary;
    if (desc) {
      lines.push(`- **接口说明**：${desc}`);
    }
    if (api.request?.auth && api.request.auth.type !== 'none') {
      lines.push(`- **认证方式**：${formatAuth(api.request.auth)}`);
    }
    lines.push('');

    // 1. Path Parameters
    const pathSource = api.request?.path?.parameter || (api.request as any)?.restful?.parameter || [];
    const pathParams = (Array.isArray(pathSource) ? pathSource : []).filter((p: any) => p.key);
    if (pathParams.length > 0) {
      lines.push(`${h2} 路径参数 (Path Parameters)\n`);
      lines.push(`| 参数名 | 必填 | 类型 | 示例值 | 说明 |`);
      lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
      pathParams.forEach((p: any) => {
        const required = p.is_required === 1 || p.required ? '是' : '否';
        const type = p.data_type || p.type || 'string';
        lines.push(`| ${p.key} | ${required} | ${type} | ${p.value || '-'} | ${p.description || '-'} |`);
      });
      lines.push('');
    }

    // 2. Query Parameters
    const query = (api.request?.query?.parameter || []).filter(
      (q) => q.key && (q.is_checked === undefined || q.is_checked === 1 || (q as any).is_checked === true)
    );
    lines.push(`${h2} Query 参数\n`);
    if (query.length > 0) {
      lines.push(`| 参数名 | 必填 | 类型 | 示例值 | 说明 |`);
      lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
      query.forEach((q) => {
        const required = q.is_required === 1 || q.required ? '是' : '否';
        const type = q.data_type || q.type || 'string';
        lines.push(`| ${q.key} | ${required} | ${type} | ${q.value || '-'} | ${q.description || '-'} |`);
      });
      lines.push('');
    } else {
      lines.push(`无 Query 参数\n`);
    }

    // 3. Headers
    const headers = (api.request?.header?.parameter || []).filter(
      (h) => h.key && (h.is_checked === undefined || h.is_checked === 1 || (h as any).is_checked === true)
    );
    lines.push(`${h2} 请求头 (Headers)\n`);
    if (headers.length > 0) {
      lines.push(`| 头部字段 | 必填 | 示例值 | 说明 |`);
      lines.push(`| :--- | :--- | :--- | :--- |`);
      headers.forEach((h) => {
        const required = h.is_required === 1 || h.required ? '是' : '否';
        lines.push(`| ${h.key} | ${required} | ${h.value || '-'} | ${h.description || '-'} |`);
      });
      lines.push('');
    } else {
      lines.push(`无特殊请求头\n`);
    }

    // 4. Cookie Parameters
    const cookies = (api.request?.cookie?.parameter || []).filter(
      (c) => c.key && (c.is_checked === undefined || c.is_checked === 1 || (c as any).is_checked === true)
    );
    if (cookies.length > 0) {
      lines.push(`${h2} Cookie 参数\n`);
      lines.push(`| 参数名 | 必填 | 示例值 | 说明 |`);
      lines.push(`| :--- | :--- | :--- | :--- |`);
      cookies.forEach((c) => {
        const required = c.is_required === 1 || c.required ? '是' : '否';
        lines.push(`| ${c.key} | ${required} | ${c.value || '-'} | ${c.description || '-'} |`);
      });
      lines.push('');
    }

    // 5. Body
    lines.push(`${h2} 请求体 (Body)\n`);
    const bodyMode = api.request?.body?.mode || 'none';
    lines.push(`- **数据格式**：\`${bodyMode}\`\n`);
    if (bodyMode === 'json' && api.request?.body?.raw) {
      lines.push('```json');
      try {
        const parsed = JSON.parse(api.request.body.raw);
        lines.push(JSON.stringify(parsed, null, 2));
      } catch {
        lines.push(api.request.body.raw);
      }
      lines.push('```\n');
    } else if (bodyMode === 'form-data' || bodyMode === 'urlencoded') {
      const formItems = (bodyMode === 'form-data'
        ? api.request?.body?.parameter
        : api.request?.body?.urlencoded) || [];
      const validItems = formItems.filter((f) => f.key);
      if (validItems.length > 0) {
        lines.push(`| 参数名 | 类型 | 必填 | 示例值 | 说明 |`);
        lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
        validItems.forEach((f) => {
          const required = f.is_required === 1 || f.required ? '是' : '否';
          lines.push(`| ${f.key} | ${f.type || 'text'} | ${required} | ${f.value || '-'} | ${f.description || '-'} |`);
        });
        lines.push('');
      } else {
        lines.push(`未配置表单参数\n`);
      }
    } else if (bodyMode === 'raw' && api.request?.body?.raw) {
      lines.push('```text');
      lines.push(api.request.body.raw);
      lines.push('```\n');
    } else if (bodyMode === 'none') {
      lines.push(`无请求体 (None)\n`);
    }

    // 6. Responses
    lines.push(`${h2} 响应示例\n`);
    const examples = api.response?.example || [];
    if (examples.length > 0) {
      examples.forEach((ex) => {
        const code = ex.expect?.code || (ex as any).code || '200';
        lines.push(`${h3} ${ex.name || '默认响应'} (HTTP ${code})\n`);
        const exHeaders = (ex as any).header || [];
        if (Array.isArray(exHeaders) && exHeaders.length > 0) {
          lines.push(`**响应头**：`);
          exHeaders.forEach((h: any) => {
            if (h.key) lines.push(`- \`${h.key}\`: ${h.value || '-'}`);
          });
          lines.push('');
        }
        lines.push('```json');
        try {
          const parsed = JSON.parse(ex.raw);
          lines.push(JSON.stringify(parsed, null, 2));
        } catch {
          lines.push(ex.raw || '{}');
        }
        lines.push('```\n');
      });
    } else {
      lines.push(`暂无响应示例\n`);
    }

    return lines.join('\n');
  }

  public static generateHtml(title: string, markdown: string): string {
    // Simple robust markdown to html conversion
    let bodyHtml = markdown
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-100 mt-6 mb-3 border-b border-gray-700 pb-1.5">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-200 mt-5 mb-2 pb-1">$1</h3>')
      .replace(/^#### (.*$)/gim, '<h4 class="text-md font-medium text-orange-400 mt-4 mb-2">$1</h4>')
      .replace(/^- \*\*(.*?)\*\*：(.*$)/gim, '<div class="py-1"><span class="font-medium text-gray-400">$1:</span> <span class="text-gray-200">$2</span></div>')
      .replace(/`([^`]+)`/g, '<code class="bg-[#1f232d] text-orange-300 px-1.5 py-0.5 rounded text-sm">$1</code>');

    // Convert code blocks
    bodyHtml = bodyHtml.replace(/```(?:json|text)?\n([\s\S]*?)```/g, (_m, code) => {
      return `<pre class="bg-[#121316] border border-[#2b2f3a] text-gray-300 p-4 rounded-lg overflow-x-auto text-xs my-3 font-mono leading-relaxed"><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    // Convert tables
    const tableRegex = /\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.+\|\n?)+)/g;
    bodyHtml = bodyHtml.replace(tableRegex, (_m, headerLine, bodyLines) => {
      const headers = headerLine.split('|').map((h: string) => h.trim()).filter(Boolean);
      const rows = bodyLines
        .trim()
        .split('\n')
        .map((line: string) => line.split('|').map((c: string) => c.trim()).filter(Boolean));

      let t = '<div class="overflow-x-auto my-3"><table class="w-full text-xs text-left border border-[#2b2f3a] rounded-lg overflow-hidden">';
      t += '<thead class="bg-[#1a1d24] text-gray-400 border-b border-[#2b2f3a]"><tr>';
      headers.forEach((h: string) => (t += `<th class="px-4 py-2 font-medium">${h}</th>`));
      t += '</tr></thead><tbody class="divide-y divide-[#252832] bg-[#16181e]">';
      rows.forEach((r: string[]) => {
        t += '<tr class="hover:bg-[#1c1f28] transition">';
        r.forEach((cell: string) => (t += `<td class="px-4 py-2 text-gray-300">${cell}</td>`));
        t += '</tr>';
      });
      t += '</tbody></table></div>';
      return t;
    });

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f1013; color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  </style>
</head>
<body class="p-8 max-w-4xl mx-auto">
  <div class="bg-[#16181e] border border-[#262934] p-8 rounded-xl shadow-2xl">
    ${bodyHtml}
  </div>
</body>
</html>`;
  }

  public static exportOpenApi(
    projectName: string,
    tree: ApiTreeNode[],
    getDetail: (id: string) => ApiDetail | null
  ): any {
    const paths: Record<string, any> = {};

    for (const node of tree) {
      if (node.target_type === 'api') {
        const detail = getDetail(node.target_id);
        if (!detail) continue;

        let rawPath = detail.url || '/';
        try {
          if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
            rawPath = new URL(rawPath).pathname;
          }
        } catch {}
        if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;

        const method = (detail.method || 'GET').toLowerCase();
        if (!paths[rawPath]) {
          paths[rawPath] = {};
        }

        const parameters: any[] = [];
        (detail.request?.query?.parameter || []).forEach((q) => {
          if (q.is_checked === 1 && q.key) {
            parameters.push({
              name: q.key,
              in: 'query',
              description: q.description || '',
              required: Boolean(q.is_required),
              schema: { type: q.data_type || 'string', example: q.value },
            });
          }
        });

        (detail.request?.header?.parameter || []).forEach((h) => {
          if (h.is_checked === 1 && h.key) {
            parameters.push({
              name: h.key,
              in: 'header',
              description: h.description || '',
              required: Boolean(h.is_required),
              schema: { type: 'string', example: h.value },
            });
          }
        });

        const responses: any = {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: detail.response?.example?.[0]?.raw ? safeJsonParse(detail.response.example[0].raw) : {},
              },
            },
          },
        };

        const operation: any = {
          summary: detail.name || node.name,
          parameters,
          responses,
        };

        if (detail.request?.body?.mode === 'json' && detail.request?.body?.raw) {
          operation.requestBody = {
            required: true,
            content: {
              'application/json': {
                example: safeJsonParse(detail.request.body.raw),
              },
            },
          };
        }

        paths[rawPath][method] = operation;
      }
    }

    return {
      openapi: '3.0.0',
      info: {
        title: projectName,
        version: '1.0.0',
        description: '由 mypost 导出的 OpenAPI 3.0 规范',
      },
      paths,
    };
  }

  public static generateCollectionMarkdown(
    title: string,
    tree: ApiTreeNode[],
    getDetail: (id: string) => ApiDetail | null,
    rootFolderId: string = '0',
    projectName?: string
  ): string {
    const lines: string[] = [];
    const apis = tree.filter((t) => t.target_type === 'api');
    const folders = tree.filter((t) => t.target_type === 'folder');

    lines.push(`# ${title}\n`);
    lines.push(`> 导出自 **mypost** API 协同与管理工具\n`);
    if (projectName) {
      lines.push(`- **所属项目**：\`${projectName}\``);
    }
    const scopeLabel = rootFolderId === '0' ? '📁 根目录 (全部接口)' : `📁 ${title}`;
    lines.push(`- **分享范围**：\`${scopeLabel}\``);
    lines.push(`- **接口总数**：\`${apis.length}\` 个`);
    lines.push(`- **分类目录**：\`${folders.length}\` 个`);
    lines.push(`- **导出时间**：\`${new Date().toLocaleString()}\`\n`);

    // 1. Table of Contents (Hierarchical Tree)
    lines.push(`## 目录大纲\n`);

    const visitedToc = new Set<string>();

    const renderToc = (parentId: string, depth: number) => {
      const items = tree.filter((t) => (t.parent_id || '0') === parentId);
      for (const item of items) {
        if (visitedToc.has(item.target_id)) continue;
        visitedToc.add(item.target_id);
        const indent = '  '.repeat(depth);
        if (item.target_type === 'folder') {
          lines.push(`${indent}- 📁 **${item.name}**`);
          renderToc(item.target_id, depth + 1);
        } else {
          lines.push(
            `${indent}- \`${item.method || 'API'}\` [${item.name}](#${encodeURIComponent(item.name)}) \`${item.url || ''}\``
          );
        }
      }
    };

    if (rootFolderId === '0') {
      const rootItems = tree.filter((t) => !t.parent_id || t.parent_id === '0');
      for (const item of rootItems) {
        if (visitedToc.has(item.target_id)) continue;
        visitedToc.add(item.target_id);
        if (item.target_type === 'folder') {
          lines.push(`- 📁 **${item.name}**`);
          renderToc(item.target_id, 1);
        } else {
          lines.push(
            `- \`${item.method || 'API'}\` [${item.name}](#${encodeURIComponent(item.name)}) \`${item.url || ''}\``
          );
        }
      }
    } else {
      const targetFolder = tree.find((t) => t.target_id === rootFolderId);
      if (targetFolder) {
        lines.push(`- 📁 **${targetFolder.name}**`);
        renderToc(targetFolder.target_id, 1);
      } else {
        renderToc(rootFolderId, 0);
      }
    }

    // Any remaining items not yet in TOC
    for (const item of tree) {
      if (!visitedToc.has(item.target_id)) {
        visitedToc.add(item.target_id);
        if (item.target_type === 'folder') {
          lines.push(`- 📁 **${item.name}**`);
          renderToc(item.target_id, 1);
        } else {
          lines.push(
            `- \`${item.method || 'API'}\` [${item.name}](#${encodeURIComponent(item.name)}) \`${item.url || ''}\``
          );
        }
      }
    }

    lines.push('\n---\n');

    // 2. Detailed Interfaces Preserving Directory Hierarchy
    lines.push(`## 接口详细说明\n`);
    const detailVisited = new Set<string>();

    const getFolderBreadcrumb = (nodeId: string): string => {
      const parts: string[] = [];
      const visited = new Set<string>();
      let curr = tree.find((t) => t.target_id === nodeId);
      while (curr && !visited.has(curr.target_id)) {
        visited.add(curr.target_id);
        parts.unshift(curr.name);
        if (!curr.parent_id || curr.parent_id === '0' || curr.target_id === rootFolderId) break;
        curr = tree.find((t) => t.target_id === curr!.parent_id);
      }
      return parts.join(' / ');
    };

    // Recursive detail renderer
    const renderFolderSection = (folderNode: ApiTreeNode, headingLevel: number) => {
      const hLevel = Math.min(headingLevel, 5);
      const hStr = '#'.repeat(hLevel);
      lines.push(`\n${hStr} 📁 ${folderNode.name}\n`);

      // Direct APIs in this folder
      const directApis = tree.filter(
        (t) => t.parent_id === folderNode.target_id && t.target_type === 'api'
      );
      for (const api of directApis) {
        detailVisited.add(api.target_id);
        const detail = getDetail(api.target_id);
        if (detail) {
          const breadcrumb = getFolderBreadcrumb(folderNode.target_id);
          lines.push(this.generateMarkdown(detail, 3, breadcrumb));
          lines.push('\n---\n');
        }
      }

      // Direct Subfolders in this folder
      const subFolders = tree.filter(
        (t) => t.parent_id === folderNode.target_id && t.target_type === 'folder'
      );
      for (const sub of subFolders) {
        renderFolderSection(sub, hLevel + 1);
      }
    };

    if (rootFolderId === '0') {
      // Direct root APIs (no parent or parent is '0')
      const directRootApis = tree.filter(
        (t) => (!t.parent_id || t.parent_id === '0') && t.target_type === 'api'
      );
      if (directRootApis.length > 0) {
        lines.push(`\n## 📁 根目录直接接口\n`);
        for (const api of directRootApis) {
          detailVisited.add(api.target_id);
          const detail = getDetail(api.target_id);
          if (detail) {
            lines.push(this.generateMarkdown(detail, 3, '根目录'));
            lines.push('\n---\n');
          }
        }
      }

      // Top-level folders under root
      const topFolders = tree.filter(
        (t) => (!t.parent_id || t.parent_id === '0') && t.target_type === 'folder'
      );
      for (const folder of topFolders) {
        renderFolderSection(folder, 2);
      }
    } else {
      const targetFolder = tree.find((t) => t.target_id === rootFolderId);
      if (targetFolder) {
        renderFolderSection(targetFolder, 2);
      } else {
        const topFolders = tree.filter((t) => t.target_type === 'folder');
        for (const folder of topFolders) {
          renderFolderSection(folder, 2);
        }
      }
    }

    // Remaining APIs
    for (const api of apis) {
      if (!detailVisited.has(api.target_id)) {
        const detail = getDetail(api.target_id);
        if (detail) {
          lines.push(this.generateMarkdown(detail, 3));
          lines.push('\n---\n');
        }
      }
    }

    return lines.join('\n');
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
