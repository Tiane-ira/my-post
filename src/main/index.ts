import { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage, NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { FileDB } from './fileDB';
import { NetworkEngine } from './network';
import { DocShareServer, DocShareRecord } from './docShareServer';
import { ApiDetail, ApiTreeNode, EnvironmentInfo, GlobalParams, ResponseExample } from '../common/types';
import { MainDocParser } from './docParser';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

app.setName('mypost');
app.setAppUserModelId('com.mypost.desktop');

// Linux / 国产操作系统 (银河麒麟 Kylin V10 / 统信 UOS / Ubuntu / Debian / Fedora) 环境及 AppImage 极速启动与兼容性增强
if (process.platform === 'linux') {
  // 1. 彻底解决 Linux 环境（Wayland/X11、NVIDIA 显卡驱动、虚拟机 VMware/VirtualBox/WSL、国产显卡等）下的 GPU 渲染崩溃及黑屏问题
  // 参考 VS Code、Bruno、Beekeeper Studio 等业界主流开源软件最佳实践：
  // 对于 2D 文本与 API 调试工具，默认禁用硬件加速，使用 CPU 软件渲染（Skia/Cairo），100% 消除黑屏与驱动崩溃
  const forceEnableGpu = process.argv.includes('--enable-gpu') || process.env.MYPOST_ENABLE_GPU === '1';
  if (!forceEnableGpu) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
  }

  // 2. 禁用 Chromium 沙箱 (解决高版本 Ubuntu 24.04 / Debian 12 / 国产系统无 root 账号下 unprivileged user namespace 受限崩溃)
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');

  // 3. 禁用 /dev/shm 共享内存，改走 /tmp (彻底解决 Docker、虚拟机或国产系统无 root 下 /dev/shm 权限受限崩溃问题)
  app.commandLine.appendSwitch('disable-dev-shm-usage');

  // 4. 解决 Linux 启动耗时 20-30 秒卡顿的最核心问题：D-Bus Keyring/密钥环超时
  // Chromium 默认尝试通过 D-Bus 查找 GNOME Keyring / KWallet，国产麒麟或受限环境下若未启动该守护进程，
  // 会硬等待 D-Bus 超时 25 秒才继续启动！强制使用 basic 存储立即秒开！
  app.commandLine.appendSwitch('password-store', 'basic');

  // 5. 禁用 XDG Portal D-Bus 超时检测与音频沙箱 (消除麒麟系统 D-Bus 调用挂起)
  app.commandLine.appendSwitch('disable-features', 'UsePortal,AudioServiceSandbox');

  // 6. 自动适配 Wayland 与 X11 混合环境
  if (!process.argv.some((arg) => arg.startsWith('--ozone-platform'))) {
    app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  }

  // 7. 静音 GTK canberra-gtk-module 缺失告警
  if (process.env.GTK_MODULES) {
    process.env.GTK_MODULES = process.env.GTK_MODULES
      .split(':')
      .filter((m) => !m.includes('canberra'))
      .join(':');
  }
}



// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let fileDB: FileDB;
let docShareServer: DocShareServer;
let tray: Tray | null = null;
let isQuitting = false;
let closeToTray = true;
let hasShownTrayBalloon = false;

