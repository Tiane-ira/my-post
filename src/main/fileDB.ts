import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { app } from 'electron';
import { ApiDetail, ApiTreeNode, EnvironmentInfo, GlobalParams, ProjectInfo, ApipostScannedProject, ResponseExample, HttpMethod } from '../common/types';

export class FileDB {
  private userDataDir: string;
  private registryFile: string;

  constructor(customUserDataDir?: string) {
    if (customUserDataDir) {
      this.userDataDir = customUserDataDir;
    } else {
      try {
        this.userDataDir = (typeof app !== 'undefined' && app?.getPath)
          ? app.getPath('userData')
          : path.join(process.cwd(), '.mypost-data');
      } catch {
        this.userDataDir = path.join(process.cwd(), '.mypost-data');
      }
    }
    this.registryFile = path.join(this.userDataDir, 'offline-projects.json');
    this.ensureDir(this.userDataDir);
    this.ensureRegistry();
  }

  public getUserDataDir(): string {
    return this.userDataDir;
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private safeReadJson<T>(filePath: string, fallback: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch (e) {
      console.error(`Failed to read JSON at ${filePath}:`, e);
    }
    return fallback;
  }

  private atomicWriteJson(filePath: string, data: any): void {
    this.ensureDir(path.dirname(filePath));
    const tempFile = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const str = JSON.stringify(data, null, 2);
    try {
      fs.writeFileSync(tempFile, str, 'utf-8');
      try {
        fs.renameSync(tempFile, filePath);
      } catch (err: any) {
        // Fallback for Windows file-locking (EBUSY/EPERM)
        if (err.code === 'EPERM' || err.code === 'EBUSY') {
          fs.writeFileSync(filePath, str, 'utf-8');
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch {}
        } else {
          throw err;
        }
      }
    } catch {
      // Direct write fallback
      fs.writeFileSync(filePath, str, 'utf-8');
    }
  }

  private ensureRegistry(): void {
    if (!fs.existsSync(this.registryFile)) {
      // Check if Apipost official registry exists in AppData
      try {
        if (typeof app !== 'undefined' && app?.getPath) {
          const officialApipostRegistry = path.join(app.getPath('appData'), 'Apipost单机版', 'offline-projects.json');
          if (fs.existsSync(officialApipostRegistry)) {
            const content = fs.readFileSync(officialApipostRegistry, 'utf-8');
            fs.writeFileSync(this.registryFile, content, 'utf-8');
            console.log('[FileDB] Imported existing offline projects registry from:', officialApipostRegistry);
            return;
          }
        }
      } catch (e) {
        console.warn('[FileDB] Failed to auto-copy offline registry:', e);
      }
      this.atomicWriteJson(this.registryFile, []);
    }
  }

  public listProjects(): ProjectInfo[] {
    const list = this.safeReadJson<any[]>(this.registryFile, []);
    const projects: ProjectInfo[] = [];

    for (const item of list) {
      const projDir = item.path || path.join(this.userDataDir, 'offline-data', item.project_id);
      const projJsonPath = path.join(projDir, 'project.json');
      const meta = this.safeReadJson<any>(projJsonPath, null);
      if (meta) {
        projects.push({
          project_id: item.project_id,
          name: meta.name || '未命名项目',
          intro: meta.intro || '',
          path: projDir,
          created_at: meta.created_at || item.created_at || new Date().toISOString(),
          updated_at: meta.updated_at || new Date().toISOString(),
        });
      } else {
        projects.push({
          project_id: item.project_id,
          name: item.name || '未命名项目',
          intro: '',
          path: projDir,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // If no projects exist, initialize default demo project
    if (projects.length === 0) {
      const defaultProj = this.createProject('我的默认项目', 'mypost API 协同与管理示例项目');
      projects.push(defaultProj);
    }

    return projects;
  }

  public getProjectPath(projectId: string): string {
    const list = this.safeReadJson<any[]>(this.registryFile, []);
    const item = list.find((p) => p.project_id === projectId);
    if (item && item.path) return item.path;
    return path.join(this.userDataDir, 'offline-data', projectId);
  }

  public createProject(name: string, intro: string = '', customPath?: string): ProjectInfo {
    const projectId = crypto.randomBytes(6).toString('hex');
    const projDir = customPath || path.join(this.userDataDir, 'offline-data', projectId);
    this.ensureDir(projDir);
    this.ensureDir(path.join(projDir, 'apis'));
    this.ensureDir(path.join(projDir, 'envs'));
    this.ensureDir(path.join(projDir, 'settings'));

    const now = new Date().toISOString();
    const projectMeta = {
      project_id: projectId,
      name,
      intro,
      created_at: now,
      updated_at: now,
    };
    this.atomicWriteJson(path.join(projDir, 'project.json'), projectMeta);

    // Initial Tree: clean and empty
    const treeItems: ApiTreeNode[] = [];
    this.atomicWriteJson(path.join(projDir, 'apis', 'index.json'), {
      project_id: projectId,
      items: treeItems,
    });

    // Initial Envs: clean default environment
    const defaultEnvId = 'env-default';
    const envsIndex = {
      list: [
        { env_id: defaultEnvId, name: '默认环境', pre_url: '' },
      ],
    };
    this.atomicWriteJson(path.join(projDir, 'envs', 'index.json'), envsIndex);
    this.atomicWriteJson(path.join(projDir, 'envs', `${defaultEnvId}.json`), {
      env_id: defaultEnvId,
      name: '默认环境',
      pre_url: '',
      list: [],
    });

    // Initial Global Params: clean empty
    const globalParams: GlobalParams = {
      header: [],
      query: [],
      body: [],
      vars: [],
    };
    this.atomicWriteJson(path.join(projDir, 'global_params.json'), globalParams);

    // Update Registry
    const list = this.safeReadJson<any[]>(this.registryFile, []);
    list.unshift({
      project_id: projectId,
      path: projDir,
      created_at: now,
    });
    this.atomicWriteJson(this.registryFile, list);

    return {
      project_id: projectId,
      name,
      intro,
      path: projDir,
      created_at: now,
      updated_at: now,
    };
  }

  public updateProject(
    projectId: string,
    updates: { name?: string; intro?: string }
  ): ProjectInfo | null {
    const projDir = this.getProjectPath(projectId);
    const projJsonPath = path.join(projDir, 'project.json');
    let meta = this.safeReadJson<any>(projJsonPath, null);

    const now = new Date().toISOString();
    if (!meta) {
      meta = {
        project_id: projectId,
        name: '未命名项目',
        intro: '',
        created_at: now,
        updated_at: now,
      };
    }

    if (typeof updates.name === 'string' && updates.name.trim()) {
      meta.name = updates.name.trim();
    }
    if (typeof updates.intro === 'string') {
      meta.intro = updates.intro.trim();
    }
    meta.updated_at = now;

    this.atomicWriteJson(projJsonPath, meta);

    // Also update registry file item if present
    const list = this.safeReadJson<any[]>(this.registryFile, []);
    const regItem = list.find((p) => p.project_id === projectId);
    if (regItem) {
      regItem.name = meta.name;
      regItem.updated_at = now;
      this.atomicWriteJson(this.registryFile, list);
    }

    return {
      project_id: projectId,
      name: meta.name,
      intro: meta.intro,
      path: projDir,
      created_at: meta.created_at || now,
      updated_at: meta.updated_at || now,
    };
  }

  public deleteProject(projectId: string, deleteFiles: boolean = false): boolean {
    const list = this.safeReadJson<any[]>(this.registryFile, []);
    const regIndex = list.findIndex((p) => p.project_id === projectId);
    const targetItem = regIndex !== -1 ? list[regIndex] : null;

    const projDir = targetItem?.path || path.join(this.userDataDir, 'offline-data', projectId);

    if (regIndex !== -1) {
      list.splice(regIndex, 1);
      this.atomicWriteJson(this.registryFile, list);
    }

    if (deleteFiles && projDir) {
      try {
        const resolvedPath = path.resolve(projDir);
        const resolvedUserData = path.resolve(this.userDataDir);
        const isSubDirOfUserData = resolvedPath.startsWith(resolvedUserData);
        const projJsonPath = path.join(resolvedPath, 'project.json');

        // Only delete on disk if path exists and has project.json or is inside userDataDir to avoid accidental deletion
        if (fs.existsSync(resolvedPath) && (fs.existsSync(projJsonPath) || isSubDirOfUserData)) {
          fs.rmSync(resolvedPath, { recursive: true, force: true });
        }
      } catch (err) {
        console.warn(`[FileDB] Failed to delete project files at ${projDir}:`, err);
      }
    }

    return true;
  }

  public getProjectTree(projectId: string): ApiTreeNode[] {
    const projDir = this.getProjectPath(projectId);
    const treeFile = path.join(projDir, 'apis', 'index.json');
    const data = this.safeReadJson<any>(treeFile, { items: [] });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  public saveProjectTree(projectId: string, items: ApiTreeNode[]): boolean {
    const projDir = this.getProjectPath(projectId);
    const treeFile = path.join(projDir, 'apis', 'index.json');
    this.atomicWriteJson(treeFile, { project_id: projectId, items });
    return true;
  }

  public getApiDetail(projectId: string, targetId: string): ApiDetail | null {
    const projDir = this.getProjectPath(projectId);
    const apiFile = path.join(projDir, 'apis', `${targetId}.json`);
    const raw = this.safeReadJson<any>(apiFile, null);
    if (!raw) return null;

    // Support nested data structures if stored inside raw.data
    const reqSource = raw.request || raw.data?.request || {};
    const resSource = raw.response || raw.data?.response || {};

    const pathSource = reqSource.path || reqSource.restful || { parameter: [] };
    const pathParams = Array.isArray(pathSource)
      ? pathSource
      : Array.isArray(pathSource.parameter)
      ? pathSource.parameter
      : [];

    const querySource = reqSource.query || { parameter: [] };
    const queryParams = Array.isArray(querySource)
      ? querySource
      : Array.isArray(querySource.parameter)
      ? querySource.parameter
      : [];

    const headerSource = reqSource.header || { parameter: [] };
    const headerParams = Array.isArray(headerSource)
      ? headerSource
      : Array.isArray(headerSource.parameter)
      ? headerSource.parameter
      : [];

    const cookieSource = reqSource.cookie || { parameter: [] };
    const cookieParams = Array.isArray(cookieSource)
      ? cookieSource
      : Array.isArray(cookieSource.parameter)
      ? cookieSource.parameter
      : [];

    const bodySource = reqSource.body || { mode: 'none' };
    const bodyMode = bodySource.mode || 'none';
    const bodyRawType = bodySource.raw_type || (bodyMode === 'json' ? 'json' : 'json');

    return {
      ...raw,
      target_id: raw.target_id || targetId,
      parent_id: raw.parent_id || '0',
      project_id: raw.project_id || projectId,
      target_type: raw.target_type || 'api',
      name: raw.name || '未命名接口',
      method: (raw.method || 'GET').toUpperCase() as HttpMethod,
      url: raw.url || '',
      sort: raw.sort || 1000,
      status: raw.status ?? 1,
      request: {
        query: {
          parameter: queryParams,
          query_add_equal: querySource.query_add_equal ?? 1,
        },
        path: {
          parameter: pathParams,
        },
        header: {
          parameter: headerParams,
        },
        cookie: {
          parameter: cookieParams,
        },
        body: {
          mode: bodyMode,
          raw_type: bodyRawType,
          raw: bodySource.raw || '',
          parameter: Array.isArray(bodySource.parameter) ? bodySource.parameter : [],
          urlencoded: Array.isArray(bodySource.urlencoded) ? bodySource.urlencoded : [],
        },
        auth: reqSource.auth || { type: 'none' },
        pre_tasks: Array.isArray(reqSource.pre_tasks) ? reqSource.pre_tasks : [],
        post_tasks: Array.isArray(reqSource.post_tasks) ? reqSource.post_tasks : [],
      },
      response: {
        example: Array.isArray(resSource.example) ? resSource.example : [],
        is_check_result: resSource.is_check_result ?? 1,
      },
      websocket: raw.websocket || raw.data?.websocket,
    };
  }

  public saveApiDetail(projectId: string, targetId: string, detail: ApiDetail): boolean {
    const projDir = this.getProjectPath(projectId);
    const apiFile = path.join(projDir, 'apis', `${targetId}.json`);
    const existing = this.safeReadJson<any>(apiFile, {});

    // Maintain nested .data wrapper compatibility if original had it
    let toSave: any = { ...existing, ...detail };
    if (detail.websocket) {
      toSave.websocket = detail.websocket;
    }
    if (existing.data || !existing.request) {
      toSave.data = {
        ...(existing.data || {}),
        ...(detail.websocket ? { websocket: detail.websocket } : {}),
        request: {
          ...(existing.data?.request || {}),
          ...detail.request,
          restful: detail.request.path, // Compatible restful format for path parameters
        },
        response: {
          ...(existing.data?.response || {}),
          ...detail.response,
        },
      };
    }
    this.atomicWriteJson(apiFile, toSave);

    // Ensure it exists in tree
    const tree = this.getProjectTree(projectId);
    const existingIndex = tree.findIndex((t) => t.target_id === targetId);
    const now = new Date().toISOString();
    if (existingIndex >= 0) {
      tree[existingIndex] = {
        ...tree[existingIndex],
        name: detail.name,
        method: detail.method,
        url: detail.url,
        updated_at: now,
      };
      this.saveProjectTree(projectId, tree);
    } else {
      tree.push({
        target_id: targetId,
        parent_id: detail.parent_id || '0',
        target_type: detail.target_type || 'api',
        name: detail.name,
        method: detail.method,
        url: detail.url,
        sort: detail.sort || (tree.length + 1) * 1000,
        status: detail.status ?? 1,
        created_at: now,
        updated_at: now,
      });
      this.saveProjectTree(projectId, tree);
    }
    return true;
  }

  public batchImportApis(projectId: string, apiDetails: ApiDetail[], tree: ApiTreeNode[]): boolean {
    const projDir = this.getProjectPath(projectId);
    const apisDir = path.join(projDir, 'apis');
    this.ensureDir(apisDir);

    for (const detail of apiDetails) {
      const apiFile = path.join(apisDir, `${detail.target_id}.json`);
      const existing = this.safeReadJson<any>(apiFile, {});
      let toSave: any = { ...existing, ...detail };
      if (existing.data || !existing.request) {
        toSave.data = {
          ...(existing.data || {}),
          request: {
            ...(existing.data?.request || {}),
            ...detail.request,
            restful: detail.request?.path,
          },
          response: {
            ...(existing.data?.response || {}),
            ...detail.response,
          },
        };
      }
      this.atomicWriteJson(apiFile, toSave);
    }

    this.saveProjectTree(projectId, tree);
    return true;
  }

  public deleteApi(projectId: string, targetId: string): boolean {
    const projDir = this.getProjectPath(projectId);
    const tree = this.getProjectTree(projectId);

    // Recursively collect targetId and all its descendant IDs
    const toDeleteIds = new Set<string>();
    toDeleteIds.add(targetId);

    let changed = true;
    while (changed) {
      changed = false;
      for (const item of tree) {
        if (item.parent_id && toDeleteIds.has(item.parent_id) && !toDeleteIds.has(item.target_id)) {
          toDeleteIds.add(item.target_id);
          changed = true;
        }
      }
    }

    for (const id of toDeleteIds) {
      const apiFile = path.join(projDir, 'apis', `${id}.json`);
      if (fs.existsSync(apiFile)) {
        try {
          fs.unlinkSync(apiFile);
        } catch (e) {
          console.warn(`[FileDB] Failed to unlink ${apiFile}:`, e);
        }
      }
    }

    const newTree = tree.filter((t) => !toDeleteIds.has(t.target_id));
    this.saveProjectTree(projectId, newTree);
    return true;
  }

  public clearProjectApis(projectId: string): boolean {
    const projDir = this.getProjectPath(projectId);
    const apisDir = path.join(projDir, 'apis');
    if (fs.existsSync(apisDir)) {
      const files = fs.readdirSync(apisDir);
      for (const file of files) {
        if (file !== 'index.json' && file.endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(apisDir, file));
          } catch (e) {
            console.warn(`[FileDB] Failed to delete api file ${file}:`, e);
          }
        }
      }
    }
    this.saveProjectTree(projectId, []);
    return true;
  }

  public getEnvs(projectId: string): EnvironmentInfo[] {
    const projDir = this.getProjectPath(projectId);
    const indexFile = path.join(projDir, 'envs', 'index.json');
    const indexData = this.safeReadJson<any>(indexFile, { list: [] });
    const rawList = Array.isArray(indexData)
      ? indexData
      : Array.isArray(indexData?.list)
      ? indexData.list
      : Array.isArray(indexData?.items)
      ? indexData.items
      : [];
    const result: EnvironmentInfo[] = [];

    for (const item of rawList) {
      const envFile = path.join(projDir, 'envs', `${item.env_id}.json`);
      const envData = this.safeReadJson<any>(envFile, {});
      const rawEnvVarList = envData.list || envData.env_var_list;
      let varList: any[] = [];
      if (Array.isArray(rawEnvVarList)) {
        varList = rawEnvVarList;
      } else if (rawEnvVarList && typeof rawEnvVarList === 'object') {
        varList = Object.entries(rawEnvVarList).map(([key, val]: [string, any], idx) => ({
          param_id: val?.param_id || `v-${idx}`,
          key,
          value: typeof val === 'object' ? val?.value || '' : String(val),
          description: typeof val === 'object' ? val?.description || '' : '',
          is_checked: typeof val === 'object' && val?.is_checked !== undefined ? val.is_checked : 1,
        }));
      }

      const preUrl = envData.pre_url || item.pre_url || envData.server_list?.[0]?.uri || '';

      result.push({
        env_id: item.env_id,
        name: item.name || '环境',
        pre_url: preUrl,
        list: varList,
      });
    }
    return result;
  }

  public saveEnv(projectId: string, env: EnvironmentInfo): boolean {
    const projDir = this.getProjectPath(projectId);
    const envFile = path.join(projDir, 'envs', `${env.env_id}.json`);
    const existing = this.safeReadJson<any>(envFile, {});
    const toSave = {
      ...existing,
      ...env,
      server_list: existing.server_list || [{ name: '默认服务', server_id: '1', uri: env.pre_url }],
    };
    this.atomicWriteJson(envFile, toSave);

    const indexFile = path.join(projDir, 'envs', 'index.json');
    const indexData = this.safeReadJson<any>(indexFile, { list: [] });
    const isItems = Array.isArray(indexData?.items);
    const list = isItems ? indexData.items : indexData.list || [];
    const idx = list.findIndex((e: any) => e.env_id === env.env_id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], env_id: env.env_id, name: env.name, pre_url: env.pre_url };
    } else {
      list.push({ env_id: env.env_id, name: env.name, pre_url: env.pre_url });
    }
    this.atomicWriteJson(indexFile, isItems ? { ...indexData, items: list } : { ...indexData, list });
    return true;
  }

  public deleteEnv(projectId: string, envId: string): boolean {
    const projDir = this.getProjectPath(projectId);
    const envFile = path.join(projDir, 'envs', `${envId}.json`);
    if (fs.existsSync(envFile)) {
      fs.unlinkSync(envFile);
    }
    const indexFile = path.join(projDir, 'envs', 'index.json');
    const indexData = this.safeReadJson<any>(indexFile, { list: [] });
    const isItems = Array.isArray(indexData?.items);
    const list = ((isItems ? indexData.items : indexData.list) || []).filter((e: any) => e.env_id !== envId);
    this.atomicWriteJson(indexFile, isItems ? { ...indexData, items: list } : { ...indexData, list });
    return true;
  }

  public getGlobalParams(projectId: string): GlobalParams {
    const projDir = this.getProjectPath(projectId);
    const file = path.join(projDir, 'global_params.json');
    const raw = this.safeReadJson<any>(file, {});
    return {
      header: Array.isArray(raw.header) ? raw.header : Array.isArray(raw.header?.parameter) ? raw.header.parameter : [],
      query: Array.isArray(raw.query) ? raw.query : Array.isArray(raw.query?.parameter) ? raw.query.parameter : [],
      body: Array.isArray(raw.body) ? raw.body : Array.isArray(raw.body?.parameter) ? raw.body.parameter : [],
      vars: Array.isArray(raw.vars) ? raw.vars : [],
    };
  }

  public saveGlobalParams(projectId: string, params: GlobalParams): boolean {
    const projDir = this.getProjectPath(projectId);
    const file = path.join(projDir, 'global_params.json');
    this.atomicWriteJson(file, params);
    return true;
  }

  public scanApipostProjects(): ApipostScannedProject[] {
    const results: ApipostScannedProject[] = [];
    try {
      const appData = (typeof app !== 'undefined' && app?.getPath)
        ? app.getPath('appData')
        : process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const apipostRegistry = path.join(appData, 'Apipost单机版', 'offline-projects.json');
      if (!fs.existsSync(apipostRegistry)) return results;

      const apipostList = this.safeReadJson<any[]>(apipostRegistry, []);
      const currentList = this.safeReadJson<any[]>(this.registryFile, []);
      const importedIds = new Set(currentList.map((p) => p.project_id));

      for (const item of apipostList) {
        const projDir = item.path || path.join(appData, 'Apipost单机版', 'offline-data', item.project_id);
        const metaPath = path.join(projDir, 'project.json');
        const meta = this.safeReadJson<any>(metaPath, {});
        const treePath = path.join(projDir, 'apis', 'index.json');
        const tree = this.safeReadJson<{ items: any[] }>(treePath, { items: [] });
        const apiCount = (tree.items || []).filter((i) => i.target_type === 'api').length;

        results.push({
          project_id: item.project_id,
          name: meta.name || item.name || '本地离线项目',
          path: projDir,
          created_at: meta.created_at || item.created_at || new Date().toISOString(),
          apiCount,
          isImported: importedIds.has(item.project_id),
        });
      }
    } catch (e) {
      console.warn('[FileDB] Failed to scan Apipost projects:', e);
    }
    return results;
  }

  public importApipostProject(projectId: string, customPath?: string): ProjectInfo | null {
    const appData = (typeof app !== 'undefined' && app?.getPath)
      ? app.getPath('appData')
      : process.env.APPDATA || '';
    const defaultPath = path.join(appData, 'Apipost单机版', 'offline-data', projectId);
    const targetPath = customPath || defaultPath;

    if (!fs.existsSync(targetPath)) {
      console.error(`[FileDB] Project path not found: ${targetPath}`);
      return null;
    }

    const meta = this.safeReadJson<any>(path.join(targetPath, 'project.json'), {});
    const now = new Date().toISOString();

    const list = this.safeReadJson<any[]>(this.registryFile, []);
    const existingIndex = list.findIndex((p) => p.project_id === projectId);
    if (existingIndex >= 0) {
      list[existingIndex] = {
        project_id: projectId,
        path: targetPath,
        created_at: list[existingIndex].created_at || now,
      };
    } else {
      list.unshift({
        project_id: projectId,
        path: targetPath,
        created_at: now,
      });
    }
    this.atomicWriteJson(this.registryFile, list);

    return {
      project_id: projectId,
      name: meta.name || 'Apipost 项目',
      intro: meta.intro || '',
      path: targetPath,
      created_at: meta.created_at || now,
      updated_at: meta.updated_at || now,
    };
  }

  public moveApi(projectId: string, targetId: string, newParentId: string): boolean {
    const tree = this.getProjectTree(projectId);
    const targetIndex = tree.findIndex((t) => t.target_id === targetId);
    if (targetIndex < 0) return false;

    tree[targetIndex].parent_id = newParentId;
    tree[targetIndex].updated_at = new Date().toISOString();
    this.saveProjectTree(projectId, tree);

    const detail = this.getApiDetail(projectId, targetId);
    if (detail) {
      detail.parent_id = newParentId;
      this.saveApiDetail(projectId, targetId, detail);
    }
    return true;
  }

  public saveResponseExample(projectId: string, targetId: string, example: ResponseExample): boolean {
    const detail = this.getApiDetail(projectId, targetId);
    if (!detail) return false;

    if (!detail.response) {
      detail.response = { example: [] };
    }
    if (!detail.response.example) {
      detail.response.example = [];
    }

    const examples = detail.response.example;
    const existingIndex = examples.findIndex((ex) => ex.example_id === example.example_id);

    // If marked as default, unset other defaults
    if (example.expect?.is_default === 1) {
      examples.forEach((ex) => {
        if (ex.expect) ex.expect.is_default = 0;
      });
    }

    if (existingIndex >= 0) {
      examples[existingIndex] = example;
    } else {
      // If it's the first example, default to is_default = 1
      if (examples.length === 0 && example.expect) {
        example.expect.is_default = 1;
      }
      examples.push(example);
    }

    return this.saveApiDetail(projectId, targetId, detail);
  }
}

