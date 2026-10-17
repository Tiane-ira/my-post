import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileDB } from '../src/main/fileDB';
import { MockServer } from '../src/main/mockServer';
import { ApiDetail, ApiTreeNode } from '../src/common/types';

describe('MockServer Engine', () => {
  let tempDir: string;
  let fileDB: FileDB;
  let mockServer: MockServer;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `mypost-mock-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    fileDB = new FileDB(tempDir);
    mockServer = new MockServer(fileDB);
  });

  afterEach(async () => {
    await mockServer.stop();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  const requestMock = (port: number, path: string, method: string = 'GET'): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> => {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          agent: false,
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'close',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 200,
              body: data,
              headers: res.headers,
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  };

  it('should start on candidate port and provide server info', async () => {
    const info = await mockServer.start();
    expect(info.running).toBe(true);
    expect(info.port).toBeGreaterThan(0);
    expect(info.baseUrl).toContain(`http://127.0.0.1:${info.port}`);
  });

  it('should respond with mock data for matching api route', async () => {
    const projects = fileDB.listProjects();
    const projectId = projects[0].project_id;

    // Create an API with a mock example
    const apiId = 'api-mock-test-1';
    const treeNode: ApiTreeNode = {
      target_id: apiId,
      parent_id: '0',
      target_type: 'api',
      name: '测试Mock接口',
      method: 'GET',
      url: '/api/v1/user/info',
      sort: 1000,
      status: 1,
    };
    fileDB.saveProjectTree(projectId, [treeNode]);

    const apiDetail: ApiDetail = {
      target_id: apiId,
      parent_id: '0',
      project_id: projectId,
      target_type: 'api',
      name: '测试Mock接口',
      method: 'GET',
      url: '/api/v1/user/info',
      sort: 1000,
      status: 1,
      request: {
        query: { parameter: [] },
        header: { parameter: [] },
        body: { mode: 'none' },
        auth: { type: 'none' },
      },
      response: {
        example: [
          {
            example_id: 'ex-1',
            name: '成功期望',
            is_default: 1,
            response_type: 'json',
            status_code: 200,
            raw: JSON.stringify({
              code: 0,
              msg: 'success',
              'data|3': [{ 'id|+1': 1, name: '@cname', email: '@email' }],
            }),
          },
        ],
      },
    };
    fileDB.saveApiDetail(projectId, apiId, apiDetail);

    const info = await mockServer.start();

    // 1. Standard format: /mock/:projectId/api/v1/user/info
    const res = await requestMock(info.port, `/mock/${projectId}/api/v1/user/info`);
    expect(res.status).toBe(200);

    const parsed = JSON.parse(res.body);
    expect(parsed.code).toBe(0);
    expect(parsed.msg).toBe('success');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data.length).toBe(3);
    expect(parsed.data[0].name).toBeDefined();
    expect(parsed.data[0].email).toContain('@');

    // 2. Project path format: /app/mock/project/:projectId/api/v1/user/info
    const res2 = await requestMock(info.port, `/app/mock/project/${projectId}/api/v1/user/info`);
    expect(res2.status).toBe(200);
    const parsed2 = JSON.parse(res2.body);
    expect(parsed2.code).toBe(0);
  });

  it('should handle CORS OPTIONS requests', async () => {
    const info = await mockServer.start();
    const res = await requestMock(info.port, '/mock/test/foo', 'OPTIONS');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('should return 404 with helpful json when no matching route is found', async () => {
    const info = await mockServer.start();
    const res = await requestMock(info.port, '/mock/non-existent-proj/unknown/path');
    expect(res.status).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.code).toBe(404);
  });
});
