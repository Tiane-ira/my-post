import { describe, it, expect } from 'vitest';
import { DocGenerator } from '../src/common/docGenerator';
import { ApiDetail, ApiTreeNode } from '../src/common/types';

describe('DocGenerator Engine', () => {
  const sampleApi: ApiDetail = {
    target_id: 'api-order-detail',
    parent_id: '0',
    project_id: 'proj-shop',
    target_type: 'api',
    name: '查询订单详情',
    method: 'GET',
    url: '/api/v1/orders/{orderId}',
    sort: 1000,
    status: 1,
    request: {
      query: {
        parameter: [
          { param_id: 'q1', key: 'fields', value: 'items,payment', description: '返回字段过滤', is_checked: 1 },
        ],
      },
      header: {
        parameter: [
          { param_id: 'h1', key: 'Authorization', value: 'Bearer {{token}}', description: '鉴权凭据', is_checked: 1 },
        ],
      },
      body: {
        mode: 'none',
      },
      auth: { type: 'none' },
    },
    response: {
      example: [
        {
          example_id: 'ex-1',
          name: '成功响应 200',
          expect: { code: '200', content_type: 'json' },
          raw: JSON.stringify({ code: 0, data: { orderId: '1001', amount: 99.8 } }),
        },
      ],
    },
  };

  it('should generate structured Markdown documentation for an API', () => {
    const md = DocGenerator.generateMarkdown(sampleApi);
    expect(md).toContain('# 查询订单详情');
    expect(md).toContain('**请求方法**：`GET`');
    expect(md).toContain('**接口路径**：`/api/v1/orders/{orderId}`');
    expect(md).toContain('| fields |');
    expect(md).toContain('返回字段过滤');
    expect(md).toContain('Authorization');
    expect(md).toContain('成功响应 200');
    expect(md).toContain('"orderId": "1001"');
  });

  it('should generate standalone HTML page with dark mode styling and table formatting', () => {
    const md = DocGenerator.generateMarkdown(sampleApi);
    const html = DocGenerator.generateHtml('API 接口文档', md);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>API 接口文档</title>');
    expect(html).toContain('查询订单详情');
    expect(html).toContain('<table');
  });

  it('should export project tree and APIs into OpenAPI 3.0 JSON specification', () => {
    const tree: ApiTreeNode[] = [
      {
        target_id: 'api-order-detail',
        parent_id: '0',
        target_type: 'api',
        name: '查询订单详情',
        method: 'GET',
        url: '/api/v1/orders/{orderId}',
        sort: 1000,
        status: 1,
      },
    ];

    const openapi = DocGenerator.exportOpenApi('商城系统', tree, (id) => (id === sampleApi.target_id ? sampleApi : null));
    expect(openapi.openapi).toBe('3.0.0');
    expect(openapi.info.title).toBe('商城系统');
    expect(openapi.paths['/api/v1/orders/{orderId}']).toBeDefined();
    expect(openapi.paths['/api/v1/orders/{orderId}'].get).toBeDefined();
    expect(openapi.paths['/api/v1/orders/{orderId}'].get.summary).toBe('查询订单详情');
    expect(openapi.paths['/api/v1/orders/{orderId}'].get.responses['200']).toBeDefined();
  });

  it('should generate collection Markdown with Table of Contents and folder sections', () => {
    const tree: ApiTreeNode[] = [
      {
        target_id: 'folder-1',
        parent_id: '0',
        target_type: 'folder',
        name: '订单系统',
        method: '',
        url: '',
        sort: 100,
        status: 1,
      },
      {
        target_id: 'api-order-detail',
        parent_id: 'folder-1',
        target_type: 'api',
        name: '查询订单详情',
        method: 'GET',
        url: '/api/v1/orders/{orderId}',
        sort: 101,
        status: 1,
      },
    ];

    const collectionMd = DocGenerator.generateCollectionMarkdown(
      '商城开放平台接口文档',
      tree,
      (id) => (id === sampleApi.target_id ? sampleApi : null)
    );

    expect(collectionMd).toContain('# 商城开放平台接口文档');
    expect(collectionMd).toContain('## 目录大纲');
    expect(collectionMd).toContain('📁 订单系统');
    expect(collectionMd).toContain('查询订单详情');
    expect(collectionMd).toContain('### 查询订单详情');
    expect(collectionMd).toContain('**请求方法**：`GET`');
  });

  it('should include Path, Cookie, Form-data parameters, Auth and Status in Markdown', () => {
    const complexApi: ApiDetail = {
      target_id: 'api-complex',
      parent_id: '0',
      project_id: 'proj-1',
      target_type: 'api',
      name: '创建用户头像',
      method: 'POST',
      url: '/api/v1/users/{userId}/avatar',
      sort: 1,
      status: 1,
      description: '上传并更新用户个人头像',
      request: {
        path: {
          parameter: [
            { param_id: 'p1', key: 'userId', value: 'u123', description: '用户唯一标识', is_required: 1, is_checked: 1 },
          ],
        },
        query: {
          parameter: [
            { param_id: 'q1', key: 'crop', value: 'true', description: '是否自动裁剪', is_checked: 1 },
          ],
        },
        header: {
          parameter: [
            { param_id: 'h1', key: 'X-Client-Id', value: 'mypost-desktop', description: '客户端标识', is_checked: 1 },
          ],
        },
        cookie: {
          parameter: [
            { param_id: 'c1', key: 'session_id', value: 'sess_abc', description: '用户会话Token', is_checked: 1 },
          ],
        },
        body: {
          mode: 'form-data',
          parameter: [
            { param_id: 'b1', key: 'avatar_file', type: 'file', value: '', description: '头像图片文件', is_required: 1, is_checked: 1 },
          ],
        },
        auth: {
          type: 'bearer',
          bearer: { token: 'eyJhbGciOiJIUzI1Ni...' },
        },
      },
      response: {
        example: [
          {
            example_id: 'ex-1',
            name: '成功上传',
            expect: { code: '201', content_type: 'json' },
            raw: JSON.stringify({ code: 0, url: 'https://cdn.example.com/avatar.png' }),
          },
        ],
      },
    };

    const md = DocGenerator.generateMarkdown(complexApi, 1, '用户中心 / 头像管理');

    expect(md).toContain('# 创建用户头像');
    expect(md).toContain('🟢 已发布');
    expect(md).toContain('`📁 用户中心 / 头像管理`');
    expect(md).toContain('上传并更新用户个人头像');
    expect(md).toContain('Bearer Token');
    expect(md).toContain('路径参数 (Path Parameters)');
    expect(md).toContain('userId');
    expect(md).toContain('Cookie 参数');
    expect(md).toContain('session_id');
    expect(md).toContain('avatar_file');
    expect(md).toContain('HTTP 201');
    expect(md).toContain('https://cdn.example.com/avatar.png');
  });

  it('should generate Markdown documentation for SSE streaming interface', () => {
    const sseApi: ApiDetail = {
      target_id: 'sse-chat',
      parent_id: '0',
      project_id: 'proj-ai',
      target_type: 'sse',
      name: 'OpenAI 聊天流式接口',
      method: 'POST',
      url: '/v1/chat/completions',
      sort: 100,
      status: 1,
      request: {
        query: { parameter: [] },
        header: {
          parameter: [
            { param_id: 'h1', key: 'Accept', value: 'text/event-stream', description: 'SSE 响应头', is_checked: 1 },
          ],
        },
        body: { mode: 'json', raw: '{"model":"gpt-4","stream":true}' },
        auth: { type: 'bearer', bearer: { token: 'sk-test' } },
      },
    };

    const md = DocGenerator.generateMarkdown(sseApi);
    expect(md).toContain('# OpenAI 聊天流式接口');
    expect(md).toContain('**接口类型**：`SSE 流式接口`');
    expect(md).toContain('**请求方法**：`POST`');
    expect(md).toContain('**接口路径**：`/v1/chat/completions`');
    expect(md).toContain('text/event-stream');
  });

  it('should generate Markdown documentation for WebSocket interface', () => {
    const wsApi: ApiDetail = {
      target_id: 'ws-notify',
      parent_id: '0',
      project_id: 'proj-ws',
      target_type: 'websocket',
      name: '系统消息广播 WebSocket',
      method: 'GET',
      url: 'wss://echo.websocket.events',
      sort: 200,
      status: 1,
      request: {
        query: { parameter: [{ param_id: 'q1', key: 'clientId', value: '1001', is_checked: 1 }] },
        header: { parameter: [] },
        body: { mode: 'none' },
        auth: { type: 'none' },
      },
    };

    const md = DocGenerator.generateMarkdown(wsApi);
    expect(md).toContain('# 系统消息广播 WebSocket');
    expect(md).toContain('**接口类型**：`WebSocket 实时接口`');
    expect(md).toContain('**连接地址**：`wss://echo.websocket.events`');
    expect(md).not.toContain('**请求方法**');
    expect(md).toContain('clientId');
  });
});


