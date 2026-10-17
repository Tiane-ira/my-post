import { describe, it, expect } from 'vitest';
import { TreeUtils } from '../src/common/treeUtils';
import { ApiTreeNode } from '../src/common/types';

describe('TreeUtils Directory and Hierarchy Engine', () => {
  const sampleTree: ApiTreeNode[] = [
    {
      target_id: 'folder-user',
      parent_id: '0',
      target_type: 'folder',
      name: '用户模块',
      method: '',
      url: '',
      sort: 1000,
      status: 1,
    },
    {
      target_id: 'api-login',
      parent_id: 'folder-user',
      target_type: 'api',
      name: '用户登录',
      method: 'POST',
      url: '/api/v1/login',
      sort: 1001,
      status: 1,
    },
    {
      target_id: 'folder-profile',
      parent_id: 'folder-user',
      target_type: 'folder',
      name: '个人资料子目录',
      method: '',
      url: '',
      sort: 1002,
      status: 1,
    },
    {
      target_id: 'api-get-profile',
      parent_id: 'folder-profile',
      target_type: 'api',
      name: '获取个人信息',
      method: 'GET',
      url: '/api/v1/profile',
      sort: 1003,
      status: 1,
    },
    {
      target_id: 'api-root',
      parent_id: '0',
      target_type: 'api',
      name: '健康检查根接口',
      method: 'GET',
      url: '/health',
      sort: 2000,
      status: 1,
    },
  ];

  it('should recursively count the number of APIs inside a folder', () => {
    // folder-user has api-login and folder-profile (which has api-get-profile) => total 2 APIs
    const userApiCount = TreeUtils.countFolderApis(sampleTree, 'folder-user');
    expect(userApiCount).toBe(2);

    // folder-profile has only api-get-profile => total 1 API
    const profileApiCount = TreeUtils.countFolderApis(sampleTree, 'folder-profile');
    expect(profileApiCount).toBe(1);
  });

  it('should retrieve all direct and nested descendant nodes of a folder', () => {
    const directChildren = TreeUtils.getFolderChildren(sampleTree, 'folder-user', false);
    expect(directChildren.length).toBe(2);
    expect(directChildren.map((c) => c.target_id)).toEqual(['api-login', 'folder-profile']);

    const allDescendants = TreeUtils.getFolderChildren(sampleTree, 'folder-user', true);
    expect(allDescendants.length).toBe(3);
    expect(allDescendants.some((c) => c.target_id === 'api-get-profile')).toBe(true);
  });

  it('should return breadcrumb paths for a given node', () => {
    const breadcrumbs = TreeUtils.buildBreadcrumbs(sampleTree, 'api-get-profile');
    expect(breadcrumbs).toEqual(['用户模块', '个人资料子目录', '获取个人信息']);

    const rootBreadcrumbs = TreeUtils.buildBreadcrumbs(sampleTree, 'api-root');
    expect(rootBreadcrumbs).toEqual(['健康检查根接口']);
  });

  it('should filter only folder nodes', () => {
    const folders = TreeUtils.getAllFolders(sampleTree);
    expect(folders.length).toBe(2);
    expect(folders.every((f) => f.target_type === 'folder')).toBe(true);
  });

  it('should retrieve subtree for root directory (all items) and subfolder', () => {
    const rootSubtree = TreeUtils.getFolderHierarchy(sampleTree, '0');
    expect(rootSubtree.length).toBe(sampleTree.length);

    const folderSubtree = TreeUtils.getFolderHierarchy(sampleTree, 'folder-user');
    expect(folderSubtree.length).toBe(4); // folder-user + api-login + folder-profile + api-get-profile
    expect(folderSubtree.some((n) => n.target_id === 'folder-user')).toBe(true);
    expect(folderSubtree.some((n) => n.target_id === 'api-get-profile')).toBe(true);
    expect(folderSubtree.some((n) => n.target_id === 'api-root')).toBe(false);
  });

  it('should generate ordered folder options for dropdowns with root directory first', () => {
    const options = TreeUtils.getOrderedFolderOptions(sampleTree);
    expect(options[0].id).toBe('0');
    expect(options[0].name).toContain('根目录');
    expect(options[0].count).toBe(3); // Total APIs

    const userFolderOpt = options.find((o) => o.id === 'folder-user');
    expect(userFolderOpt).toBeDefined();
    expect(userFolderOpt?.depth).toBe(1);
    expect(userFolderOpt?.count).toBe(2);

    const profileFolderOpt = options.find((o) => o.id === 'folder-profile');
    expect(profileFolderOpt).toBeDefined();
    expect(profileFolderOpt?.depth).toBe(2);
    expect(profileFolderOpt?.path).toContain('用户模块 / 个人资料子目录');
  });

  it('should count sse and websocket interfaces inside a folder', () => {
    const streamingTree: ApiTreeNode[] = [
      { target_id: 'folder-stream', parent_id: '0', target_type: 'folder', name: '流式接口目录', method: '', url: '', sort: 10, status: 1 },
      { target_id: 'sse-chat', parent_id: 'folder-stream', target_type: 'sse', name: 'AI 聊天补全 SSE', method: 'POST', url: '/v1/chat/completions', sort: 11, status: 1 },
      { target_id: 'ws-notify', parent_id: 'folder-stream', target_type: 'websocket', name: '实时推送 WS', method: 'GET', url: 'wss://echo.websocket.events', sort: 12, status: 1 },
      { target_id: 'api-status', parent_id: 'folder-stream', target_type: 'api', name: '状态查询', method: 'GET', url: '/status', sort: 13, status: 1 },
    ];
    const streamCount = TreeUtils.countFolderApis(streamingTree, 'folder-stream');
    expect(streamCount).toBe(3);
  });
});

