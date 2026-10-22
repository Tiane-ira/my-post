import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FeedbackProvider } from '../src/renderer/src/components/FeedbackContext';
import { EnvModal } from '../src/renderer/src/components/EnvModal';
import { SettingsModal } from '../src/renderer/src/components/SettingsModal';
import { ResponseViewer } from '../src/renderer/src/components/ResponseViewer';
import { WebSocketWorkbench } from '../src/renderer/src/components/WebSocketWorkbench';
import { ApiWorkbench } from '../src/renderer/src/components/ApiWorkbench';
import { EnvironmentInfo, GlobalParams, ProjectInfo, ApiTreeNode, HttpResponseResult, ApiDetail } from '../src/common/types';

describe('Modal Rendering Diagnostics', () => {
  beforeAll(() => {
    if (typeof window === 'undefined') {
      (global as any).window = {
        matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        localStorage: {
          getItem: (k: string) => null,
          setItem: () => {},
          removeItem: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      (global as any).localStorage = (global as any).window.localStorage;
      (global as any).document = {
        documentElement: {
          classList: {
            add: () => {},
            remove: () => {},
          },
        },
      };
    }
  });

  it('renders SettingsModal when isOpen is true with standard props', () => {
    const project: ProjectInfo = {
      project_id: 'p1',
      name: 'Test Project',
      intro: 'Intro',
      path: '/path/to/p1',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const treeItems: ApiTreeNode[] = [
      {
        target_id: 'api-1',
        parent_id: '0',
        target_type: 'api',
        name: 'Get User',
        method: 'GET',
        url: '/users',
        sort: 0,
        status: 1,
      },
    ];

    expect(() => {
      renderToString(
        <FeedbackProvider>
          <SettingsModal
            isOpen={true}
            onClose={() => {}}
            currentProject={project}
            treeItems={treeItems}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();
  });

  it('renders SettingsModal when currentProject is null or treeItems is empty or has nulls', () => {
    expect(() => {
      renderToString(
        <FeedbackProvider>
          <SettingsModal
            isOpen={true}
            onClose={() => {}}
            currentProject={null}
            treeItems={[] as any}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();

    expect(() => {
      renderToString(
        <FeedbackProvider>
          <SettingsModal
            isOpen={true}
            onClose={() => {}}
            currentProject={null}
            treeItems={[null as any, undefined as any]}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();
  });

  it('renders EnvModal when isOpen is true with standard props', () => {
    const envs: EnvironmentInfo[] = [
      {
        env_id: 'e1',
        name: 'Dev',
        pre_url: 'http://localhost',
        list: [
          {
            param_id: 'v1',
            key: 'token',
            value: 'xyz',
            description: '用户Token',
            is_checked: 1,
          },
        ],
      },
    ];
    const globals: GlobalParams = {
      header: [],
      query: [],
      body: [],
      vars: [
        {
          param_id: 'g1',
          key: 'baseUrl',
          value: 'http://api',
          description: '',
          is_checked: 1,
        },
      ],
    };

    expect(() => {
      renderToString(
        <FeedbackProvider>
          <EnvModal
            isOpen={true}
            onClose={() => {}}
            envs={envs}
            globalParams={globals}
            onSaveEnv={async () => {}}
            onDeleteEnv={async () => {}}
            onSaveGlobalParams={async () => {}}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();
  });

  it('renders EnvModal with empty envs and globals', () => {
    expect(() => {
      renderToString(
        <FeedbackProvider>
          <EnvModal
            isOpen={true}
            onClose={() => {}}
            envs={[]}
            globalParams={{ header: [], query: [], body: [], vars: [] }}
            onSaveEnv={async () => {}}
            onDeleteEnv={async () => {}}
            onSaveGlobalParams={async () => {}}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();
  });

  it('renders EnvModal with null/undefined items in envs, lists, and globals', () => {
    const corruptEnvs = [
      null as any,
      undefined as any,
      {
        env_id: 'e1',
        name: undefined as any,
        pre_url: undefined as any,
        list: [null as any, undefined as any, { param_id: 'v1', key: 'k1' }] as any,
      },
    ];
    const corruptGlobals: any = {
      vars: [null, undefined, { key: 'g1' }],
    };

    expect(() => {
      renderToString(
        <FeedbackProvider>
          <EnvModal
            isOpen={true}
            onClose={() => {}}
            envs={corruptEnvs}
            globalParams={corruptGlobals}
            onSaveEnv={async () => {}}
            onDeleteEnv={async () => {}}
            onSaveGlobalParams={async () => {}}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();
  });

  it('renders EnvModal when globalParams is undefined or envs is undefined', () => {
    expect(() => {
      renderToString(
        <FeedbackProvider>
          <EnvModal
            isOpen={true}
            onClose={() => {}}
            envs={undefined as any}
            globalParams={undefined as any}
            onSaveEnv={async () => {}}
            onDeleteEnv={async () => {}}
            onSaveGlobalParams={async () => {}}
          />
        </FeedbackProvider>
      );
    }).not.toThrow();
  });

  it('renders SettingsModal and EnvModal with actual user roaming data', async () => {
    const { FileDB } = await import('../src/main/fileDB');
    const fileDB = new FileDB('C:\\Users\\james\\AppData\\Roaming\\mypost');
    const projects = fileDB.listProjects();
    for (const proj of projects) {
      const tree = fileDB.getProjectTree(proj.project_id);
      const envs = fileDB.getEnvs(proj.project_id);
      const globals = fileDB.getGlobalParams(proj.project_id);

      expect(() => {
        renderToString(
          <FeedbackProvider>
            <SettingsModal
              isOpen={true}
              onClose={() => {}}
              currentProject={proj}
              treeItems={tree}
            />
          </FeedbackProvider>
        );
      }).not.toThrow();

      expect(() => {
        renderToString(
          <FeedbackProvider>
            <EnvModal
              isOpen={true}
              onClose={() => {}}
              envs={envs}
              globalParams={globals}
              onSaveEnv={async () => {}}
              onDeleteEnv={async () => {}}
              onSaveGlobalParams={async () => {}}
            />
          </FeedbackProvider>
        );
      }).not.toThrow();
    }
  });

  it('renders ResponseViewer with cancel button in response body when loading', () => {
    let cancelCalled = false;
    const html = renderToString(
      <FeedbackProvider>
        <ResponseViewer
          response={null}
          loading={true}
          onCancel={() => { cancelCalled = true; }}
        />
      </FeedbackProvider>
    );
    expect(html).toContain('取消请求');
    expect(html).toContain('请求进行中');
  });

  it('renders ResponseViewer with canceled banner when response statusText is Canceled', () => {
    const canceledResponse: HttpResponseResult = {
      statusCode: 0,
      statusText: 'Canceled',
      timeMs: 120,
      sizeBytes: 0,
      headers: {},
      cookies: [],
      data: null,
      rawText: '',
      error: '请求已被手动取消',
      logs: ['[CANCEL] 用户手动取消了本次请求'],
    };

    const html = renderToString(
      <FeedbackProvider>
        <ResponseViewer
          response={canceledResponse}
          loading={false}
        />
      </FeedbackProvider>
    );
    expect(html).toContain('已取消 (Canceled)');
    expect(html).toContain('请求已手动取消');
  });

  it('renders WebSocketWorkbench with top-bottom layout (params on top-left, sender on top-right, response area at bottom)', () => {
    const wsApi: ApiDetail = {
      target_id: 'ws-1',
      parent_id: '0',
      name: 'Echo WebSocket',
      method: 'GET',
      url: 'wss://echo.websocket.events',
      protocol: 'websocket',
      request: {
        query: {
          parameter: [
            { key: 'token', value: 'xyz123', is_checked: 1, type: 'string' },
          ],
        },
        header: {
          parameter: [
            { key: 'X-Client', value: 'MyPost', is_checked: 1, type: 'string' },
          ],
        },
      },
      websocket: {
        protocols: 'v1.proto',
        heartbeat: {
          enabled: true,
          interval: 20,
          message: 'ping',
        },
        messageDraft: '{"msg":"hello"}',
        messageMode: 'json',
      },
    };

    const html = renderToString(
      <FeedbackProvider>
        <WebSocketWorkbench
          api={wsApi}
          onChange={() => {}}
          onSave={() => {}}
        />
      </FeedbackProvider>
    );

    // Top-left: Parameters editing area
    expect(html).toContain('Params');
    expect(html).toContain('Headers');
    expect(html).toContain('Protocols');
    expect(html).toContain('心跳保活');

    // Top-right: Message composer area
    expect(html).toContain('消息发送');
    expect(html).toContain('发送消息');

    // Bottom: Response area referencing HTTP interface
    expect(html).toContain('实时消息');
    expect(html).toContain('握手与连接');
    expect(html).toContain('未连接');
    expect(html).toContain('仅匹配');
  });

  it('renders ApiWorkbench with cachedResponse intact on mount and tab restoration', () => {
    const httpApi: ApiDetail = {
      target_id: 'http-1',
      parent_id: '0',
      name: 'Get User Info',
      method: 'GET',
      url: '/api/v1/user/123',
      request: {
        query: { parameter: [] },
        header: { parameter: [] },
      },
    };

    const cachedRes: HttpResponseResult = {
      statusCode: 200,
      statusText: 'OK',
      timeMs: 45,
      sizeBytes: 1024,
      headers: { 'content-type': 'application/json' },
      cookies: [],
      data: { user: 'Alice', role: 'admin' },
      rawText: '{"user":"Alice","role":"admin"}',
      logs: ['[RES] HTTP 200 OK'],
    };

    const html = renderToString(
      <FeedbackProvider>
        <ApiWorkbench
          api={httpApi}
          onChange={() => {}}
          onSave={() => {}}
          onSend={async () => cachedRes}
          cachedResponse={cachedRes}
          onResponseChange={() => {}}
        />
      </FeedbackProvider>
    );

    // Verify status code, time, and data from cached response are rendered
    expect(html).toContain('200');
    expect(html).toContain('OK');
    expect(html).toContain('45');
    expect(html).toContain('ms');
    expect(html).toContain('Alice');
  });
});


