import { contextBridge, ipcRenderer } from 'electron';
import {
  ApiDetail,
  ApiTreeNode,
  EnvironmentInfo,
  GlobalParams,
  HttpResponseResult,
  ProjectInfo,
  ApipostScannedProject,
  ResponseExample,
  DocShareRecord,
  DocShareItem,
  ShareServerInfo,
} from '../common/types';
import { ParsedApiDocResult } from '../common/importers';

export const apiBridge = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // App & System Tray controls
  quitApp: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  getCloseToTray: (): Promise<boolean> => ipcRenderer.invoke('app:getCloseToTray'),
  setCloseToTray: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('app:setCloseToTray', enabled),

  // Project and FileDB
  listProjects: (): Promise<ProjectInfo[]> => ipcRenderer.invoke('db:listProjects'),
  createProject: (name: string, intro?: string, customPath?: string): Promise<ProjectInfo> =>
    ipcRenderer.invoke('db:createProject', name, intro, customPath),
  scanApipostProjects: (): Promise<ApipostScannedProject[]> =>
    ipcRenderer.invoke('db:scanApipostProjects'),
  importApipostProject: (projectId: string, customPath?: string): Promise<ProjectInfo | null> =>
    ipcRenderer.invoke('db:importApipostProject', projectId, customPath),
  getProjectTree: (projectId: string): Promise<ApiTreeNode[]> =>
    ipcRenderer.invoke('db:getProjectTree', projectId),
  saveProjectTree: (projectId: string, items: ApiTreeNode[]): Promise<boolean> =>
    ipcRenderer.invoke('db:saveProjectTree', projectId, items),
  getApiDetail: (projectId: string, targetId: string): Promise<ApiDetail | null> =>
    ipcRenderer.invoke('db:getApiDetail', projectId, targetId),
  saveApiDetail: (projectId: string, targetId: string, detail: ApiDetail): Promise<boolean> =>
    ipcRenderer.invoke('db:saveApiDetail', projectId, targetId, detail),
  deleteApi: (projectId: string, targetId: string): Promise<boolean> =>
    ipcRenderer.invoke('db:deleteApi', projectId, targetId),
  batchImportApis: (projectId: string, apiDetails: ApiDetail[], tree: ApiTreeNode[]): Promise<boolean> =>
    ipcRenderer.invoke('db:batchImportApis', projectId, apiDetails, tree),
  clearProjectApis: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('db:clearProjectApis', projectId),
  moveApi: (projectId: string, targetId: string, newParentId: string): Promise<boolean> =>
    ipcRenderer.invoke('db:moveApi', projectId, targetId, newParentId),
  saveResponseExample: (projectId: string, targetId: string, example: ResponseExample): Promise<boolean> =>
    ipcRenderer.invoke('db:saveResponseExample', projectId, targetId, example),

  // Environments
  getEnvs: (projectId: string): Promise<EnvironmentInfo[]> =>
    ipcRenderer.invoke('db:getEnvs', projectId),
  saveEnv: (projectId: string, env: EnvironmentInfo): Promise<boolean> =>
    ipcRenderer.invoke('db:saveEnv', projectId, env),
  deleteEnv: (projectId: string, envId: string): Promise<boolean> =>
    ipcRenderer.invoke('db:deleteEnv', projectId, envId),

  // Global Params
  getGlobalParams: (projectId: string): Promise<GlobalParams> =>
    ipcRenderer.invoke('db:getGlobalParams', projectId),
  saveGlobalParams: (projectId: string, params: GlobalParams): Promise<boolean> =>
    ipcRenderer.invoke('db:saveGlobalParams', projectId, params),

  // Network Engine
  sendRequest: (
    api: ApiDetail,
    envVars: Record<string, string>,
    globalVars: Record<string, string>,
    preUrl?: string
  ): Promise<HttpResponseResult> =>
    ipcRenderer.invoke('net:sendRequest', api, envVars, globalVars, preUrl),

  // Network & Doc Fetching
  fetchDocUrl: (url: string): Promise<string> => ipcRenderer.invoke('net:fetchDocUrl', url),
  parseApiDoc: (content: string): Promise<ParsedApiDocResult> =>
    ipcRenderer.invoke('doc:parseApiDoc', content),

  // Dialogs & Utils
  openFileDialog: (): Promise<{ filePath: string; fileName: string } | null> =>
    ipcRenderer.invoke('dialog:openFile'),
  readDocFile: (): Promise<{ filePath: string; fileName: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:readDocFile'),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  saveFile: (defaultPath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('dialog:saveFile', defaultPath, content),
  openPath: (targetPath: string): Promise<boolean> => ipcRenderer.invoke('shell:openPath', targetPath),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),

  // LAN Document Share Service
  createDocShare: (
    record: DocShareRecord
  ): Promise<{ lanUrl: string; localUrl: string; shareId: string }> =>
    ipcRenderer.invoke('share:createDocShare', record),
  listDocShares: (): Promise<DocShareItem[]> => ipcRenderer.invoke('share:listDocShares'),
  deleteDocShare: (shareId: string): Promise<boolean> =>
    ipcRenderer.invoke('share:deleteDocShare', shareId),
  clearAllDocShares: (): Promise<boolean> => ipcRenderer.invoke('share:clearAllDocShares'),
  getShareServerInfo: (): Promise<ShareServerInfo> => ipcRenderer.invoke('share:getServerInfo'),

  // SSE Streaming Engine (Node.js http/https bypasses CORS, preflight & browser limits)
  startSseStream: (
    streamId: string,
    options: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<boolean> => ipcRenderer.invoke('sse:start', streamId, options),
  stopSseStream: (streamId: string): Promise<boolean> => ipcRenderer.invoke('sse:stop', streamId),
  onSseConnected: (
    streamId: string,
    callback: (info: { statusCode: number; headers: any }) => void
  ) => {
    const channel = `sse:connected:${streamId}`;
    const listener = (_e: any, info: any) => callback(info);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onSseChunk: (
    streamId: string,
    callback: (chunk: string) => void
  ) => {
    const channel = `sse:chunk:${streamId}`;
    const listener = (_e: any, chunk: string) => callback(chunk);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onSseEnd: (
    streamId: string,
    callback: () => void
  ) => {
    const channel = `sse:end:${streamId}`;
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onSseError: (
    streamId: string,
    callback: (errorMsg: string) => void
  ) => {
    const channel = `sse:error:${streamId}`;
    const listener = (_e: any, errorMsg: string) => callback(errorMsg);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('mypostAPI', apiBridge);

export type MypostAPI = typeof apiBridge;
