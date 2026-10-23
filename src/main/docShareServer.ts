import http from 'http';
import os from 'os';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { ApiDetail, ApiTreeNode, DocShareItem } from '../common/types';

export interface DocShareRecord {
  shareId: string;
  title: string;
  projectId: string;
  projectName: string;
  scope: 'api' | 'folder' | 'project';
  targetId?: string;
  password?: string;
  createdAt: number;
  expiresAt?: number;
  tree: ApiTreeNode[];
  apis: ApiDetail[];
}

export interface ShareServerInfo {
  port: number;
  primaryIp: string;
  allIps: string[];
  running: boolean;
  baseUrl: string;
}

export class DocShareServer {
  private server: http.Server | null = null;
  private port: number = 30990;
  private isRunning: boolean = false;
  private shares: Map<string, DocShareRecord> = new Map();
  private storageFile: string | null = null;

  constructor(storageDir?: string) {
    if (storageDir) {
      try {
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }
        this.storageFile = path.join(storageDir, 'doc-shares.json');
        this.loadSharesFromDisk();
      } catch (e) {
        console.warn('[DocShareServer] Failed to initialize storage dir:', e);
      }
    }
  }

  private loadSharesFromDisk(): void {
    if (!this.storageFile || !fs.existsSync(this.storageFile)) return;
    try {
      const data = fs.readFileSync(this.storageFile, 'utf-8');
      const list: DocShareRecord[] = JSON.parse(data);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.shareId) {
            this.shares.set(item.shareId, item);
          }
        }
      }
    } catch (e) {
      console.warn('[DocShareServer] Failed to load shares from disk:', e);
    }
  }

  private saveSharesToDisk(): void {
    if (!this.storageFile) return;
    try {
      const list = Array.from(this.shares.values());
      const temp = `${this.storageFile}.${Date.now()}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(list, null, 2), 'utf-8');
      fs.renameSync(temp, this.storageFile);
    } catch (e) {
      console.warn('[DocShareServer] Failed to save shares to disk:', e);
    }
  }

  /**
   * Get all active IPv4 addresses of this machine in the LAN
   */
  public getLanIps(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }

    // Sort to prefer standard 192.168.x.x, 10.x.x.x, 172.x.x.x
    ips.sort((a, b) => {
      if (a.startsWith('192.168.') && !b.startsWith('192.168.')) return -1;
      if (!a.startsWith('192.168.') && b.startsWith('192.168.')) return 1;
      if (a.startsWith('10.') && !b.startsWith('10.')) return -1;
      if (!a.startsWith('10.') && b.startsWith('10.')) return 1;
      return 0;
    });

    return ips.length > 0 ? ips : ['127.0.0.1'];
  }

  public getPrimaryIp(): string {
    const ips = this.getLanIps();
    return ips[0] || '127.0.0.1';
  }

  public getServerInfo(): ShareServerInfo {
    const primaryIp = this.getPrimaryIp();
    return {
      port: this.port,
      primaryIp,
      allIps: this.getLanIps(),
      running: this.isRunning,
      baseUrl: `http://${primaryIp}:${this.port}`,
    };
  }

  public async start(preferredPort: number = 30990): Promise<ShareServerInfo> {
    if (this.isRunning && this.server) {
      return this.getServerInfo();
    }

    const candidatePorts = [preferredPort, 30991, 30992, 30993, 30994, 30995];

    for (const portToTry of candidatePorts) {
      try {
        await this.bindPort(portToTry);
        this.port = portToTry;
        this.isRunning = true;
        console.log(`[DocShareServer] LAN Documentation Server listening on 0.0.0.0:${this.port}`);
        return this.getServerInfo();
      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[DocShareServer] Port ${portToTry} in use, trying next...`);
          continue;
        }
        throw err;
      }
    }

    // Fallback to random free port
    await this.bindPort(0);
    const address = this.server?.address();
    if (address && typeof address === 'object') {
      this.port = address.port;
    }
    this.isRunning = true;
    console.log(`[DocShareServer] LAN Documentation Server listening on fallback port :${this.port}`);
    return this.getServerInfo();
  }

  private bindPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.handleRequest(req, res));
      server.once('error', (err) => reject(err));
      // Bind to 0.0.0.0 to accept connections from any LAN device
      server.listen(port, '0.0.0.0', () => {
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
      console.log('[DocShareServer] LAN Documentation Server stopped.');
    }
  }

  /**
   * Save or update a shared documentation record
   */
  public registerShare(record: DocShareRecord): { lanUrl: string; localUrl: string; shareId: string } {
    this.shares.set(record.shareId, record);
    this.saveSharesToDisk();
    const primaryIp = this.getPrimaryIp();
    const lanUrl = `http://${primaryIp}:${this.port}/share/${record.shareId}`;
    const localUrl = `http://127.0.0.1:${this.port}/share/${record.shareId}`;
    return { lanUrl, localUrl, shareId: record.shareId };
  }

  public getShare(shareId: string): DocShareRecord | undefined {
    return this.shares.get(shareId);
  }

  /**
   * List all shared documentation items with status and active URLs
   */
  public listShares(): DocShareItem[] {
    const primaryIp = this.getPrimaryIp();
    const now = Date.now();
    const results: DocShareItem[] = [];

    for (const record of this.shares.values()) {
      results.push({
        ...record,
        lanUrl: `http://${primaryIp}:${this.port}/share/${record.shareId}`,
        localUrl: `http://127.0.0.1:${this.port}/share/${record.shareId}`,
        apiCount: Array.isArray(record.apis) ? record.apis.length : 0,
        isExpired: Boolean(record.expiresAt && now > record.expiresAt),
      });
    }

    // Sort newest first
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
  }

  /**
   * Revoke/Delete a specific share
   */
  public deleteShare(shareId: string): boolean {
    const existed = this.shares.delete(shareId);
    if (existed) {
      this.saveSharesToDisk();
    }
    return existed;
  }

  /**
   * Clear all shared documentation records
   */
  public clearAllShares(): boolean {
    this.shares.clear();
    this.saveSharesToDisk();
    return true;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';

    // Route: /share/:shareId
    if (pathname.startsWith('/share/')) {
      const shareId = pathname.replace('/share/', '').split('/')[0];
      const record = this.shares.get(shareId);

      if (!record) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(this.renderNotFoundHtml());
        return;
      }

      // Check expiry
      if (record.expiresAt && Date.now() > record.expiresAt) {
        res.statusCode = 410;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(this.renderExpiredHtml());
        return;
      }

      // Check password if set
      const providedPwd = parsedUrl.query.pwd as string | undefined;
      if (record.password && record.password.trim() !== '') {
        if (!providedPwd || providedPwd !== record.password) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(this.renderPasswordPromptHtml(record.title, shareId, Boolean(providedPwd)));
          return;
        }
      }

      // Serve interactive documentation SPA
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(this.renderDocSpaHtml(record));
      return;
    }

    // Default 404
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(this.renderNotFoundHtml());
  }

  private renderDocSpaHtml(record: DocShareRecord): string {
    const serializedData = JSON.stringify({
      shareId: record.shareId,
      title: record.title,
      projectName: record.projectName,
      scope: record.scope,
      targetId: record.targetId || '0',
      createdAt: record.createdAt,
      tree: record.tree || [],
      apis: record.apis || [],
    })
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(record.title)} - mypost 局域网接口文档</title>
  <style>
    :root {
      --bg-body: #111317;
      --bg-sidebar: #171920;
      --bg-card: #1c1f28;
      --bg-hover: #262a36;
      --border: #282d3b;
      --text: #e6e8ec;
      --text-muted: #8b92a4;
      --accent: #ff6b22;
      --accent-hover: #fa5805;
      --code-bg: #13151b;
      --green: #10b981;
      --blue: #3b82f6;
      --purple: #8b5cf6;
      --red: #ef4444;
      --amber: #f59e0b;
    }

    body.light {
      --bg-body: #f8fafc;
      --bg-sidebar: #ffffff;
      --bg-card: #ffffff;
      --bg-hover: #f1f5f9;
      --border: #e2e8f0;
      --text: #1e293b;
      --text-muted: #64748b;
      --code-bg: #f8fafc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
      background: var(--bg-body);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
      font-size: 13px;
    }

    /* Sidebar */
    #sidebar {
      width: 320px;
      min-width: 280px;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 800;
      font-size: 14px;
      color: var(--accent);
    }

    .search-box {
      width: 100%;
      padding: 7px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-box:focus { border-color: var(--accent); }

    .api-tree {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    /* Directory Tree Nodes */
    .folder-group {
      margin-bottom: 2px;
    }

    .folder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text);
      font-weight: 600;
      font-size: 12px;
      user-select: none;
      transition: background 0.15s;
    }
    .folder-header:hover { background: var(--bg-hover); }

    .folder-title-left {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .folder-arrow {
      font-size: 10px;
      color: var(--text-muted);
      width: 12px;
      text-align: center;
    }

    .folder-count {
      font-size: 11px;
      color: var(--text-muted);
      font-family: monospace;
      font-weight: normal;
    }

    .folder-children {
      margin-left: 12px;
      border-left: 1px dashed var(--border);
      padding-left: 4px;
    }

    .api-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 2px;
      transition: all 0.15s;
      color: var(--text);
      user-select: none;
    }
    .api-item:hover { background: var(--bg-hover); }
    .api-item.active {
      background: var(--bg-card);
      border-left: 3px solid var(--accent);
      font-weight: 600;
    }

    .method-badge {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      min-width: 42px;
      text-align: center;
    }
    .method-get { background: rgba(16, 185, 129, 0.15); color: var(--green); }
    .method-post { background: rgba(255, 107, 34, 0.15); color: var(--accent); }
    .method-put { background: rgba(59, 130, 246, 0.15); color: var(--blue); }
    .method-delete { background: rgba(239, 68, 68, 0.15); color: var(--red); }
    .method-patch { background: rgba(139, 92, 246, 0.15); color: var(--purple); }

    .api-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
    }

    /* Main Container */
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: var(--bg-body);
    }

    .top-nav {
      min-height: 52px;
      border-bottom: 1px solid var(--border);
      padding: 8px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-sidebar);
      flex-shrink: 0;
      gap: 12px;
      flex-wrap: wrap;
    }

    .doc-content {
      flex: 1;
      padding: 24px 36px;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
    }

    .doc-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 22px;
      margin-bottom: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .breadcrumb-bar {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .url-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: monospace;
      font-size: 13px;
      margin: 14px 0;
    }

    .url-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .btn {
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text);
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn:hover { background: var(--bg-hover); border-color: var(--accent); }
    .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-success { background: rgba(16, 185, 129, 0.15); color: var(--green); border-color: rgba(16, 185, 129, 0.3); }
    .btn-success:hover { background: rgba(16, 185, 129, 0.25); }

    .table-container {
      margin: 10px 0 16px 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
    }

    th {
      background: rgba(0, 0, 0, 0.2);
      padding: 8px 12px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    body.light th { background: #f1f5f9; }

    td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    tr:last-child td { border-bottom: none; }

    pre code {
      display: block;
      padding: 12px 14px;
      background: var(--code-bg);
      border-radius: 8px;
      border: 1px solid var(--border);
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
      white-space: pre-wrap;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      margin: 16px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text);
    }

    .badge-tag {
      display: inline-block;
      padding: 2px 8px;
      background: rgba(255, 107, 34, 0.15);
      color: var(--accent);
      border: 1px solid rgba(255, 107, 34, 0.3);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-1 { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); }
    .status-2 { background: rgba(245, 158, 11, 0.15); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.3); }
    .status-3 { background: rgba(59, 130, 246, 0.15); color: var(--blue); border: 1px solid rgba(59, 130, 246, 0.3); }
    .status-0 { background: rgba(239, 68, 68, 0.15); color: var(--red); border: 1px solid rgba(239, 68, 68, 0.3); }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 10px 18px;
      background: var(--bg-card);
      border: 1px solid var(--accent);
      color: var(--text);
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      font-size: 12px;
      font-weight: 600;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s ease;
      z-index: 9999;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <span>⚡ mypost</span>
        <span class="badge-tag">局域网文档</span>
      </div>
      <input type="text" id="searchInput" class="search-box" placeholder="搜索目录 / 接口名称 / 路径..." />
    </div>

    <div class="api-tree" id="apiTree"></div>
  </aside>

  <!-- Main View -->
  <main id="main">
    <div class="top-nav">
      <div>
        <strong id="docTitle" style="font-size: 15px;"></strong>
        <span style="margin-left: 8px; font-size: 11px; color: var(--text-muted);" id="docSubtitle"></span>
      </div>

      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button class="btn btn-success" onclick="downloadMarkdownDoc()">📥 保存为 Markdown</button>
      </div>
    </div>

    <div class="doc-content" id="docContent">
      <div id="apiDetailView"></div>
    </div>
  </main>

  <div class="toast" id="toastBox"></div>

  <script>
    var DATA = ${serializedData};
    var currentApiId = DATA.apis[0] ? DATA.apis[0].target_id : null;
    var expandedFolders = new Set();

    (DATA.tree || []).forEach(function(item) {
      if (item.target_type === 'folder') {
        expandedFolders.add(item.target_id);
      }
    });

    document.getElementById('docTitle').innerText = DATA.title;
    document.getElementById('docSubtitle').innerText = DATA.projectName ? '项目: ' + DATA.projectName : '';

    function showToast(msg) {
      var t = document.getElementById('toastBox');
      t.innerText = msg;
      t.className = 'toast show';
      setTimeout(function() { t.className = 'toast'; }, 2000);
    }

    function toggleTheme() {
      document.body.classList.toggle('light');
    }

    function copyToClipboard(text, btn) {
      navigator.clipboard.writeText(text).then(function() {
        if (btn) {
          var orig = btn.innerText;
          btn.innerText = '✓ 已复制';
          setTimeout(function() { btn.innerText = orig; }, 1500);
        } else {
          showToast('已复制到剪贴板');
        }
      });
    }

    function getActiveApi() {
      for (var i = 0; i < DATA.apis.length; i++) {
        if (DATA.apis[i].target_id === currentApiId) return DATA.apis[i];
      }
      return DATA.apis[0] || null;
    }

    function copyActiveUrl(btn) {
      var api = getActiveApi();
      if (api) {
        copyToClipboard(api.request && api.request.url ? api.request.url : (api.url || '/'), btn);
      }
    }

    function copyActiveBody(btn) {
      var api = getActiveApi();
      if (api && api.request && api.request.body && api.request.body.raw) {
        copyToClipboard(api.request.body.raw, btn);
      }
    }

    function copyResponseExample(idx, btn) {
      var api = getActiveApi();
      if (api && api.response && api.response.example && api.response.example[idx]) {
        copyToClipboard(api.response.example[idx].raw || '', btn);
      }
    }

    function getApiBreadcrumbs(apiId) {
      var crumbs = [];
      var curr = null;
      var tree = DATA.tree || [];
      for (var i = 0; i < tree.length; i++) {
        if (tree[i].target_id === apiId) { curr = tree[i]; break; }
      }
      var visited = new Set();
      while (curr && !visited.has(curr.target_id)) {
        visited.add(curr.target_id);
        if (curr.target_type === 'folder') {
          crumbs.unshift(curr.name);
        }
        if (!curr.parent_id || curr.parent_id === '0' || curr.parent_id === DATA.targetId) break;
        var next = null;
        for (var j = 0; j < tree.length; j++) {
          if (tree[j].target_id === curr.parent_id) { next = tree[j]; break; }
        }
        curr = next;
      }
      crumbs.unshift('📁 根目录');
      return crumbs.join(' / ');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function countFolderApis(fId, visited) {
      if (!visited) visited = new Set();
      if (visited.has(fId)) return 0;
      visited.add(fId);
      var count = 0;
      var tree = DATA.tree || [];
      for (var i = 0; i < tree.length; i++) {
        if (tree[i].parent_id === fId) {
          if (tree[i].target_type === 'api') count++;
          else if (tree[i].target_type === 'folder') count += countFolderApis(tree[i].target_id, visited);
        }
      }
      return count;
    }

    function renderSidebar(filter) {
      var container = document.getElementById('apiTree');
      container.innerHTML = '';
      var tree = DATA.tree || [];
      var q = (filter || '').trim().toLowerCase();

      var matchingApiIds = new Set();
      if (q) {
        DATA.apis.forEach(function(api) {
          var name = (api.name || '').toLowerCase();
          var url = ((api.request && api.request.url) || api.url || '').toLowerCase();
          if (name.indexOf(q) !== -1 || url.indexOf(q) !== -1) {
            matchingApiIds.add(api.target_id);
          }
        });

        matchingApiIds.forEach(function(id) {
          var curr = null;
          for (var i = 0; i < tree.length; i++) {
            if (tree[i].target_id === id) { curr = tree[i]; break; }
          }
          while (curr && curr.parent_id && curr.parent_id !== '0') {
            expandedFolders.add(curr.parent_id);
            var next = null;
            for (var j = 0; j < tree.length; j++) {
              if (tree[j].target_id === curr.parent_id) { next = tree[j]; break; }
            }
            curr = next;
          }
        });
      }

      function renderLevel(parentId) {
        var items = [];
        for (var i = 0; i < tree.length; i++) {
          if ((tree[i].parent_id || '0') === parentId) {
            items.push(tree[i]);
          }
        }
        items.sort(function(a, b) { return (a.sort || 0) - (b.sort || 0); });

        var wrap = document.createElement('div');

        items.forEach(function(item) {
          if (item.target_type === 'folder') {
            var isExpanded = expandedFolders.has(item.target_id);
            var count = countFolderApis(item.target_id);

            var folderGroup = document.createElement('div');
            folderGroup.className = 'folder-group';

            var header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML =
              '<div class="folder-title-left">' +
                '<span class="folder-arrow">' + (isExpanded ? '▼' : '▶') + '</span>' +
                '<span>' + (isExpanded ? '📂' : '📁') + '</span>' +
                '<span title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</span>' +
              '</div>' +
              '<span class="folder-count">(' + count + ')</span>';

            header.onclick = function(e) {
              e.stopPropagation();
              if (expandedFolders.has(item.target_id)) {
                expandedFolders.delete(item.target_id);
              } else {
                expandedFolders.add(item.target_id);
              }
              renderSidebar(document.getElementById('searchInput').value);
            };

            folderGroup.appendChild(header);

            if (isExpanded) {
              var childrenWrap = document.createElement('div');
              childrenWrap.className = 'folder-children';
              childrenWrap.appendChild(renderLevel(item.target_id));
              folderGroup.appendChild(childrenWrap);
            }

            wrap.appendChild(folderGroup);
          } else if (item.target_type === 'api') {
            if (q && !matchingApiIds.has(item.target_id)) return;

            var apiRow = document.createElement('div');
            apiRow.className = 'api-item ' + (item.target_id === currentApiId ? 'active' : '');
            var method = (item.method || 'GET').toLowerCase();
            apiRow.innerHTML =
              '<span class="method-badge method-' + method + '">' + (item.method || 'GET').toUpperCase() + '</span>' +
              '<span class="api-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name || '未命名接口') + '</span>';

            apiRow.onclick = function() {
              currentApiId = item.target_id;
              renderSidebar(document.getElementById('searchInput').value);
              renderDetail();
            };

            wrap.appendChild(apiRow);
          }
        });

        return wrap;
      }

      var rootId = (DATA.targetId && DATA.targetId !== '0') ? DATA.targetId : '0';
      var treeDom = renderLevel(rootId);

      if (!treeDom.hasChildNodes() && DATA.apis.length > 0) {
        DATA.apis.forEach(function(api) {
          if (q && !matchingApiIds.has(api.target_id)) return;
          var apiRow = document.createElement('div');
          apiRow.className = 'api-item ' + (api.target_id === currentApiId ? 'active' : '');
          var method = (api.method || 'GET').toLowerCase();
          apiRow.innerHTML =
            '<span class="method-badge method-' + method + '">' + (api.method || 'GET').toUpperCase() + '</span>' +
            '<span class="api-name" title="' + escapeHtml(api.name) + '">' + escapeHtml(api.name || '未命名接口') + '</span>';
          apiRow.onclick = function() {
            currentApiId = api.target_id;
            renderSidebar(document.getElementById('searchInput').value);
            renderDetail();
          };
          container.appendChild(apiRow);
        });
      } else {
        container.appendChild(treeDom);
      }
    }

    function renderDetail() {
      var api = getActiveApi();
      var container = document.getElementById('apiDetailView');

      if (!api) {
        container.innerHTML = '<div class="doc-card" style="text-align: center; color: var(--text-muted); padding: 40px;">暂无接口数据</div>';
        return;
      }

      var method = (api.method || 'GET').toUpperCase();
      var methodClass = (api.method || 'GET').toLowerCase();
      var url = (api.request && api.request.url) ? api.request.url : (api.url || '/');
      var description = api.description || api.mark || api.summary || '暂无详细描述';
      var breadcrumbs = getApiBreadcrumbs(api.target_id);

      var statusHtml = '';
      if (api.status === 1) statusHtml = '<span class="status-badge status-1">🟢 已发布</span>';
      else if (api.status === 2) statusHtml = '<span class="status-badge status-2">🟡 测试中</span>';
      else if (api.status === 3) statusHtml = '<span class="status-badge status-3">🔵 开发中</span>';
      else if (api.status === 0) statusHtml = '<span class="status-badge status-0">🔴 已废弃</span>';
      else statusHtml = '<span class="status-badge status-1">🟢 正常</span>';

      var authText = '无需认证 (No Auth)';
      var auth = api.request && api.request.auth;
      if (auth && auth.type !== 'none' && auth.type !== 'noauth') {
        if (auth.type === 'bearer') authText = 'Bearer Token (' + (auth.bearer && auth.bearer.token ? auth.bearer.token : '{{token}}') + ')';
        else if (auth.type === 'basic') authText = 'Basic Auth (' + (auth.basic && auth.basic.username ? auth.basic.username : 'user') + ')';
        else authText = String(auth.type);
      }

      var pathSource = (api.request && api.request.path && api.request.path.parameter) || (api.request && api.request.restful && api.request.restful.parameter) || [];
      var pathParams = Array.isArray(pathSource) ? pathSource.filter(function(p) { return p.key; }) : [];

      var query = (api.request && api.request.query && api.request.query.parameter) || [];
      query = query.filter(function(q) { return q.key && (q.is_checked === undefined || q.is_checked === 1 || q.is_checked === true); });

      var headers = (api.request && api.request.header && api.request.header.parameter) || [];
      headers = headers.filter(function(h) { return h.key && (h.is_checked === undefined || h.is_checked === 1 || h.is_checked === true); });

      var cookies = (api.request && api.request.cookie && api.request.cookie.parameter) || [];
      cookies = cookies.filter(function(c) { return c.key && (c.is_checked === undefined || c.is_checked === 1 || c.is_checked === true); });

      var bodyMode = (api.request && api.request.body && api.request.body.mode ? api.request.body.mode : 'none').toLowerCase();
      var bodyRaw = (api.request && api.request.body && api.request.body.raw) ? api.request.body.raw : '';

      var html = '';
      html += '<div class="doc-card">';
      html +=   '<div class="breadcrumb-bar">' + escapeHtml(breadcrumbs) + '</div>';
      html +=   '<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 4px;">';
      html +=     '<h1 style="font-size: 20px; font-weight: 800; color: var(--text);">' + escapeHtml(api.name || '未命名接口') + '</h1>';
      html +=     '<div>' + statusHtml + '</div>';
      html +=   '</div>';
      html +=   '<div class="url-bar">';
      html +=     '<span class="method-badge method-' + methodClass + '">' + method + '</span>';
      html +=     '<span class="url-text" id="activeUrl">' + escapeHtml(url) + '</span>';
      html +=     '<button class="btn" onclick="copyActiveUrl(this)">📋 复制路径</button>';
      html +=   '</div>';
      html +=   '<div style="color: var(--text-muted); line-height: 1.6; font-size: 13px; margin-top: 8px;">' + escapeHtml(description) + '</div>';
      html +=   '<div style="margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 12px;">';
      html +=     '<span style="color: var(--text-muted);">认证方式：</span>';
      html +=     '<code style="background: var(--code-bg); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); color: var(--blue);">' + escapeHtml(authText) + '</code>';
      html +=   '</div>';
      html += '</div>';

      // 1. Path Params
      if (pathParams.length > 0) {
        html += '<div class="doc-card">';
        html +=   '<div class="section-title">📍 路径参数 (Path Parameters) (' + pathParams.length + ')</div>';
        html +=   '<div class="table-container">';
        html +=     '<table><thead><tr><th>参数名</th><th>必填</th><th>类型</th><th>示例值</th><th>说明</th></tr></thead><tbody>';
        pathParams.forEach(function(p) {
          html += '<tr>';
          html +=   '<td style="color: var(--accent); font-weight: 600; font-family: monospace;">' + escapeHtml(p.key) + '</td>';
          html +=   '<td>' + ((p.is_required === 1 || p.required) ? '<span style="color: var(--red); font-weight: bold;">是</span>' : '<span style="color: var(--text-muted);">否</span>') + '</td>';
          html +=   '<td style="color: var(--blue); font-family: monospace;">' + escapeHtml(p.data_type || p.type || 'string') + '</td>';
          html +=   '<td style="font-family: monospace;">' + escapeHtml(p.value || '-') + '</td>';
          html +=   '<td>' + escapeHtml(p.description || '-') + '</td>';
          html += '</tr>';
        });
        html +=     '</tbody></table>';
        html +=   '</div>';
        html += '</div>';
      }

      // 2. Query Params
      html += '<div class="doc-card">';
      html +=   '<div class="section-title">🔍 Query 查询参数 (' + query.length + ')</div>';
      if (query.length > 0) {
        html += '<div class="table-container">';
        html +=   '<table><thead><tr><th>参数名</th><th>必填</th><th>类型</th><th>示例值</th><th>说明</th></tr></thead><tbody>';
        query.forEach(function(q) {
          html += '<tr>';
          html +=   '<td style="color: var(--accent); font-weight: 600; font-family: monospace;">' + escapeHtml(q.key) + '</td>';
          html +=   '<td>' + ((q.is_required === 1 || q.required) ? '<span style="color: var(--red); font-weight: bold;">是</span>' : '<span style="color: var(--text-muted);">否</span>') + '</td>';
          html +=   '<td style="color: var(--blue); font-family: monospace;">' + escapeHtml(q.data_type || q.type || 'string') + '</td>';
          html +=   '<td style="font-family: monospace;">' + escapeHtml(q.value || '-') + '</td>';
          html +=   '<td>' + escapeHtml(q.description || '-') + '</td>';
          html += '</tr>';
        });
        html +=   '</tbody></table>';
        html += '</div>';
      } else {
        html += '<div style="color: var(--text-muted); font-size: 12px; padding: 6px 0;">无 Query 参数</div>';
      }
      html += '</div>';

      // 3. Headers
      html += '<div class="doc-card">';
      html +=   '<div class="section-title">📑 Request Headers 请求头 (' + headers.length + ')</div>';
      if (headers.length > 0) {
        html += '<div class="table-container">';
        html +=   '<table><thead><tr><th>头部字段</th><th>必填</th><th>示例值</th><th>说明</th></tr></thead><tbody>';
        headers.forEach(function(h) {
          html += '<tr>';
          html +=   '<td style="color: var(--blue); font-weight: 600; font-family: monospace;">' + escapeHtml(h.key) + '</td>';
          html +=   '<td>' + ((h.is_required === 1 || h.required) ? '<span style="color: var(--red); font-weight: bold;">是</span>' : '<span style="color: var(--text-muted);">否</span>') + '</td>';
          html +=   '<td style="font-family: monospace;">' + escapeHtml(h.value || '-') + '</td>';
          html +=   '<td>' + escapeHtml(h.description || '-') + '</td>';
          html += '</tr>';
        });
        html +=   '</tbody></table>';
        html += '</div>';
      } else {
        html += '<div style="color: var(--text-muted); font-size: 12px; padding: 6px 0;">无特殊请求头</div>';
      }
      html += '</div>';

      // 4. Cookies
      if (cookies.length > 0) {
        html += '<div class="doc-card">';
        html +=   '<div class="section-title">🍪 Cookie 参数 (' + cookies.length + ')</div>';
        html +=   '<div class="table-container">';
        html +=     '<table><thead><tr><th>参数名</th><th>必填</th><th>示例值</th><th>说明</th></tr></thead><tbody>';
        cookies.forEach(function(c) {
          html += '<tr>';
          html +=   '<td style="color: var(--purple); font-weight: 600; font-family: monospace;">' + escapeHtml(c.key) + '</td>';
          html +=   '<td>' + ((c.is_required === 1 || c.required) ? '<span style="color: var(--red); font-weight: bold;">是</span>' : '<span style="color: var(--text-muted);">否</span>') + '</td>';
          html +=   '<td style="font-family: monospace;">' + escapeHtml(c.value || '-') + '</td>';
          html +=   '<td>' + escapeHtml(c.description || '-') + '</td>';
          html += '</tr>';
        });
        html +=     '</tbody></table>';
        html +=   '</div>';
        html += '</div>';
      }

      // 5. Body
      html += '<div class="doc-card">';
      html +=   '<div style="display: flex; justify-content: space-between; align-items: center;">';
      html +=     '<div class="section-title" style="margin: 0;">📦 Request Body 请求体</div>';
      html +=     '<span class="badge-tag" style="text-transform: uppercase;">' + escapeHtml(bodyMode) + '</span>';
      html +=   '</div>';

      if (bodyMode === 'json' || bodyMode === 'raw') {
        var formatted = bodyRaw;
        try { formatted = JSON.stringify(JSON.parse(bodyRaw), null, 2); } catch (_) {}
        html += '<div style="margin-top: 12px; position: relative;">';
        html +=   '<pre><code>' + escapeHtml(formatted || '{}') + '</code></pre>';
        html +=   '<button class="btn" style="position: absolute; right: 10px; top: 10px;" onclick="copyActiveBody(this)">📋 复制</button>';
        html += '</div>';
      } else if (bodyMode === 'form-data' || bodyMode === 'urlencoded') {
        var items = bodyMode === 'form-data' ? (api.request && api.request.body && api.request.body.parameter) : (api.request && api.request.body && api.request.body.urlencoded);
        items = Array.isArray(items) ? items.filter(function(f) { return f.key; }) : [];
        if (items.length > 0) {
          html += '<div class="table-container">';
          html +=   '<table><thead><tr><th>参数名</th><th>类型</th><th>必填</th><th>示例值</th><th>说明</th></tr></thead><tbody>';
          items.forEach(function(f) {
            var isFile = f.type === 'file' || f.data_type === 'file';
            var fileDisplay = isFile ? (f.file_name || f.file_path || f.value || '未选择文件') : (f.value || '-');
            html += '<tr>';
            html +=   '<td style="color: var(--accent); font-weight: 600; font-family: monospace;">' + escapeHtml(f.key) + '</td>';
            html +=   '<td style="color: var(--blue); font-family: monospace;">' + escapeHtml(f.type || 'text') + '</td>';
            html +=   '<td>' + ((f.is_required === 1 || f.required) ? '<span style="color: var(--red); font-weight: bold;">是</span>' : '<span style="color: var(--text-muted);">否</span>') + '</td>';
            html +=   '<td style="font-family: monospace;">' + escapeHtml(fileDisplay) + '</td>';
            html +=   '<td>' + escapeHtml(f.description || '-') + '</td>';
            html += '</tr>';
          });
          html +=   '</tbody></table>';
          html += '</div>';
        } else {
          html += '<div style="color: var(--text-muted); font-size: 12px; margin-top: 10px;">未配置表单参数</div>';
        }
      } else {
        html += '<div style="color: var(--text-muted); font-size: 12px; margin-top: 10px;">无需请求体 (None)</div>';
      }
      html += '</div>';

      // 6. Responses
      var examples = (api.response && api.response.example) || [];
      html += '<div class="doc-card">';
      html +=   '<div class="section-title">🎯 Response 响应示例 (' + examples.length + ')</div>';
      if (examples.length > 0) {
        examples.forEach(function(ex, idx) {
          var exBody = ex.raw || '';
          try { exBody = JSON.stringify(JSON.parse(exBody), null, 2); } catch (_) {}
          var code = (ex.expect && ex.expect.code) || ex.code || 200;
          var exHeaders = Array.isArray(ex.header) ? ex.header.filter(function(h) { return h.key; }) : [];

          html += '<div style="margin-top: 14px; border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: var(--code-bg);">';
          html +=   '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
          html +=     '<div style="display: flex; gap: 8px; align-items: center;">';
          html +=       '<span style="font-weight: 700; color: var(--green); font-family: monospace;">[HTTP ' + code + ']</span>';
          html +=       '<span style="font-weight: 600;">' + escapeHtml(ex.name || '默认响应') + '</span>';
          html +=     '</div>';
          html +=     '<button class="btn" onclick="copyResponseExample(' + idx + ', this)">📋 复制响应</button>';
          html +=   '</div>';

          if (exHeaders.length > 0) {
            html += '<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">响应头：</div>';
            html += '<div style="font-family: monospace; font-size: 11px; margin-bottom: 8px; color: var(--text-muted);">';
            exHeaders.forEach(function(h) {
              html += '<div>• ' + escapeHtml(h.key) + ': ' + escapeHtml(h.value || '-') + '</div>';
            });
            html += '</div>';
          }

          html +=   '<pre style="margin: 0;"><code>' + escapeHtml(exBody || '无返回数据') + '</code></pre>';
          html += '</div>';
        });
      } else {
        html += '<div style="color: var(--text-muted); font-size: 12px; padding: 6px 0;">暂无响应示例</div>';
      }
      html += '</div>';

      container.innerHTML = html;
    }

    function buildCompleteMarkdown() {
      var B = String.fromCharCode(96);
      var B3 = B + B + B;
      var lines = [];

      lines.push('# ' + DATA.title);
      lines.push('');
      lines.push('> 导出自 **mypost** API 协同与管理工具');
      lines.push('');
      if (DATA.projectName) lines.push('- **所属项目**：' + B + DATA.projectName + B);
      lines.push('- **接口总数**：' + B + DATA.apis.length + B + ' 个');
      lines.push('- **导出时间**：' + B + new Date().toLocaleString() + B);
      lines.push('');

      // TOC
      lines.push('## 目录大纲');
      lines.push('');
      var visited = new Set();
      var tree = DATA.tree || [];

      function renderToc(parentId, depth) {
        var items = [];
        for (var i = 0; i < tree.length; i++) {
          if ((tree[i].parent_id || '0') === parentId) items.push(tree[i]);
        }
        items.forEach(function(item) {
          if (visited.has(item.target_id)) return;
          visited.add(item.target_id);
          var indent = '';
          for (var d = 0; d < depth; d++) indent += '  ';
          if (item.target_type === 'folder') {
            lines.push(indent + '- 📁 **' + item.name + '**');
            renderToc(item.target_id, depth + 1);
          } else {
            lines.push(indent + '- ' + B + (item.method || 'API') + B + ' [' + item.name + '](#' + encodeURIComponent(item.name) + ') ' + B + (item.url || '') + B);
          }
        });
      }

      var rootId = (DATA.targetId && DATA.targetId !== '0') ? DATA.targetId : '0';
      renderToc(rootId, 0);

      tree.forEach(function(item) {
        if (!visited.has(item.target_id)) {
          visited.add(item.target_id);
          if (item.target_type === 'folder') lines.push('- 📁 **' + item.name + '**');
          else lines.push('- ' + B + (item.method || 'API') + B + ' [' + item.name + '](#' + encodeURIComponent(item.name) + ') ' + B + (item.url || '') + B);
        }
      });

      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## 接口详细说明');
      lines.push('');

      DATA.apis.forEach(function(api) {
        var method = (api.method || 'GET').toUpperCase();
        lines.push('### ' + (api.name || '未命名接口'));
        lines.push('');
        lines.push('- **请求方法**：' + B + method + B);
        lines.push('- **接口路径**：' + B + ((api.request && api.request.url) ? api.request.url : (api.url || '/')) + B);
        if (api.status !== undefined) {
          var st = api.status === 1 ? '🟢 已发布' : api.status === 2 ? '🟡 测试中' : api.status === 3 ? '🔵 开发中' : '🔴 已废弃';
          lines.push('- **接口状态**：' + st);
        }
        lines.push('- **所属目录**：' + B + getApiBreadcrumbs(api.target_id) + B);
        if (api.description) lines.push('- **接口说明**：' + api.description);
        lines.push('');

        // Path
        var pSource = (api.request && api.request.path && api.request.path.parameter) || (api.request && api.request.restful && api.request.restful.parameter) || [];
        var pParams = Array.isArray(pSource) ? pSource.filter(function(p) { return p.key; }) : [];
        if (pParams.length > 0) {
          lines.push('#### 路径参数 (Path Parameters)');
          lines.push('');
          lines.push('| 参数名 | 必填 | 类型 | 示例值 | 说明 |');
          lines.push('| :--- | :--- | :--- | :--- | :--- |');
          pParams.forEach(function(p) {
            lines.push('| ' + p.key + ' | ' + (p.is_required === 1 ? '是' : '否') + ' | ' + (p.data_type || 'string') + ' | ' + (p.value || '-') + ' | ' + (p.description || '-') + ' |');
          });
          lines.push('');
        }

        // Query
        var query = (api.request && api.request.query && api.request.query.parameter) || [];
        query = query.filter(function(q) { return q.key && (q.is_checked === undefined || q.is_checked === 1 || q.is_checked === true); });
        lines.push('#### Query 参数');
        lines.push('');
        if (query.length > 0) {
          lines.push('| 参数名 | 必填 | 类型 | 示例值 | 说明 |');
          lines.push('| :--- | :--- | :--- | :--- | :--- |');
          query.forEach(function(q) {
            lines.push('| ' + q.key + ' | ' + (q.is_required === 1 ? '是' : '否') + ' | ' + (q.data_type || 'string') + ' | ' + (q.value || '-') + ' | ' + (q.description || '-') + ' |');
          });
          lines.push('');
        } else {
          lines.push('无 Query 参数');
          lines.push('');
        }

        // Headers
        var headers = (api.request && api.request.header && api.request.header.parameter) || [];
        headers = headers.filter(function(h) { return h.key && (h.is_checked === undefined || h.is_checked === 1 || h.is_checked === true); });
        lines.push('#### 请求头 (Headers)');
        lines.push('');
        if (headers.length > 0) {
          lines.push('| 头部字段 | 必填 | 示例值 | 说明 |');
          lines.push('| :--- | :--- | :--- | :--- |');
          headers.forEach(function(h) {
            lines.push('| ' + h.key + ' | ' + (h.is_required === 1 ? '是' : '否') + ' | ' + (h.value || '-') + ' | ' + (h.description || '-') + ' |');
          });
          lines.push('');
        } else {
          lines.push('无特殊请求头');
          lines.push('');
        }

        // Body
        lines.push('#### 请求体 (Body)');
        lines.push('');
        var bMode = (api.request && api.request.body && api.request.body.mode ? api.request.body.mode : 'none').toLowerCase();
        lines.push('- **数据格式**：' + B + bMode + B);
        lines.push('');
        if (bMode === 'json' && api.request && api.request.body && api.request.body.raw) {
          lines.push(B3 + 'json');
          try {
            lines.push(JSON.stringify(JSON.parse(api.request.body.raw), null, 2));
          } catch (_) {
            lines.push(api.request.body.raw);
          }
          lines.push(B3);
          lines.push('');
        } else if (bMode === 'form-data' || bMode === 'urlencoded') {
          var items = bMode === 'form-data' ? (api.request && api.request.body && api.request.body.parameter) : (api.request && api.request.body && api.request.body.urlencoded);
          items = Array.isArray(items) ? items.filter(function(f) { return f.key; }) : [];
          if (items.length > 0) {
            lines.push('| 参数名 | 类型 | 必填 | 示例值 | 说明 |');
            lines.push('| :--- | :--- | :--- | :--- | :--- |');
            items.forEach(function(f) {
              var isFile = f.type === 'file' || f.data_type === 'file';
              var fileDisplay = isFile ? (f.file_name || f.file_path || f.value || '未选择文件') : (f.value || '-');
              lines.push('| ' + f.key + ' | ' + (f.type || 'text') + ' | ' + (f.is_required === 1 ? '是' : '否') + ' | ' + fileDisplay + ' | ' + (f.description || '-') + ' |');
            });
            lines.push('');
          }
        }

        // Responses
        lines.push('#### 响应示例');
        lines.push('');
        var exs = (api.response && api.response.example) || [];
        if (exs.length > 0) {
          exs.forEach(function(ex) {
            var code = (ex.expect && ex.expect.code) || ex.code || 200;
            lines.push('##### ' + (ex.name || '默认响应') + ' (HTTP ' + code + ')');
            lines.push('');
            lines.push(B3 + 'json');
            try {
              lines.push(JSON.stringify(JSON.parse(ex.raw), null, 2));
            } catch (_) {
              lines.push(ex.raw || '{}');
            }
            lines.push(B3);
            lines.push('');
          });
        } else {
          lines.push('暂无响应示例');
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      });

      return lines.join(String.fromCharCode(10));
    }

    function downloadMarkdownDoc() {
      var md = buildCompleteMarkdown();
      var filename = (DATA.title || '接口文档').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5\-\.]/g, '_') + '.md';
      var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown 文档下载成功: ' + filename);
    }

    function copyFullMarkdownDoc(btn) {
      var md = buildCompleteMarkdown();
      copyToClipboard(md, btn);
      showToast('已复制完整 Markdown 文档内容！');
    }

    document.getElementById('searchInput').addEventListener('input', function(e) {
      renderSidebar(e.target.value);
    });

    // Initialize
    renderSidebar();
    renderDetail();
  </script>