function getAppIconPath(): string {
  const candidatePaths = [
    path.join(currentDir, app.isPackaged ? '../dist/icon.png' : '../public/icon.png'),
    path.join(app.getAppPath(), 'dist/icon.png'),
    path.join(app.getAppPath(), 'public/icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(process.resourcesPath, 'public/icon.png'),
    path.join(currentDir, 'icon.png'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(currentDir, '../public/icon.png');
}

function getAppIcon(): NativeImage {
  const iconPath = getAppIconPath();
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      return img;
    }
  }
  return nativeImage.createEmpty();
}

function getTrayIcon(): NativeImage {
  try {
    const icon = getAppIcon();
    if (!icon.isEmpty()) {
      return icon.resize({ width: 32, height: 32, quality: 'best' });
    }
  } catch (e) {
    console.warn('[tray] Failed to resize tray icon:', e);
  }
  return getAppIcon();
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(false);
}

function notifyCloseToTray() {
  if (process.platform === 'win32' && !hasShownTrayBalloon && tray) {
    hasShownTrayBalloon = true;
    try {
      tray.displayBalloon({
        title: 'mypost 已最小化到系统托盘',
        content: '应用仍在后台运行（文档分享服务保持开启），点击托盘图标可重新打开。',
        iconType: 'info',
      });
    } catch {}
  }
}

function createTray() {
  if (tray) return;

  const trayIcon = getTrayIcon();
  tray = new Tray(trayIcon);
  tray.setToolTip('mypost - 专为个人打造的纯本地 API 调试与管理工具');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        showMainWindow();
      },
    },
    {
      label: '最小化到托盘',
      click: () => {
        mainWindow?.hide();
      },
    },
    {
      type: 'separator',
    },
    {
      label: '退出 mypost',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        showMainWindow();
      }
    } else {
      showMainWindow();
    }
  });

  tray.on('double-click', () => {
    showMainWindow();
  });
}

