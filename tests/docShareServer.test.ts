import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DocShareServer, DocShareRecord } from '../src/main/docShareServer';
import http from 'http';

describe('DocShareServer LAN Documentation Sharing', () => {
  let server: DocShareServer;

  beforeAll(async () => {
    server = new DocShareServer();
    await server.start(31090);
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should detect network interfaces and provide LAN IP', () => {
    const info = server.getServerInfo();
    expect(info.running).toBe(true);
    expect(info.port).toBeGreaterThan(0);
    expect(info.primaryIp).toBeDefined();
    expect(info.allIps.length).toBeGreaterThan(0);
  });

  it('should register a share record and return LAN URL', () => {
    const record: DocShareRecord = {
      shareId: 'test_share_123',
      title: '用户中心接口文档',
      projectId: 'proj_test',
      projectName: '电商服务',
      scope: 'project',
      createdAt: Date.now(),
      tree: [
        {
          target_id: 'api_1',
          parent_id: '0',
          name: '获取用户信息',
          target_type: 'api',
          sort: 1,
          method: 'GET',
        },
      ],
      apis: [
        {
          target_id: 'api_1',
          name: '获取用户信息',
          method: 'GET',
          status: 1,
          request: {
            url: '/api/v1/user/profile',
            query: { parameter: [] },
            header: { parameter: [] },
            body: { mode: 'none' },
            auth: { type: 'noauth' },
          },
        },
      ],
    };

    const res = server.registerShare(record);
    expect(res.shareId).toBe('test_share_123');
    expect(res.lanUrl).toContain('/share/test_share_123');

    const fetched = server.getShare('test_share_123');
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('用户中心接口文档');
  });

  it('should serve HTML document SPA over HTTP', async () => {
    const port = server.getServerInfo().port;

    const html = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/share/test_share_123`, (res) => {
        expect(res.statusCode).toBe(200);
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });
    });

    expect(html).toContain('用户中心接口文档');
    expect(html).toContain('获取用户信息');
    expect(html).toContain('/api/v1/user/profile');
    expect(html).toContain('apiTree');
    expect(html).toContain('保存为 Markdown');
    expect(html).not.toContain('复制 Markdown');
    expect(html).toContain('Query 查询参数');
    expect(html).toContain('Request Headers 请求头');

    // Verify embedded SPA JavaScript syntax is completely valid
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).toBeTruthy();
    const scriptCode = scriptMatch![1];
    const vm = await import('vm');
    expect(() => new vm.Script(scriptCode)).not.toThrow();
  });

  it('should list shares with rich metadata', () => {
    const list = server.listShares();
    expect(list.length).toBeGreaterThan(0);
    const item = list.find((s) => s.shareId === 'test_share_123');
    expect(item).toBeDefined();
    expect(item?.apiCount).toBe(1);
    expect(item?.lanUrl).toContain('/share/test_share_123');
    expect(item?.isExpired).toBe(false);
  });

  it('should delete a share record', () => {
    const deleted = server.deleteShare('test_share_123');
    expect(deleted).toBe(true);
    const fetched = server.getShare('test_share_123');
    expect(fetched).toBeUndefined();
  });

  it('should prompt for password when documentation is protected', async () => {
    const port = server.getServerInfo().port;
    server.registerShare({
      shareId: 'protected_doc',
      title: '私密接口文档',
      projectId: 'proj_secret',
      projectName: '机密项目',
      scope: 'api',
      password: 'mypassword888',
      createdAt: Date.now(),
      tree: [],
      apis: [],
    });

    // Request without password
    const withoutPwd = await new Promise<string>((resolve) => {
      http.get(`http://127.0.0.1:${port}/share/protected_doc`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });
    });
    expect(withoutPwd).toContain('文档受密码保护');

    // Request with correct password
    const withPwd = await new Promise<string>((resolve) => {
      http.get(`http://127.0.0.1:${port}/share/protected_doc?pwd=mypassword888`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });
    });
    expect(withPwd).toContain('私密接口文档');
    expect(withPwd).not.toContain('文档受密码保护');
  });

  it('should return 404 for unknown share', async () => {
    const port = server.getServerInfo().port;
    const statusCode = await new Promise<number>((resolve) => {
      http.get(`http://127.0.0.1:${port}/share/non_existent_id`, (res) => {
        resolve(res.statusCode || 0);
      });
    });
    expect(statusCode).toBe(404);
  });

  it('should clear all shares', () => {
    server.clearAllShares();
    expect(server.listShares().length).toBe(0);
  });
});
