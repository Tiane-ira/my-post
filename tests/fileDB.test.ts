import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileDB } from '../src/main/fileDB';
import { ApiDetail, ApiTreeNode, EnvironmentInfo, GlobalParams } from '../src/common/types';

describe('FileDB Storage Engine', () => {
  let tempDir: string;
  let fileDB: FileDB;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `mypost-filedb-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    fileDB = new FileDB(tempDir);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should initialize default project when registry is empty', () => {
    const projects = fileDB.listProjects();
    expect(projects.length).toBeGreaterThanOrEqual(1);
    expect(projects[0].name).toBe('我的默认项目');
    expect(fs.existsSync(fileDB.getProjectPath(projects[0].project_id))).toBe(true);
  });

  it('should create and list new projects', () => {
    const created = fileDB.createProject('测试项目 A', '自动化测试用项目描述');
    expect(created.project_id).toBeDefined();
    expect(created.name).toBe('测试项目 A');

    const list = fileDB.listProjects();
    const found = list.find((p) => p.project_id === created.project_id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('测试项目 A');
  });

  it('should save and retrieve project tree items', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    const initialTree = fileDB.getProjectTree(projectId);
    expect(Array.isArray(initialTree)).toBe(true);
    expect(initialTree.length).toBe(0);

    const newTree: ApiTreeNode[] = [
      {
        target_id: 'api-101',
        parent_id: '0',
        target_type: 'api',
        name: '用户登录',
        method: 'POST',
        url: '/api/login',
        sort: 1000,
        status: 1,
      },
    ];

    fileDB.saveProjectTree(projectId, newTree);
    const retrieved = fileDB.getProjectTree(projectId);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].name).toBe('用户登录');
    expect(retrieved[0].method).toBe('POST');
  });

  it('should save, retrieve and delete api detail', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;
    const apiId = 'api-test-detail-1';

    const detail: ApiDetail = {
      target_id: apiId,
      parent_id: '0',
      project_id: projectId,
      target_type: 'api',
      name: '获取商品详情',
      method: 'GET',
      url: 'https://api.example.com/items/1',
      sort: 1000,
      status: 1,
      request: {
        query: { parameter: [{ param_id: 'p1', key: 'ref', value: 'search', is_checked: 1 }] },
        header: { parameter: [{ param_id: 'h1', key: 'X-Version', value: '2.0', is_checked: 1 }] },
        body: { mode: 'none' },
        auth: { type: 'bearer', bearer: { token: 'secret-token' } },
        pre_tasks: [],
        post_tasks: [],
      },
      response: {
        example: [
          {
            example_id: 'ex-1',
            name: '成功响应',
            raw: '{"code":0,"item":{"id":1,"name":"Laptop"}}',
          },
        ],
      },
    };

    fileDB.saveApiDetail(projectId, apiId, detail);
    const fetched = fileDB.getApiDetail(projectId, apiId);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('获取商品详情');
    expect(fetched?.request.auth.type).toBe('bearer');
    expect(fetched?.request.auth.bearer?.token).toBe('secret-token');

    // Delete
    fileDB.deleteApi(projectId, apiId);
    const deleted = fileDB.getApiDetail(projectId, apiId);
    expect(deleted).toBeNull();
  });

  it('should save, retrieve and delete environments', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    const env: EnvironmentInfo = {
      env_id: 'env-staging',
      name: '预发布环境',
      pre_url: 'https://staging.example.com',
      list: [
        { param_id: 'v1', key: 'appId', value: 'wx123456', is_checked: 1 },
      ],
    };

    fileDB.saveEnv(projectId, env);
    const envs = fileDB.getEnvs(projectId);
    const found = envs.find((e) => e.env_id === 'env-staging');
    expect(found).toBeDefined();
    expect(found?.pre_url).toBe('https://staging.example.com');
    expect(found?.list.length).toBe(1);

    // Delete
    fileDB.deleteEnv(projectId, 'env-staging');
    const afterDelete = fileDB.getEnvs(projectId);
    expect(afterDelete.find((e) => e.env_id === 'env-staging')).toBeUndefined();
  });

  it('should save and retrieve global parameters', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    const globals: GlobalParams = {
      header: [{ param_id: 'g1', key: 'X-App-Env', value: 'testing', is_checked: 1 }],
      query: [{ param_id: 'g2', key: 'lang', value: 'zh-CN', is_checked: 1 }],
      body: [],
      vars: [{ param_id: 'g3', key: 'globalTimeout', value: '5000', is_checked: 1 }],
    };

    fileDB.saveGlobalParams(projectId, globals);
    const retrieved = fileDB.getGlobalParams(projectId);
    expect(retrieved.header.length).toBe(1);
    expect(retrieved.header[0].key).toBe('X-App-Env');
    expect(retrieved.query[0].value).toBe('zh-CN');
    expect(retrieved.vars[0].key).toBe('globalTimeout');
  });

  it('should seamlessly parse nested data structure for api, envs, and global_params', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;
    const projDir = fileDB.getProjectPath(projectId);

    // 1. Nested data format in apis/api-apipost-1.json
    const apipostApi = {
      target_id: 'api-apipost-1',
      name: '原生嵌套数据接口',
      method: 'POST',
      url: 'https://api.example.com/users/{id}',
      data: {
        request: {
          query: { parameter: [{ param_id: 'q1', key: 'page', value: '1', is_checked: 1 }] },
          header: { parameter: [{ param_id: 'h1', key: 'Authorization', value: 'Bearer abc', is_checked: 1 }] },
          restful: { parameter: [{ param_id: 'p1', key: 'id', value: '1001', is_checked: 1 }] },
          cookie: { parameter: [] },
          body: {
            mode: 'json',
            raw: JSON.stringify({ name: 'test' }),
          },
          auth: { type: 'bearer', bearer: { token: 'abc' } },
        },
        response: {
          example: [{ example_id: 'ex1', name: '成功', raw: '{"ok":true}' }],
        },
      },
    };
    fs.writeFileSync(path.join(projDir, 'apis', 'api-apipost-1.json'), JSON.stringify(apipostApi));

    const normalizedApi = fileDB.getApiDetail(projectId, 'api-apipost-1');
    expect(normalizedApi).toBeDefined();
    expect(normalizedApi?.request.header.parameter.length).toBe(1);
    expect(normalizedApi?.request.header.parameter[0].key).toBe('Authorization');
    expect(normalizedApi?.request.query.parameter.length).toBe(1);
    expect(normalizedApi?.request.path?.parameter.length).toBe(1);
    expect(normalizedApi?.request.path?.parameter[0].key).toBe('id');
    expect(normalizedApi?.request.body.mode).toBe('json');
    expect(normalizedApi?.request.body.raw).toBe(JSON.stringify({ name: 'test' }));
    expect(normalizedApi?.response?.example?.length).toBe(1);

    // 2. Legacy envs format (items array, server_list uri)
    const apipostEnvsIndex = {
      items: [{ env_id: 'apipost-env-1', name: '默认环境', sort: 1000 }],
    };
    fs.writeFileSync(path.join(projDir, 'envs', 'index.json'), JSON.stringify(apipostEnvsIndex));
    fs.writeFileSync(
      path.join(projDir, 'envs', 'apipost-env-1.json'),
      JSON.stringify({
        env_id: 'apipost-env-1',
        name: '默认环境',
        server_list: [{ name: '服务1', server_id: '1', uri: 'https://example.com' }],
        list: [{ param_id: '1', key: 'token', value: 'xyz', is_checked: 1 }],
      })
    );
    const retrievedEnvs = fileDB.getEnvs(projectId);
    expect(retrievedEnvs.length).toBe(1);
    expect(retrievedEnvs[0].name).toBe('默认环境');
    expect(retrievedEnvs[0].pre_url).toBe('https://example.com');
    expect(retrievedEnvs[0].list.length).toBe(1);

    // 3. Nested global_params format (parameter object inside header/query/body)
    const apipostGlobalParams = {
      header: { parameter: [{ param_id: 'gh1', key: 'X-App', value: 'mypost', is_checked: 1 }] },
      query: { parameter: [] },
      body: { parameter: [] },
      vars: [{ param_id: 'gv1', key: 'host', value: '127.0.0.1', is_checked: 1 }],
    };
    fs.writeFileSync(path.join(projDir, 'global_params.json'), JSON.stringify(apipostGlobalParams));
    const retrievedGlobals = fileDB.getGlobalParams(projectId);
    expect(Array.isArray(retrievedGlobals.header)).toBe(true);
    expect(retrievedGlobals.header[0].key).toBe('X-App');
    expect(Array.isArray(retrievedGlobals.vars)).toBe(true);
    expect(retrievedGlobals.vars[0].key).toBe('host');
  });

  it('should recursively delete folder and all nested descendant APIs and files', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    // Create a folder and child api
    const folderNode: ApiTreeNode = {
      target_id: 'folder-orders',
      parent_id: '0',
      target_type: 'folder',
      name: '订单模块',
      method: '',
      url: '',
      sort: 1000,
      status: 1,
    };
    const childApiNode: ApiTreeNode = {
      target_id: 'api-sub-order',
      parent_id: 'folder-orders',
      target_type: 'api',
      name: '创建订单',
      method: 'POST',
      url: '/orders',
      sort: 2000,
      status: 1,
    };
    fileDB.saveProjectTree(projectId, [folderNode, childApiNode]);
    fileDB.saveApiDetail(projectId, 'api-sub-order', {
      target_id: 'api-sub-order',
      parent_id: 'folder-orders',
      project_id: projectId,
      target_type: 'api',
      name: '创建订单',
      method: 'POST',
      url: '/orders',
      sort: 2000,
      status: 1,
      request: { query: { parameter: [] }, header: { parameter: [] }, body: { mode: 'none' }, auth: { type: 'none' } },
      response: { example: [] },
    });

    expect(fileDB.getApiDetail(projectId, 'api-sub-order')).not.toBeNull();

    // Deleting parent folder should delete child api in tree and on disk
    fileDB.deleteApi(projectId, 'folder-orders');
    const remainingTree = fileDB.getProjectTree(projectId);
    expect(remainingTree.find((t) => t.target_id === 'folder-orders')).toBeUndefined();
    expect(remainingTree.find((t) => t.target_id === 'api-sub-order')).toBeUndefined();
    expect(fileDB.getApiDetail(projectId, 'api-sub-order')).toBeNull();
  });

  it('should clear all APIs and files under root with clearProjectApis', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    fileDB.saveApiDetail(projectId, 'api-temp-1', {
      target_id: 'api-temp-1',
      parent_id: '0',
      project_id: projectId,
      target_type: 'api',
      name: '临时接口 1',
      method: 'GET',
      url: '/temp1',
      sort: 1000,
      status: 1,
      request: { query: { parameter: [] }, header: { parameter: [] }, body: { mode: 'none' }, auth: { type: 'none' } },
      response: { example: [] },
    });

    expect(fileDB.getProjectTree(projectId).length).toBeGreaterThan(0);
    expect(fileDB.getApiDetail(projectId, 'api-temp-1')).not.toBeNull();

    // Clear all APIs
    fileDB.clearProjectApis(projectId);

    expect(fileDB.getProjectTree(projectId)).toEqual([]);
    expect(fileDB.getApiDetail(projectId, 'api-temp-1')).toBeNull();
  });

  it('should batch import multiple APIs and tree nodes atomically with batchImportApis', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    const details: ApiDetail[] = [
      {
        target_id: 'batch-api-1',
        parent_id: 'folder-batch',
        project_id: projectId,
        target_type: 'api',
        name: '批量接口 1',
        method: 'GET',
        url: '/batch1',
        sort: 1000,
        status: 1,
        request: { query: { parameter: [] }, header: { parameter: [] }, body: { mode: 'none' }, auth: { type: 'none' } },
        response: { example: [] },
      },
      {
        target_id: 'batch-api-2',
        parent_id: 'folder-batch',
        project_id: projectId,
        target_type: 'api',
        name: '批量接口 2',
        method: 'POST',
        url: '/batch2',
        sort: 2000,
        status: 1,
        request: { query: { parameter: [] }, header: { parameter: [] }, body: { mode: 'json', raw: '{"ok":true}' }, auth: { type: 'none' } },
        response: { example: [] },
      },
    ];

    const tree: ApiTreeNode[] = [
      {
        target_id: 'folder-batch',
        parent_id: '0',
        target_type: 'folder',
        name: '批量分类',
        method: '',
        url: '',
        sort: 500,
        status: 1,
      },
      {
        target_id: 'batch-api-1',
        parent_id: 'folder-batch',
        target_type: 'api',
        name: '批量接口 1',
        method: 'GET',
        url: '/batch1',
        sort: 1000,
        status: 1,
      },
      {
        target_id: 'batch-api-2',
        parent_id: 'folder-batch',
        target_type: 'api',
        name: '批量接口 2',
        method: 'POST',
        url: '/batch2',
        sort: 2000,
        status: 1,
      },
    ];

    const ok = fileDB.batchImportApis(projectId, details, tree);
    expect(ok).toBe(true);

    const savedTree = fileDB.getProjectTree(projectId);
    expect(savedTree.length).toBe(3);
    expect(savedTree.find((n) => n.target_id === 'folder-batch')?.name).toBe('批量分类');

    const detail1 = fileDB.getApiDetail(projectId, 'batch-api-1');
    expect(detail1?.name).toBe('批量接口 1');
    expect(detail1?.url).toBe('/batch1');

    const detail2 = fileDB.getApiDetail(projectId, 'batch-api-2');
    expect(detail2?.method).toBe('POST');
    expect(detail2?.request.body.raw).toBe('{"ok":true}');
  });

  it('should save and retrieve websocket configuration including heartbeat and subprotocols', () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    const wsApi: ApiDetail = {
      target_id: 'ws-test-1',
      parent_id: '0',
      project_id: projectId,
      target_type: 'websocket',
      name: 'WebSocket 实时测试',
      method: 'GET',
      url: 'wss://echo.websocket.events',
      sort: 1000,
      status: 1,
      request: {
        query: { parameter: [] },
        header: { parameter: [] },
        body: { mode: 'none' },
        auth: { type: 'none' },
      },
      websocket: {
        protocols: 'graphql-transport-ws, proto.v1',
        heartbeat: {
          enabled: true,
          interval: 15,
          message: '{"type":"ping"}',
        },
        messageDraft: '{"action":"subscribe"}',
        messageMode: 'json',
      },
    };

    const saved = fileDB.saveApiDetail(projectId, wsApi.target_id, wsApi);
    expect(saved).toBe(true);

    const retrieved = fileDB.getApiDetail(projectId, 'ws-test-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.target_type).toBe('websocket');
    expect(retrieved?.websocket).toBeDefined();
    expect(retrieved?.websocket?.heartbeat.enabled).toBe(true);
    expect(retrieved?.websocket?.heartbeat.interval).toBe(15);
    expect(retrieved?.websocket?.heartbeat.message).toBe('{"type":"ping"}');
    expect(retrieved?.websocket?.protocols).toBe('graphql-transport-ws, proto.v1');
    expect(retrieved?.websocket?.messageDraft).toBe('{"action":"subscribe"}');
    expect(retrieved?.websocket?.messageMode).toBe('json');
  });
});