function getIndexPath(): string {
  const candidatePaths = [
    path.join(currentDir, '../dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
    path.join(process.resourcesPath, 'app.asar/dist/index.html'),
    path.join(process.resourcesPath, 'dist/index.html'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(currentDir, '../dist/index.html');
}

function getPreloadPath(): string {
  const candidatePaths = [
    path.join(currentDir, 'preload.js'),
    path.join(app.getAppPath(), 'dist-electron/preload.js'),
    path.join(process.resourcesPath, 'app.asar/dist-electron/preload.js'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(currentDir, 'preload.js');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'mypost',
    backgroundColor: '#121316',
    show: false, // 阻止在页面资源解析与渲染前弹出原生未渲染黑色背景窗口
    icon: getAppIcon(),
    webPreferences: {
      preload: getPreloadPath(),
      spellcheck: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // 平滑展示窗口，防止在 Linux 环境下初次渲染完成前出现原生黑色空窗口
  let isShown = false;
  const triggerShow = () => {
    if (isShown || !mainWindow) return;
    isShown = true;
    mainWindow.show();
  };

  mainWindow.once('ready-to-show', () => {
    triggerShow();
  });

  // 兜底机制：个别 Linux 桌面环境/窗口管理器可能未按时发送 ready-to-show，超时 2.5 秒强制呈现
  setTimeout(() => {
    triggerShow();
  }, 2500);

  // 监听渲染崩溃与网页加载失败，防止异常时无任何终端日志输出导致静默黑屏
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] WebContents did-fail-load: code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] WebContents render-process-gone:', details);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // Remove default menu
  Menu.setApplicationMenu(null);

  // Load URL or File
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(getIndexPath());
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting && closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      notifyCloseToTray();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC Handlers
function setupIPC() {
  fileDB = new FileDB();
  docShareServer = new DocShareServer(fileDB.getUserDataDir());

  // Window Controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

  // App & System Tray Controls
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
  ipcMain.handle('app:getCloseToTray', () => closeToTray);
  ipcMain.handle('app:setCloseToTray', (_e, enabled: boolean) => {
    closeToTray = !!enabled;
    return closeToTray;
  });
  ipcMain.handle('app:writeDebugLog', (_e, text: string) => {
    try {
      const logFile = path.join(process.cwd(), 'runtime_error.log');
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${text}\n\n`);
      console.error(`[debug-log] ${text}`);
    } catch (err) {
      console.error('Failed to write debug log:', err);
    }
  });

  // FileDB - Projects
  ipcMain.handle('db:listProjects', () => fileDB.listProjects());
  ipcMain.handle('db:createProject', (_e, name: string, intro?: string, customPath?: string) =>
    fileDB.createProject(name, intro, customPath)
  );
  ipcMain.handle('db:updateProject', (_e, projectId: string, updates: { name?: string; intro?: string }) =>
    fileDB.updateProject(projectId, updates)
  );
  ipcMain.handle('db:deleteProject', (_e, projectId: string, deleteFiles?: boolean) =>
    fileDB.deleteProject(projectId, deleteFiles)
  );
  ipcMain.handle('db:scanApipostProjects', () => fileDB.scanApipostProjects());
  ipcMain.handle('db:importApipostProject', (_e, projectId: string, customPath?: string) =>
    fileDB.importApipostProject(projectId, customPath)
  );

  // FileDB - Tree & APIs
  ipcMain.handle('db:getProjectTree', (_e, projectId: string) => fileDB.getProjectTree(projectId));
  ipcMain.handle('db:saveProjectTree', (_e, projectId: string, items: ApiTreeNode[]) =>
    fileDB.saveProjectTree(projectId, items)
  );
  ipcMain.handle('db:getApiDetail', (_e, projectId: string, targetId: string) =>
    fileDB.getApiDetail(projectId, targetId)
  );
  ipcMain.handle('db:saveApiDetail', (_e, projectId: string, targetId: string, detail: ApiDetail) =>
    fileDB.saveApiDetail(projectId, targetId, detail)
  );
  ipcMain.handle('db:deleteApi', (_e, projectId: string, targetId: string) =>
    fileDB.deleteApi(projectId, targetId)
  );
  ipcMain.handle('db:clearProjectApis', (_e, projectId: string) =>
    fileDB.clearProjectApis(projectId)
  );
  ipcMain.handle('db:batchImportApis', (_e, projectId: string, apiDetails: ApiDetail[], tree: ApiTreeNode[]) =>
    fileDB.batchImportApis(projectId, apiDetails, tree)
  );
  ipcMain.handle('db:moveApi', (_e, projectId: string, targetId: string, newParentId: string) =>
    fileDB.moveApi(projectId, targetId, newParentId)
  );
  ipcMain.handle('db:saveResponseExample', (_e, projectId: string, targetId: string, example: ResponseExample) =>
    fileDB.saveResponseExample(projectId, targetId, example)
  );

  // FileDB - Environments
  ipcMain.handle('db:getEnvs', (_e, projectId: string) => fileDB.getEnvs(projectId));
  ipcMain.handle('db:saveEnv', (_e, projectId: string, env: EnvironmentInfo) =>
    fileDB.saveEnv(projectId, env)
  );
  ipcMain.handle('db:deleteEnv', (_e, projectId: string, envId: string) =>
    fileDB.deleteEnv(projectId, envId)
  );

  // FileDB - Global Params
  ipcMain.handle('db:getGlobalParams', (_e, projectId: string) => fileDB.getGlobalParams(projectId));
  ipcMain.handle('db:saveGlobalParams', (_e, projectId: string, params: GlobalParams) =>
    fileDB.saveGlobalParams(projectId, params)
  );

  // Network Engine
  const activeNetworkRequests = new Map<string, AbortController>();

  ipcMain.handle(
    'net:sendRequest',
    async (
      _e,
      api: ApiDetail,
      envVars: Record<string, string>,
      globalVars: Record<string, string>,
      preUrl?: string,
      requestId?: string
    ) => {
      let abortController: AbortController | undefined;
      if (requestId) {
        abortController = new AbortController();
        activeNetworkRequests.set(requestId, abortController);
      }
      try {
        return await NetworkEngine.executeRequest(
          api,
          envVars,
          globalVars,
          preUrl,
          abortController?.signal
        );
      } finally {
        if (requestId) {
          activeNetworkRequests.delete(requestId);
        }
      }
    }
  );

  ipcMain.handle('net:cancelRequest', (_e, requestId: string) => {
    const controller = activeNetworkRequests.get(requestId);
    if (controller) {
      controller.abort();
      activeNetworkRequests.delete(requestId);
      return true;
    }
    return false;
  });
  ipcMain.handle('net:fetchDocUrl', async (_e, rawUrl: string) => {
    let targetUrl = (rawUrl || '').trim();
    if (!targetUrl) throw new Error('URL 不能为空');
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `http://${targetUrl}`;
    }
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    const res = await axios.get(targetUrl, {
      responseType: 'text',
      timeout: 25000,
      httpsAgent,
      headers: {
        Accept: 'application/json, application/yaml, text/yaml, text/plain, */*',
        'User-Agent': 'mypost-desktop/1.0',
      },
    });

    let rawData = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    // If response is HTML (e.g. user pasted Swagger UI or Knife4j html page), attempt auto-discovery
    if (typeof rawData === 'string' && (rawData.includes('<html') || rawData.includes('<!DOCTYPE html>'))) {
      try {
        const parsedUrl = new URL(targetUrl);
        const candidates = [
          `${parsedUrl.origin}/v2/api-docs`,
          `${parsedUrl.origin}/v3/api-docs`,
          `${parsedUrl.origin}/api-docs`,
          `${parsedUrl.origin}/swagger.json`,
          `${parsedUrl.origin}/openapi.json`,
          `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/swagger-ui.*|\/doc\.html/i, '')}/v2/api-docs`,
          `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/swagger-ui.*|\/doc\.html/i, '')}/v3/api-docs`,
        ];
        for (const candidate of candidates) {
          try {
            const probeRes = await axios.get(candidate, {
              responseType: 'text',
              timeout: 4000,
              httpsAgent,
              headers: { Accept: 'application/json, */*' },
            });
            const probeText = typeof probeRes.data === 'string' ? probeRes.data : JSON.stringify(probeRes.data);
            if (
              probeText &&
              (probeText.includes('"swagger"') ||
                probeText.includes('"openapi"') ||
                probeText.includes('swagger:') ||
                probeText.includes('openapi:'))
            ) {
              return probeText;
            }
          } catch {}
        }
      } catch {}
    }

    return rawData;
  });
  ipcMain.handle('doc:parseApiDoc', async (_e, rawContent: string) => {
    return MainDocParser.parse(rawContent);
  });

  // Dialogs
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const filePath = res.filePaths[0];
    const fileName = path.basename(filePath);
    return { filePath, fileName };
  });
  ipcMain.handle('dialog:readDocFile', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'API Document (*.json, *.yaml, *.yml)', extensions: ['json', 'yaml', 'yml', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const filePath = res.filePaths[0];
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return { filePath, fileName, content };
  });
  ipcMain.handle('dialog:selectDirectory', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle('dialog:saveFile', async (_e, defaultFilename: string, content: string) => {
    if (!mainWindow) return false;
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, content, 'utf-8');
    return true;
  });
  ipcMain.handle('shell:openPath', (_e, targetPath: string) => shell.openPath(targetPath));
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));

  // LAN Document Share Service
  ipcMain.handle('share:createDocShare', (_e, record: DocShareRecord) => {
    return docShareServer.registerShare(record);
  });
  ipcMain.handle('share:listDocShares', () => docShareServer.listShares());
  ipcMain.handle('share:deleteDocShare', (_e, shareId: string) => docShareServer.deleteShare(shareId));
  ipcMain.handle('share:clearAllDocShares', () => docShareServer.clearAllShares());
  ipcMain.handle('share:getServerInfo', () => docShareServer.getServerInfo());

  // SSE Streaming Engine (Node.js http/https bypasses CORS, preflight & browser limits)
  const activeSseStreams = new Map<string, http.ClientRequest>();

  ipcMain.handle(
    'sse:start',
    (
      event,
      streamId: string,
      options: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }
    ) => {
      try {
        const existing = activeSseStreams.get(streamId);
        if (existing) {
          existing.destroy();
          activeSseStreams.delete(streamId);
        }

        const connect = (targetUrl: string, redirectCount = 0): void => {
          if (redirectCount > 5) {
            event.sender.send(`sse:error:${streamId}`, '重定向次数过多 (Too many redirects)');
            activeSseStreams.delete(streamId);
            return;
          }

          const parsedUrl = new URL(targetUrl);
          const isHttps = parsedUrl.protocol === 'https:';
          const client = isHttps ? https : http;

          const hasUserAgent =
            options.headers &&
            Object.keys(options.headers).some((k) => k.toLowerCase() === 'user-agent');

          const reqHeaders: Record<string, string> = {
            Accept: 'text/event-stream, text/*, */*',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...(!hasUserAgent
              ? {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MyPost/1.0',
                }
              : {}),
            ...(options.headers || {}),
          };

          const req = client.request(
            targetUrl,
            {
              method: options.method || 'GET',
              headers: reqHeaders,
              agent: isHttps
                ? new https.Agent({ keepAlive: true, rejectUnauthorized: false })
                : new http.Agent({ keepAlive: true }),
            },
            (res) => {
              const statusCode = res.statusCode || 0;

              // Handle HTTP Redirects (301, 302, 307, 308)
              if (
                statusCode >= 300 &&
                statusCode < 400 &&
                res.headers.location
              ) {
                const nextUrl = new URL(res.headers.location, targetUrl).toString();
                res.destroy();
                connect(nextUrl, redirectCount + 1);
                return;
              }

              // Handle HTTP Errors
              if (statusCode >= 400) {
                let errBody = '';
                res.on('data', (c: Buffer) => {
                  if (errBody.length < 500) errBody += c.toString('utf-8');
                });
                res.on('end', () => {
                  activeSseStreams.delete(streamId);
                  const suffix = errBody.trim() ? `: ${errBody.trim().slice(0, 150)}` : '';
                  event.sender.send(
                    `sse:error:${streamId}`,
                    `HTTP ${statusCode} ${res.statusMessage || '请求失败'}${suffix}`
                  );
                });
                return;
              }

              event.sender.send(`sse:connected:${streamId}`, {
                statusCode,
                headers: res.headers,
              });

              res.on('data', (chunk: Buffer) => {
                event.sender.send(`sse:chunk:${streamId}`, chunk.toString('utf-8'));
              });

              res.on('end', () => {
                activeSseStreams.delete(streamId);
                event.sender.send(`sse:end:${streamId}`);
              });

              res.on('error', (err: any) => {
                activeSseStreams.delete(streamId);
                event.sender.send(`sse:error:${streamId}`, err.message || 'Stream error');
              });
            }
          );

          req.on('error', (err: any) => {
            activeSseStreams.delete(streamId);
            event.sender.send(`sse:error:${streamId}`, err.message || '网络连接失败');
          });

          if (
            options.body &&
            options.method !== 'GET' &&
            options.method !== 'HEAD'
          ) {
            req.write(options.body);
          }

          req.end();
          activeSseStreams.set(streamId, req);
        };

        connect(options.url, 0);
        return true;
      } catch (err: any) {
        event.sender.send(`sse:error:${streamId}`, err.message || '初始化请求失败');
        return false;
      }
    }
  );

  ipcMain.handle('sse:stop', (_event, streamId: string) => {
    const req = activeSseStreams.get(streamId);
    if (req) {
      req.destroy();
      activeSseStreams.delete(streamId);
    }
    return true;
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();
  createTray();

  // 异步在后台启动文档局域网共享服务，避免阻塞主窗口极速呈现
  docShareServer.start().catch((e) => {
    console.warn('[main] Failed to auto-start DocShareServer in background:', e);
  });

  app.on('activate', () => {
    if (mainWindow) {
      showMainWindow();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  try {
    docShareServer?.stop();
  } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('second-instance', () => {
  showMainWindow();
});
