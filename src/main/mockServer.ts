import http from 'http';
import url from 'url';
import Mock from 'mockjs';
import { FileDB } from './fileDB';
import { ApiDetail, ApiTreeNode, MockServerInfo } from '../common/types';

export class MockServer {
  private fileDB: FileDB;
  private server: http.Server | null = null;
  private port: number = 30999;
  private isRunning: boolean = false;
  private host: string = '127.0.0.1';

  constructor(fileDB: FileDB) {
    this.fileDB = fileDB;
  }

  public getInfo(): MockServerInfo {
    return {
      port: this.port,
      running: this.isRunning,
      host: this.host,
      baseUrl: `http://${this.host}:${this.port}`,
    };
  }

  public async start(preferredPort: number = 30999): Promise<MockServerInfo> {
    if (this.isRunning && this.server) {
      return this.getInfo();
    }

    const candidatePorts = [preferredPort, 30998, 31000, 31001, 31002, 31005];

    for (const portToTry of candidatePorts) {
      try {
        await this.bindPort(portToTry);
        this.port = portToTry;
        this.isRunning = true;
        console.log(`[MockServer] Local Mock Engine listening on http://${this.host}:${this.port}`);
        return this.getInfo();
      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[MockServer] Port ${portToTry} in use, trying next candidate...`);
          continue;
        }
        throw err;
      }
    }

    // If candidate ports all fail, bind to any free port (0)
    await this.bindPort(0);
    const address = this.server?.address();
    if (address && typeof address === 'object') {
      this.port = address.port;
    }
    this.isRunning = true;
    console.log(`[MockServer] Local Mock Engine listening on fallback port http://${this.host}:${this.port}`);
    return this.getInfo();
  }

  private bindPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.handleRequest(req, res));
      
      server.once('error', (err) => {
        reject(err);
      });

      server.listen(port, this.host, () => {
        this.server = server;
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
      this.isRunning = false;
      console.log('[MockServer] Local Mock Engine stopped.');
    }
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, *');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    const pathname = decodeURIComponent(parsedUrl.pathname || '/');
    const query = parsedUrl.query;
    const reqMethod = (req.method || 'GET').toUpperCase();

    // 2. Resolve project & target API
    // Path formats supported:
    // /mock/:projectId/*
    // /app/mock/project/:projectId/*
    // Direct path: /* (falls back to search in all registered projects)
    let projectId = '';
    let targetApiPath = '';

    const mockMatch = pathname.match(/^\/mock\/([^/]+)(\/.*)?$/);
    const appMockMatch = pathname.match(/^\/app\/mock\/project\/([^/]+)(\/.*)?$/);

    if (mockMatch) {
      projectId = mockMatch[1];
      targetApiPath = mockMatch[2] || '/';
    } else if (appMockMatch) {
      projectId = appMockMatch[1];
      targetApiPath = appMockMatch[2] || '/';
    } else {
      targetApiPath = pathname;
      if (typeof query.project_id === 'string') {
        projectId = query.project_id;
      }
    }

    const targetIdFromQuery = (query.apipost_id || query.target_id || query.id) as string | undefined;

    let matchedApi: ApiDetail | null = null;
    let matchedProjectId = projectId;

    if (projectId) {
      matchedApi = this.findApiInProject(projectId, targetApiPath, reqMethod, targetIdFromQuery);
    } else {
      // Search across all projects
      const projects = this.fileDB.listProjects();
      for (const p of projects) {
        const found = this.findApiInProject(p.project_id, targetApiPath, reqMethod, targetIdFromQuery);
        if (found) {
          matchedApi = found;
          matchedProjectId = p.project_id;
          break;
        }
      }
    }

    // 3. Return Mock response
    if (matchedApi) {
      this.sendMockResponse(res, matchedApi);
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json;charset=utf-8');
      res.end(
        JSON.stringify({
          code: 404,
          msg: 'mock route not found',
          method: reqMethod,
          path: pathname,
          hint: 'Please check your API path and method, or configure Mock expectation in mypost.',
        })
      );
    }
  }

  private findApiInProject(
    projectId: string,
    targetPath: string,
    method: string,
    targetId?: string
  ): ApiDetail | null {
    if (targetId) {
      const detail = this.fileDB.getApiDetail(projectId, targetId);
      if (detail) return detail;
    }

    const tree = this.fileDB.getProjectTree(projectId);
    const apis = tree.filter((t) => t.target_type === 'api');

    const cleanTarget = this.normalizeUrlPath(targetPath);

    // First try exact method + path match
    for (const item of apis) {
      if (item.method && item.method.toUpperCase() === method) {
        const itemPath = this.normalizeUrlPath(item.url);
        if (itemPath === cleanTarget || this.matchPathPatterns(itemPath, cleanTarget)) {
          const detail = this.fileDB.getApiDetail(projectId, item.target_id);
          if (detail) return detail;
        }
      }
    }

    // Second try path match regardless of method
    for (const item of apis) {
      const itemPath = this.normalizeUrlPath(item.url);
      if (itemPath === cleanTarget || this.matchPathPatterns(itemPath, cleanTarget)) {
        const detail = this.fileDB.getApiDetail(projectId, item.target_id);
        if (detail) return detail;
      }
    }

    return null;
  }

  private normalizeUrlPath(urlStr: string): string {
    if (!urlStr) return '/';
    try {
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        const u = new URL(urlStr);
        return u.pathname.replace(/\/+$/, '') || '/';
      }
    } catch {}
    const pathPart = urlStr.split('?')[0].trim();
    const withLeadingSlash = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    return withLeadingSlash.replace(/\/+$/, '') || '/';
  }

  private matchPathPatterns(pattern: string, actual: string): boolean {
    if (pattern === actual) return true;
    // Replace :param or {param} with regex pattern ([^/]+)
    const regexPattern = pattern
      .replace(/:[a-zA-Z0-9_]+/g, '([^/]+)')
      .replace(/\{[a-zA-Z0-9_]+\}/g, '([^/]+)');
    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(actual);
    } catch {
      return false;
    }
  }

  private sendMockResponse(res: http.ServerResponse, api: ApiDetail): void {
    const examples = api.response?.example || [];
    // Find default example or first example
    const defaultEx = examples.find((ex) => ex.expect?.is_default === 1) || examples[0];

    const statusCode = parseInt(defaultEx?.expect?.code || '200') || 200;
    const contentType = defaultEx?.expect?.content_type || 'application/json';

    res.statusCode = statusCode;
    res.setHeader('Content-Type', `${contentType};charset=utf-8`);

    let outputRaw = '';

    if (defaultEx && defaultEx.raw) {
      const rawText = defaultEx.raw.trim();
      try {
        // Try parsing JSON to evaluate Mockjs rules
        const jsonObj = JSON.parse(rawText);
        const mocked = Mock.mock(jsonObj);
        outputRaw = JSON.stringify(mocked, null, 2);
      } catch {
        // Raw string: evaluate inline Mock strings like @cname
        try {
          outputRaw = Mock.mock(rawText);
        } catch {
          outputRaw = rawText;
        }
      }
    } else {
      // Auto-generate dynamic mock template when no example is defined
      const defaultMockTemplate = {
        code: 0,
        message: 'success',
        api_name: api.name,
        target_id: api.target_id,
        mock_data: {
          'id|+1': 1001,
          name: '@cname',
          email: '@email',
          'status|1': ['active', 'pending', 'completed'],
          created_at: '@datetime',
        },
      };
      outputRaw = JSON.stringify(Mock.mock(defaultMockTemplate), null, 2);
    }

    res.end(outputRaw);
  }
}