</body>
</html>`;
  }

  private renderPasswordPromptHtml(title: string, shareId: string, hasError: boolean): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>输入访问密码 - mypost</title>
  <style>
    body {
      background: #111317;
      color: #e6e8ec;
      font-family: -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .box {
      background: #1c1f28;
      border: 1px solid #282d3b;
      padding: 32px;
      border-radius: 12px;
      width: 360px;
      text-align: center;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    }
    h2 { font-size: 18px; margin-bottom: 8px; color: #fff; }
    p { font-size: 12px; color: #8b92a4; margin-bottom: 20px; }
    input {
      width: 100%;
      padding: 10px 14px;
      background: #13151b;
      border: 1px solid #282d3b;
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      margin-bottom: 16px;
      box-sizing: border-box;
      outline: none;
    }
    input:focus { border-color: #ff6b22; }
    button {
      width: 100%;
      padding: 10px;
      background: #ff6b22;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { background: #fa5805; }
    .err { color: #ef4444; font-size: 12px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🔒 文档受密码保护</h2>
    <p>${escapeHtml(title)}</p>
    ${hasError ? '<div class="err">密码错误，请重新输入</div>' : ''}
    <form method="GET" action="/share/${escapeHtml(shareId)}">
      <input type="password" name="pwd" placeholder="请输入文档访问密码" autofocus required />
      <button type="submit">进入文档</button>
    </form>
  </div>
</body>
</html>`;
  }

  private renderNotFoundHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>404 - 分享文档不存在</title>
  <style>
    body { background: #111317; color: #8b92a4; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; }
    h1 { font-size: 48px; color: #ff6b22; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>404</h1>
    <p>该接口文档分享已被取消或链接不存在</p>
  </div>
</body>
</html>`;
  }

  private renderExpiredHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>410 - 分享链接已过期</title>
  <style>
    body { background: #111317; color: #8b92a4; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; }
    h1 { font-size: 48px; color: #ef4444; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>410</h1>
    <p>此接口文档分享链接已超过有效期，请联系分享者重新生成</p>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
