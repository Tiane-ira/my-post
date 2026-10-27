import React, { useState, useEffect, useRef } from 'react';
import {
  ApiDetail,
  ApiTreeNode,
  EnvironmentInfo,
  GlobalParams,
  HttpMethod,
  HttpResponseResult,
  ProjectInfo,
  KeyValueItem,
} from '../../common/types';
import { ParamUtils } from '../../common/paramUtils';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { TabItem, TabManager } from './components/TabManager';
import { ApiWorkbench } from './components/ApiWorkbench';
import { SseWorkbench } from './components/SseWorkbench';
import { WebSocketWorkbench } from './components/WebSocketWorkbench';
import { FolderWorkbench } from './components/FolderWorkbench';
import { ProjectModal } from './components/ProjectModal';
import { EnvModal } from './components/EnvModal';
import { ImportModal } from './components/ImportModal';
import { ShareModal } from './components/ShareModal';
import { SettingsModal } from './components/SettingsModal';
import { ActivityBar } from './components/ActivityBar';
import { ShareManagementPage } from './components/ShareManagementPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFeedback } from './components/FeedbackContext';
import { getAutoCheckEnabled, checkForUpdates } from './utils/updateChecker';

export const App: React.FC = () => {
  const { toast } = useFeedback();
  const modifiedApisRef = React.useRef<Record<string, ApiDetail>>({});
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(null);
  const [treeItems, setTreeItems] = useState<ApiTreeNode[]>([]);
  const [envs, setEnvs] = useState<EnvironmentInfo[]>([]);
  const [currentEnv, setCurrentEnv] = useState<EnvironmentInfo | null>(null);
  const [globalParams, setGlobalParams] = useState<GlobalParams>({
    header: [],
    query: [],
    body: [],
    vars: [],
  });

  const isParamChecked = (item: any): boolean => {
    if (!item || typeof item !== 'object') return false;
    return item.is_checked === undefined || item.is_checked === 1 || item.is_checked === true || item.is_checked === '1';
  };

  // Available environment & global variables for interpolation and autocomplete
  const availableVars = React.useMemo(() => {
    const map: Record<string, { value: string; source: 'env' | 'global' }> = {};
    for (const v of globalParams?.vars || []) {
      if (v && typeof v === 'object' && isParamChecked(v) && v.key) {
        map[v.key] = { value: typeof v.value === 'string' ? v.value : String(v.value || ''), source: 'global' };
      }
    }
    for (const v of currentEnv?.list || []) {
      if (v && typeof v === 'object' && isParamChecked(v) && v.key) {
        map[v.key] = { value: typeof v.value === 'string' ? v.value : String(v.value || ''), source: 'env' };
      }
    }
    return map;
  }, [globalParams?.vars, currentEnv?.list]);

  // Tabs
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ApiDetail | null>(null);
  const [activeFolder, setActiveFolder] = useState<ApiTreeNode | null>(null);
  const [streamingTabs, setStreamingTabs] = useState<Record<string, ApiDetail>>({});
  const [folderDetails, setFolderDetails] = useState<Record<string, any>>({});
  const [apiResponses, setApiResponses] = useState<Record<string, HttpResponseResult>>({});
  const apiDetailsCacheRef = React.useRef<Record<string, ApiDetail>>({});

  // Merged folder details cache combining synchronous cache and react state
  const mergedFolderDetails = React.useMemo(() => {
    return { ...apiDetailsCacheRef.current, ...folderDetails };
  }, [folderDetails]);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [envModalInitialTab, setEnvModalInitialTab] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);

  const currentEnvVars = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of currentEnv?.list || []) {
      if (item && isParamChecked(item) && item.key) {
        map[item.key] = typeof item.value === 'string' ? item.value : String(item.value || '');
      }
    }
    return map;
  }, [currentEnv?.list]);

  const globalVarsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of globalParams?.vars || []) {
      if (item && isParamChecked(item) && item.key) {
        map[item.key] = typeof item.value === 'string' ? item.value : String(item.value || '');
      }
    }
    return map;
  }, [globalParams?.vars]);

  const ensureAncestorFolderDetails = async (
    parentId: string | undefined,
    tree: ApiTreeNode[],
    forceRefresh: boolean = false
  ) => {
    if (!currentProject) return;
    const folderIdsToLoad: string[] = [];
    const newDetails: Record<string, ApiDetail> = {};
    let cur = parentId;
    while (cur && cur !== '0') {
      if (!forceRefresh && apiDetailsCacheRef.current[cur]) {
        newDetails[cur] = apiDetailsCacheRef.current[cur];
      } else {
        folderIdsToLoad.push(cur);
      }
      const node = (tree || []).find((t) => t.target_id === cur);
      cur = node ? node.parent_id : '';
    }
    if (!forceRefresh && apiDetailsCacheRef.current['0']) {
      newDetails['0'] = apiDetailsCacheRef.current['0'];
    } else {
      folderIdsToLoad.push('0');
    }

    if (folderIdsToLoad.length > 0) {
      await Promise.all(
        folderIdsToLoad.map(async (fId) => {
          try {
            const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, fId);
            if (detail) {
              apiDetailsCacheRef.current[fId] = detail;
              newDetails[fId] = detail;
            }
          } catch (e) {
            console.warn(`Failed to preload ancestor folder ${fId}:`, e);
          }
        })
      );
    }

    if (Object.keys(newDetails).length > 0) {
      setFolderDetails((prev) => {
        let hasChange = false;
        for (const [k, v] of Object.entries(newDetails)) {
          if (prev[k] !== v) {
            hasChange = true;
            break;
          }
        }
        return hasChange ? { ...prev, ...newDetails } : prev;
      });
    }
  };

  // Top-level Navigation View ('apis' | 'shares')
  const [activeNavTab, setActiveNavTab] = useState<'apis' | 'shares'>('apis');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const activeElem = document.activeElement;
        const isEditingInput =
          activeElem &&
          (activeElem.tagName === 'INPUT' ||
            activeElem.tagName === 'TEXTAREA' ||
            (activeElem as HTMLElement).isContentEditable);
        if (!isEditingInput) {
          e.preventDefault();
          setIsSidebarCollapsed((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects();
    const savedCloseToTray = localStorage.getItem('mypost:system:closeToTray');
    if (savedCloseToTray !== null && window.mypostAPI?.setCloseToTray) {
      window.mypostAPI.setCloseToTray(savedCloseToTray === 'true');
    }

    // Startup update check (only if enabled by user, defaults to false)
    if (getAutoCheckEnabled()) {
      const timer = setTimeout(async () => {
        try {
          const res = await checkForUpdates();
          if (res.hasUpdate) {
            toast.info(`🎉 发现 mypost 新版本 v${res.latestVersion}，可前往“设置 - 关于”下载更新`);
          }
        } catch {
          // Silent ignore
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Dynamic window title with current project name
  useEffect(() => {
    document.title = currentProject?.name ? `${currentProject.name} - mypost` : 'mypost';
  }, [currentProject?.name]);

  const handleSwitchProject = (project: ProjectInfo) => {
    if (!project) return;
    if (currentProject?.project_id === project.project_id) return;
    // Clear tabs immediately to prevent mismatched project data
    modifiedApisRef.current = {};
    apiDetailsCacheRef.current = {};
    setTabs([]);
    setActiveTabId(null);
    setActiveDetail(null);
    setActiveFolder(null);
    setStreamingTabs({});
    setApiResponses({});
    setCurrentProject(project);
  };

  // When project changes
  useEffect(() => {
    if (currentProject) {
      loadProjectData(currentProject.project_id);
    }
  }, [currentProject?.project_id]);

  const loadProjects = async () => {
    try {
      const list = await window.mypostAPI.listProjects();
      setProjects(list || []);
      if (list && list.length > 0 && !currentProject) {
        setCurrentProject(list[0]);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
  };

  const loadProjectData = async (projectId: string, preserveTabs: boolean = false) => {
    try {
      const [tree, envList, gParams] = await Promise.all([
        window.mypostAPI.getProjectTree(projectId),
        window.mypostAPI.getEnvs(projectId),
        window.mypostAPI.getGlobalParams(projectId),
      ]);
      const validTree = Array.isArray(tree) ? tree : [];
      const validEnvs = Array.isArray(envList) ? envList : [];
      const validGlobals = gParams || { header: [], query: [], body: [], vars: [] };

      setTreeItems(validTree);
      setEnvs(validEnvs);
      setGlobalParams(validGlobals);
      if (validEnvs.length > 0) {
        setCurrentEnv((prev) => (prev && validEnvs.some((e) => e.env_id === prev.env_id) ? prev : validEnvs[0]));
      } else {
        setCurrentEnv(null);
      }

      if (preserveTabs && tabs.length > 0) {
        return;
      }

      // Open first api if available
      const firstApi = validTree.find(
        (t) => t.target_type === 'api' || t.target_type === 'sse' || t.target_type === 'websocket'
      );
      if (firstApi) {
        await ensureAncestorFolderDetails(firstApi.parent_id, validTree);
        const detail = await window.mypostAPI.getApiDetail(projectId, firstApi.target_id);
        if (detail) {
          const newTab: TabItem = {
            id: detail.target_id,
            name: detail.name,
            method: detail.method,
            type: (detail.target_type as any) || 'api',
            isDirty: false,
          };
          setTabs([newTab]);
          setActiveTabId(detail.target_id);
          setActiveDetail(detail);
          apiDetailsCacheRef.current[detail.target_id] = detail;
          if (detail.target_type === 'sse' || detail.target_type === 'websocket') {
            setStreamingTabs({ [detail.target_id]: detail });
          } else {
            setStreamingTabs({});
          }
          setActiveFolder(null);
        } else {
          setTabs([]);
          setActiveTabId(null);
          setActiveDetail(null);
          setActiveFolder(null);
          setStreamingTabs({});
        }
      } else {
        const firstFolder = validTree.find((t) => t.target_type === 'folder');
        if (firstFolder) {
          const newTab: TabItem = {
            id: firstFolder.target_id,
            name: firstFolder.name,
            method: '',
            type: 'folder',
            isDirty: false,
          };
          setTabs([newTab]);
          setActiveTabId(firstFolder.target_id);
          setActiveFolder(firstFolder);
          setActiveDetail(null);
        } else {
          setTabs([]);
          setActiveTabId(null);
          setActiveDetail(null);
          setActiveFolder(null);
          setStreamingTabs({});
        }
      }
    } catch (e) {
      console.error('Failed to load project data:', e);
      setTreeItems([]);
      setTabs([]);
      setActiveTabId(null);
      setActiveDetail(null);
      setActiveFolder(null);
      setStreamingTabs({});
    }
  };

  const openFolderTab = async (folderId: string) => {
    let folder: ApiTreeNode | undefined;
    if (folderId === '0') {
      folder = {
        target_id: '0',
        parent_id: '',
        target_type: 'folder',
        name: '根目录',
        method: '',
        url: '',
        sort: 0,
        status: 1,
      };
    } else {
      folder = treeItems.find((t) => t.target_id === folderId);
    }
    if (!folder) return;
    const existing = tabs.find((t) => t.id === folderId);
    if (!existing) {
      const newTab: TabItem = {
        id: folder.target_id,
        name: folder.name,
        method: '',
        type: 'folder',
        isDirty: false,
      };
      setTabs((prev) => [...prev, newTab]);
    }
    setActiveTabId(folderId);
    setActiveFolder(folder);
    setActiveDetail(null);

    // Load folder details from cache or backend if not loaded
    if (currentProject && !apiDetailsCacheRef.current[folderId]) {
      try {
        const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, folderId);
        if (detail) {
          apiDetailsCacheRef.current[folderId] = detail;
          setFolderDetails((prev) => ({ ...prev, [folderId]: detail }));
        }
      } catch (e) {
        console.warn('Failed to load folder detail:', e);
      }
    }
  };

  const openApiTab = async (targetId: string) => {
    if (!currentProject) return;

    setActiveFolder(null);

    const node = treeItems.find((t) => t.target_id === targetId);
    await ensureAncestorFolderDetails(node?.parent_id, treeItems);

    // 1. Check synchronous cache in memory
    const cached = modifiedApisRef.current[targetId] || apiDetailsCacheRef.current[targetId];

    // Check if tab already exists in tabs
    const existing = tabs.find((t) => t.id === targetId);
    if (existing) {
      setActiveTabId(targetId);
      if (cached) {
        // Synchronize parent_id with current tree node if needed
        const synced =
          node?.parent_id !== undefined && cached.parent_id !== node.parent_id
            ? { ...cached, parent_id: node.parent_id }
            : cached;
        if (synced !== cached) {
          apiDetailsCacheRef.current[targetId] = synced;
          if (modifiedApisRef.current[targetId]) {
            modifiedApisRef.current[targetId] = synced;
          }
        }
        // Immediate synchronous switch - 0ms delay!
        setActiveDetail(synced);
        if (synced.target_type === 'sse' || synced.target_type === 'websocket') {
          setStreamingTabs((prev) => (prev[targetId] ? prev : { ...prev, [targetId]: synced }));
        }
        return;
      }
      const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, targetId);
      if (detail) {
        if (node?.parent_id !== undefined) {
          detail.parent_id = node.parent_id;
        }
        apiDetailsCacheRef.current[targetId] = detail;
        setActiveDetail(detail);
        if (detail.target_type === 'sse' || detail.target_type === 'websocket') {
          setStreamingTabs((prev) => ({ ...prev, [targetId]: detail }));
        }
      }
      return;
    }

    // 2. Tab is not yet in tabs, open new tab
    if (cached) {
      const synced =
        node?.parent_id !== undefined && cached.parent_id !== node.parent_id
          ? { ...cached, parent_id: node.parent_id }
          : cached;
      if (synced !== cached) {
        apiDetailsCacheRef.current[targetId] = synced;
        if (modifiedApisRef.current[targetId]) {
          modifiedApisRef.current[targetId] = synced;
        }
      }
      const newTab: TabItem = {
        id: synced.target_id,
        name: synced.name,
        method: synced.method,
        type: (synced.target_type as any) || 'api',
        isDirty: !!modifiedApisRef.current[targetId],
      };
      setTabs((prev) => (prev.some((t) => t.id === synced.target_id) ? prev : [...prev, newTab]));
      setActiveTabId(synced.target_id);
      setActiveDetail(synced);
      if (synced.target_type === 'sse' || synced.target_type === 'websocket') {
        setStreamingTabs((prev) => ({ ...prev, [synced.target_id]: synced }));
      }
      return;
    }

    const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, targetId);
    if (detail) {
      if (node?.parent_id !== undefined) {
        detail.parent_id = node.parent_id;
      }
      apiDetailsCacheRef.current[detail.target_id] = detail;
      const newTab: TabItem = {
        id: detail.target_id,
        name: detail.name,
        method: detail.method,
        type: (detail.target_type as any) || 'api',
        isDirty: false,
      };
      setTabs((prev) => (prev.some((t) => t.id === detail.target_id) ? prev : [...prev, newTab]));
      setActiveTabId(detail.target_id);
      setActiveDetail(detail);
      if (detail.target_type === 'sse' || detail.target_type === 'websocket') {
        setStreamingTabs((prev) => ({ ...prev, [detail.target_id]: detail }));
      }
    }
  };

  const handleSelectTab = (id: string) => {
    if (id === activeTabId) return;
    const node = treeItems.find((t) => t.target_id === id);
    if (node?.target_type === 'folder') {
      openFolderTab(id);
    } else {
      openApiTab(id);
    }
  };

  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    delete modifiedApisRef.current[id];
    delete apiDetailsCacheRef.current[id];
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    setStreamingTabs((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setApiResponses((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    if (activeTabId === id) {
      if (nextTabs.length > 0) {
        const next = nextTabs[nextTabs.length - 1];
        handleSelectTab(next.id);
      } else {
        setActiveTabId(null);
        setActiveDetail(null);
        setActiveFolder(null);
      }
    }
  };

  const handleNewTab = (targetType: 'api' | 'sse' | 'websocket' = 'api') => {
    if (!currentProject) return;
    const prefix = targetType === 'sse' ? 'sse-quick' : targetType === 'websocket' ? 'ws-quick' : 'api-quick';
    const newId = `${prefix}-${Date.now().toString(36)}`;
    let defaultName = '未命名快捷请求';
    let defaultUrl = '';
    if (targetType === 'sse') {
      defaultName = '未命名 SSE 请求';
      defaultUrl = '/api/stream';
    } else if (targetType === 'websocket') {
      defaultName = '未命名 WebSocket';
      defaultUrl = '/ws';
    }

    const newApi: ApiDetail = {
      target_id: newId,
      parent_id: '0',
      project_id: currentProject.project_id,
      target_type: targetType,
      name: defaultName,
      method: 'GET',
      url: defaultUrl,
      sort: Date.now(),
      status: 1,
      request: {
        query: { parameter: [] },
        header: {
          parameter:
            targetType === 'sse'
              ? [{ param_id: `p-acc-${Date.now().toString(36)}`, is_checked: 1, type: 'string', key: 'Accept', value: 'text/event-stream' }]
              : [],
        },
        body: { mode: 'none' },
        auth: { type: 'none' },
      },
      ...(targetType === 'websocket'
        ? {
            websocket: {
              protocols: '',
              heartbeat: {
                enabled: false,
                interval: 30,
                message: 'ping',
              },
              messageDraft: '{\n  "action": "ping"\n}',
              messageMode: 'json' as const,
            },
          }
        : {}),
    };

    const newTab: TabItem = {
      id: newId,
      name: newApi.name,
      method: newApi.method,
      type: targetType,
      isDirty: true,
    };

    apiDetailsCacheRef.current[newId] = newApi;
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setActiveFolder(null);
    setActiveDetail(newApi);
    if (targetType === 'sse' || targetType === 'websocket') {
      setStreamingTabs((prev) => ({ ...prev, [newId]: newApi }));
    }
    ensureAncestorFolderDetails('0', treeItems);
  };

  const handleApiChange = (updated: ApiDetail) => {
    setActiveDetail(updated);
    modifiedApisRef.current[updated.target_id] = updated;
    apiDetailsCacheRef.current[updated.target_id] = updated;
    if (updated.target_type === 'sse' || updated.target_type === 'websocket') {
      setStreamingTabs((prev) => ({ ...prev, [updated.target_id]: updated }));
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === updated.target_id
          ? { ...t, name: updated.name, method: updated.method, isDirty: true }
          : t
      )
    );
  };

  const handleFolderChange = (folderId: string, updated: any) => {
    const existing = apiDetailsCacheRef.current[folderId] || {};
    const merged = { ...existing, ...updated };
    apiDetailsCacheRef.current[folderId] = merged;
    modifiedApisRef.current[folderId] = merged;
    setFolderDetails((prev) => ({ ...prev, [folderId]: merged }));
    setTabs((prev) =>
      prev.map((t) =>
        t.id === folderId ? { ...t, name: updated.name || t.name, isDirty: true } : t
      )
    );
  };

  const handleSaveFolder = async (folderId: string, updatedData?: any) => {
    if (!currentProject) return;
    const existing = apiDetailsCacheRef.current[folderId] || {};
    const data = updatedData || existing;
    const toSave: ApiDetail = {
      ...existing,
      target_id: folderId,
      parent_id: existing.parent_id || '0',
      project_id: currentProject.project_id,
      target_type: 'folder',
      name: data.name || existing.name || '新建目录',
      method: '' as any,
      url: '',
      sort: existing.sort || 0,
      status: 1,
      description: data.description || '',
      request: {
        query: { parameter: data.request?.query?.parameter || [] },
        header: { parameter: data.request?.header?.parameter || [] },
        body: { mode: 'none' },
        auth: { type: 'none' },
      },
    };
    try {
      await window.mypostAPI.saveApiDetail(currentProject.project_id, folderId, toSave);
      apiDetailsCacheRef.current[folderId] = toSave;
      setFolderDetails((prev) => ({ ...prev, [folderId]: toSave }));
      delete modifiedApisRef.current[folderId];

      // If folder name changed, update project tree
      const currentTreeNode = treeItems.find((n) => n.target_id === folderId);
      if (folderId !== '0' && data.name && (!currentTreeNode || data.name !== currentTreeNode.name)) {
        const nextTree = treeItems.map((n) =>
          n.target_id === folderId ? { ...n, name: data.name } : n
        );
        await window.mypostAPI.saveProjectTree(currentProject.project_id, nextTree);
        setTreeItems(nextTree);
        if (activeFolder && activeFolder.target_id === folderId) {
          setActiveFolder({ ...activeFolder, name: data.name });
        }
      }

      setTabs((prev) =>
        prev.map((t) => (t.id === folderId ? { ...t, name: toSave.name, isDirty: false } : t))
      );
    } catch (e: any) {
      console.error('Save folder error:', e);
      toast.error(`目录保存失败: ${e.message || e}`);
    }
  };

  const isSavingRef = useRef(false);

  const handleSaveApi = async (specificApi?: ApiDetail) => {
    if (isSavingRef.current) return;
    const targetToSave = specificApi || activeDetail;
    if (!currentProject || !targetToSave) return;

    isSavingRef.current = true;
    try {
      const treeNode = treeItems.find((t) => t.target_id === targetToSave.target_id);
      const apiToSave: ApiDetail = {
        ...targetToSave,
        parent_id: treeNode?.parent_id !== undefined ? treeNode.parent_id : (targetToSave.parent_id || '0'),
      };

      await window.mypostAPI.saveApiDetail(
        currentProject.project_id,
        apiToSave.target_id,
        apiToSave
      );
      delete modifiedApisRef.current[apiToSave.target_id];
      apiDetailsCacheRef.current[apiToSave.target_id] = apiToSave;

      // Refresh tree
      const tree = await window.mypostAPI.getProjectTree(currentProject.project_id);
      setTreeItems(tree);

      // Clear dirty flag
      setTabs((prev) =>
        prev.map((t) => (t.id === apiToSave.target_id ? { ...t, isDirty: false } : t))
      );
      toast.success('接口保存成功');
    } catch (e: any) {
      console.error('Save API error:', e);
      toast.error(`接口保存失败: ${e.message || e}`);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Global Ctrl+S / Cmd+S shortcut to save the active API or Folder
  useEffect(() => {
    const handleGlobalSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        if (activeDetail) {
          handleSaveApi(activeDetail);
        } else if (activeFolder) {
          const detail =
            folderDetails[activeFolder.target_id] ||
            apiDetailsCacheRef.current[activeFolder.target_id];
          handleSaveFolder(activeFolder.target_id, detail || activeFolder);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalSave);
    return () => window.removeEventListener('keydown', handleGlobalSave);
  }, [activeDetail, activeFolder, folderDetails, currentProject]);

  const handleSaveAll = async () => {
    if (!currentProject) return;
    try {
      if (activeDetail) {
        const treeNode = treeItems.find((t) => t.target_id === activeDetail.target_id);
        const apiToSave = {
          ...activeDetail,
          parent_id: treeNode?.parent_id !== undefined ? treeNode.parent_id : (activeDetail.parent_id || '0'),
        };
        await window.mypostAPI.saveApiDetail(
          currentProject.project_id,
          apiToSave.target_id,
          apiToSave
        );
        apiDetailsCacheRef.current[apiToSave.target_id] = apiToSave;
      }
      for (const [id, detail] of Object.entries(modifiedApisRef.current)) {
        if (id !== activeDetail?.target_id) {
          const treeNode = treeItems.find((t) => t.target_id === id);
          const apiToSave = {
            ...detail,
            parent_id: treeNode?.parent_id !== undefined ? treeNode.parent_id : (detail.parent_id || '0'),
          };
          await window.mypostAPI.saveApiDetail(currentProject.project_id, id, apiToSave);
          apiDetailsCacheRef.current[id] = apiToSave;
        }
      }
      modifiedApisRef.current = {};
      const tree = await window.mypostAPI.getProjectTree(currentProject.project_id);
      setTreeItems(tree);
      setTabs((prev) => prev.map((t) => ({ ...t, isDirty: false })));
      toast.success('所有标签已全部保存');
    } catch (e: any) {
      console.error('Failed to save all:', e);
      toast.error('保存失败');
    }
  };

  const handleCloseOthers = (id: string) => {
    const target = tabs.find((t) => t.id === id);
    if (!target) return;
    for (const tab of tabs) {
      if (tab.id !== id) {
        delete modifiedApisRef.current[tab.id];
        delete apiDetailsCacheRef.current[tab.id];
      }
    }
    setTabs([target]);
    setStreamingTabs((prev) => (prev[id] ? { [id]: prev[id] } : {}));
    setApiResponses((prev) => (prev[id] ? { [id]: prev[id] } : {}));
    if (activeTabId !== id) {
      handleSelectTab(id);
    }
  };

  const handleCloseRight = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const closed = tabs.slice(idx + 1);
    const closedIds = new Set(closed.map((c) => c.id));
    for (const c of closed) {
      delete modifiedApisRef.current[c.id];
      delete apiDetailsCacheRef.current[c.id];
    }
    const nextTabs = tabs.slice(0, idx + 1);
    setTabs(nextTabs);
    setStreamingTabs((prev) => {
      const copy = { ...prev };
      closedIds.forEach((cid) => delete copy[cid]);
      return copy;
    });
    setApiResponses((prev) => {
      const copy = { ...prev };
      closedIds.forEach((cid) => delete copy[cid]);
      return copy;
    });
    if (!nextTabs.some((t) => t.id === activeTabId)) {
      handleSelectTab(id);
    }
  };

  const handleCloseLeft = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const closed = tabs.slice(0, idx);
    const closedIds = new Set(closed.map((c) => c.id));
    for (const c of closed) {
      delete modifiedApisRef.current[c.id];
      delete apiDetailsCacheRef.current[c.id];
    }
    const nextTabs = tabs.slice(idx);
    setTabs(nextTabs);
    setStreamingTabs((prev) => {
      const copy = { ...prev };
      closedIds.forEach((cid) => delete copy[cid]);
      return copy;
    });
    setApiResponses((prev) => {
      const copy = { ...prev };
      closedIds.forEach((cid) => delete copy[cid]);
      return copy;
    });
    if (!nextTabs.some((t) => t.id === activeTabId)) {
      handleSelectTab(id);
    }
  };

  const handleCloseAll = () => {
    modifiedApisRef.current = {};
    apiDetailsCacheRef.current = {};
    setTabs([]);
    setActiveTabId(null);
    setActiveDetail(null);
    setActiveFolder(null);
    setStreamingTabs({});
    setApiResponses({});
  };

  const handleSendRequest = async (apiToSend: ApiDetail, requestId?: string): Promise<HttpResponseResult> => {
    if (currentProject) {
      await ensureAncestorFolderDetails(apiToSend.parent_id, treeItems);
    }

    const envVars: Record<string, string> = {};
    if (currentEnv?.list) {
      for (const item of currentEnv.list) {
        if (item.is_checked === 1 && item.key) {
          envVars[item.key] = item.value;
        }
      }
    }

    const globalVars: Record<string, string> = {};
    if (globalParams?.vars) {
      for (const item of globalParams.vars) {
        if (item.is_checked === 1 && item.key) {
          globalVars[item.key] = item.value;
        }
      }
    }

    const finalApiToSend = ParamUtils.mergeApiWithFolderParams(
      apiToSend,
      treeItems,
      apiDetailsCacheRef.current
    );

    const preUrl = currentEnv?.pre_url || '';
    return window.mypostAPI.sendRequest(finalApiToSend, envVars, globalVars, preUrl, requestId);
  };

  const handleCreateApi = async (
    parentId = '0',
    targetType: 'api' | 'sse' | 'websocket' = 'api'
  ) => {
    if (!currentProject) return;
    const prefix = targetType === 'sse' ? 'sse' : targetType === 'websocket' ? 'ws' : 'api';
    const newId = `${prefix}-${Date.now().toString(36)}`;
    let defaultName = '新建接口';
    let defaultMethod: HttpMethod = 'GET';
    let defaultUrl = '';

    if (targetType === 'sse') {
      defaultName = '新建 SSE 流式接口';
      defaultMethod = 'GET';
      defaultUrl = '/api/stream';
    } else if (targetType === 'websocket') {
      defaultName = '新建 WebSocket 接口';
      defaultMethod = 'GET';
      defaultUrl = '/ws';
    }

    const newApi: ApiDetail = {
      target_id: newId,
      parent_id: parentId,
      project_id: currentProject.project_id,
      target_type: targetType,
      name: defaultName,
      method: defaultMethod,
      url: defaultUrl,
      sort: treeItems.length * 1000 + 1000,
      status: 1,
      request: {
        query: { parameter: [] },
        header: {
          parameter:
            targetType === 'sse'
              ? [{ param_id: `p-acc-${Date.now().toString(36)}`, is_checked: 1, type: 'string', key: 'Accept', value: 'text/event-stream' }]
              : [],
        },
        body: { mode: 'none' },
        auth: { type: 'none' },
      },
      ...(targetType === 'websocket'
        ? {
            websocket: {
              protocols: '',
              heartbeat: {
                enabled: false,
                interval: 30,
                message: 'ping',
              },
              messageDraft: '{\n  "action": "ping"\n}',
              messageMode: 'json' as const,
            },
          }
        : {}),
    };

    await window.mypostAPI.saveApiDetail(currentProject.project_id, newId, newApi);
    const tree = await window.mypostAPI.getProjectTree(currentProject.project_id);
    setTreeItems(tree);
    openApiTab(newId);
  };

  const handleCreateFolder = async (parentId = '0') => {
    if (!currentProject) return;
    const folderId = `folder-${Date.now().toString(36)}`;
    const folderNode: ApiTreeNode = {
      target_id: folderId,
      parent_id: parentId,
      target_type: 'folder',
      name: '新建目录',
      method: '',
      url: '',
      sort: treeItems.length * 1000 + 1000,
      status: 1,
    };
    const nextTree = [...treeItems, folderNode];
    await window.mypostAPI.saveProjectTree(currentProject.project_id, nextTree);
    setTreeItems(nextTree);
    openFolderTab(folderId);
  };

  const handleUpdateFolderName = async (folderId: string, newName: string) => {
    if (!currentProject) return;
    const nextTree = treeItems.map((t) => (t.target_id === folderId ? { ...t, name: newName } : t));
    await window.mypostAPI.saveProjectTree(currentProject.project_id, nextTree);
    setTreeItems(nextTree);
    setTabs((prev) => prev.map((t) => (t.id === folderId ? { ...t, name: newName } : t)));
    if (activeFolder?.target_id === folderId) {
      setActiveFolder({ ...activeFolder, name: newName });
    }
  };

  const handleRenameNode = async (targetId: string, newName: string) => {
    if (!currentProject) return;
    const node = treeItems.find((t) => t.target_id === targetId);
    if (!node) return;

    const nextTree = treeItems.map((t) =>
      t.target_id === targetId ? { ...t, name: newName, updated_at: new Date().toISOString() } : t
    );
    await window.mypostAPI.saveProjectTree(currentProject.project_id, nextTree);
    setTreeItems(nextTree);

    // Update open tab
    setTabs((prev) => prev.map((t) => (t.id === targetId ? { ...t, name: newName } : t)));

    if (node.target_type === 'folder') {
      if (activeFolder?.target_id === targetId) {
        setActiveFolder({ ...activeFolder, name: newName });
      }
    } else {
      if (activeDetail?.target_id === targetId) {
        const updated = { ...activeDetail, name: newName };
        setActiveDetail(updated);
        await window.mypostAPI.saveApiDetail(currentProject.project_id, targetId, updated);
      } else {
        const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, targetId);
        if (detail) {
          detail.name = newName;
          await window.mypostAPI.saveApiDetail(currentProject.project_id, targetId, detail);
        }
      }
    }
  };

  const handleReorderTree = async (newTree: ApiTreeNode[], movedId?: string, newParentId?: string) => {
    if (!currentProject) return;
    setTreeItems(newTree);
    await window.mypostAPI.saveProjectTree(currentProject.project_id, newTree);

    if (movedId && newParentId !== undefined) {
      const movedNode = newTree.find((t) => t.target_id === movedId);

      // Preload & refresh ancestor folder details for the destination folder
      await ensureAncestorFolderDetails(newParentId, newTree, true);

      if (movedNode && movedNode.target_type !== 'folder') {
        const existingDetail =
          modifiedApisRef.current[movedId] ||
          apiDetailsCacheRef.current[movedId] ||
          (await window.mypostAPI.getApiDetail(currentProject.project_id, movedId));

        if (existingDetail) {
          const updatedDetail: ApiDetail = {
            ...existingDetail,
            parent_id: newParentId,
          };
          await window.mypostAPI.saveApiDetail(currentProject.project_id, movedId, updatedDetail);
          apiDetailsCacheRef.current[movedId] = updatedDetail;
          if (modifiedApisRef.current[movedId]) {
            modifiedApisRef.current[movedId] = updatedDetail;
          }
          setActiveDetail((prev) =>
            prev && prev.target_id === movedId ? { ...prev, parent_id: newParentId } : prev
          );
          setStreamingTabs((prev) => {
            if (!prev[movedId]) return prev;
            return {
              ...prev,
              [movedId]: { ...prev[movedId], parent_id: newParentId },
            };
          });
        }
      } else if (movedNode?.target_type === 'folder') {
        // If a folder was moved, refresh ancestor folder details for any open API tabs
        if (activeDetail) {
          await ensureAncestorFolderDetails(activeDetail.parent_id, newTree, true);
        }
      }
    }
  };

  const handleClearRootApis = async () => {
    if (!currentProject) return;
    try {
      await window.mypostAPI.clearProjectApis(currentProject.project_id);
      modifiedApisRef.current = {};
      apiDetailsCacheRef.current = {};
      setTabs([]);
      setActiveTabId(null);
      setActiveDetail(null);
      setActiveFolder(null);
      setStreamingTabs({});
      setTreeItems([]);
      toast.success('已清空根目录下的所有接口');
    } catch (e: any) {
      console.error('Failed to clear root apis:', e);
      toast.error(`清空失败: ${e.message || e}`);
    }
  };

  const handleDeleteNode = async (targetId: string) => {
    if (!currentProject) return;
    if (targetId === '0') {
      await handleClearRootApis();
      return;
    }
    await window.mypostAPI.deleteApi(currentProject.project_id, targetId);
    const tree = await window.mypostAPI.getProjectTree(currentProject.project_id);
    setTreeItems(tree);
    if (activeTabId === targetId) {
      handleCloseTab(targetId, { stopPropagation: () => {} } as any);
    }
  };

  const handleCloneApi = async (targetId: string) => {
    if (!currentProject) return;
    const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, targetId);
    if (!detail) return;
    const newId = `api-${Date.now()}`;
    const newDetail: ApiDetail = {
      ...detail,
      target_id: newId,
      name: `${detail.name} (Copy)`,
    };
    await window.mypostAPI.saveApiDetail(currentProject.project_id, newId, newDetail);
    await loadProjectData(currentProject.project_id);
    openApiTab(newId);
  };

  const handleMoveApi = async (targetId: string, newParentId: string) => {
    if (!currentProject) return;
    try {
      await window.mypostAPI.moveApi(currentProject.project_id, targetId, newParentId);
      const tree = await window.mypostAPI.getProjectTree(currentProject.project_id);
      setTreeItems(tree);

      // Preload and refresh ancestor folder details for the new folder hierarchy
      await ensureAncestorFolderDetails(newParentId, tree, true);

      // Update in-memory caches and modified tracking
      if (apiDetailsCacheRef.current[targetId]) {
        apiDetailsCacheRef.current[targetId] = {
          ...apiDetailsCacheRef.current[targetId],
          parent_id: newParentId,
        };
      }
      if (modifiedApisRef.current[targetId]) {
        modifiedApisRef.current[targetId] = {
          ...modifiedApisRef.current[targetId],
          parent_id: newParentId,
        };
      }

      // Update activeDetail if targetId is currently active
      setActiveDetail((prev) =>
        prev && prev.target_id === targetId ? { ...prev, parent_id: newParentId } : prev
      );

      // Update streamingTabs if targetId is open
      setStreamingTabs((prev) => {
        if (!prev[targetId]) return prev;
        return {
          ...prev,
          [targetId]: { ...prev[targetId], parent_id: newParentId },
        };
      });

      const targetNode = tree.find((t) => t.target_id === targetId);
      const parentNode = tree.find((t) => t.target_id === newParentId);
      const parentName = newParentId === '0' ? '根目录' : parentNode?.name || '指定目录';
      toast.success(`已将 "${targetNode?.name || '接口'}" 移动至 "${parentName}"`);
    } catch (e: any) {
      console.error('Failed to move API:', e);
      toast.error(`移动失败: ${e.message || e}`);
    }
  };

  const handleExtractVariable = async (key: string, value: string) => {
    if (!currentProject) return;
    try {
      let targetEnv = currentEnv;
      if (!targetEnv) {
        if (envs.length > 0) {
          targetEnv = envs[0];
        } else {
          const createdEnv: EnvironmentInfo = {
            env_id: `env-${Date.now().toString(36)}`,
            name: '默认环境',
            pre_url: '',
            list: [],
          };
          targetEnv = createdEnv;
        }
      }

      const list = [...(targetEnv.list || [])];
      const existingIdx = list.findIndex((item) => item.key === key);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], value, is_checked: 1 };
      } else {
        list.push({
          param_id: `p-${Date.now().toString(36)}`,
          key,
          value,
          description: '从响应提取',
          is_checked: 1,
          type: 'text',
        });
      }

      const updatedEnv: EnvironmentInfo = { ...targetEnv, list };
      await window.mypostAPI.saveEnv(currentProject.project_id, updatedEnv);
      const nextEnvs = await window.mypostAPI.getEnvs(currentProject.project_id);
      setEnvs(nextEnvs);
      setCurrentEnv(updatedEnv);
    } catch (e: any) {
      console.error('Failed to extract variable to env:', e);
    }
  };

  const handleSaveGlobalParams = async (params: GlobalParams) => {
    if (!currentProject) return;
    await window.mypostAPI.saveGlobalParams(currentProject.project_id, params);
    setGlobalParams(params);
  };

  const handleCreateProject = async (name: string, intro: string, customPath?: string) => {
    const created = await window.mypostAPI.createProject(name, intro, customPath);
    await loadProjects();
    setCurrentProject(created);
    setIsProjectModalOpen(false);
  };

  const handleUpdateProject = async (
    projectId: string,
    updates: { name: string; intro: string }
  ): Promise<ProjectInfo | null> => {
    try {
      const updated = await window.mypostAPI.updateProject(projectId, updates);
      if (!updated) {
        toast.error('更新项目失败');
        return null;
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.project_id === projectId
            ? { ...p, name: updates.name, intro: updates.intro, updated_at: updated.updated_at }
            : p
        )
      );
      if (currentProject?.project_id === projectId) {
        setCurrentProject((prev) =>
          prev ? { ...prev, name: updates.name, intro: updates.intro, updated_at: updated.updated_at } : prev
        );
      }
      toast.success(`项目「${updates.name}」已更新！`);
      return updated;
    } catch (e: any) {
      toast.error(`更新项目失败: ${e?.message || e}`);
      return null;
    }
  };

  const handleDeleteProject = async (
    projectId: string,
    deleteFiles: boolean = false
  ): Promise<boolean> => {
    try {
      const success = await window.mypostAPI.deleteProject(projectId, deleteFiles);
      if (!success) {
        toast.error('删除项目失败');
        return false;
      }
      const updatedList = await window.mypostAPI.listProjects();
      setProjects(updatedList || []);

      if (currentProject?.project_id === projectId) {
        if (updatedList && updatedList.length > 0) {
          handleSwitchProject(updatedList[0]);
        } else {
          const freshList = await window.mypostAPI.listProjects();
          setProjects(freshList);
          if (freshList.length > 0) {
            handleSwitchProject(freshList[0]);
          }
        }
      }
      toast.success('项目已成功删除');
      return true;
    } catch (e: any) {
      toast.error(`删除项目失败: ${e?.message || e}`);
      return false;
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-canvas select-none overflow-hidden">
      {/* Title Bar */}
      <TitleBar
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSwitchProject}
        onOpenCreateProject={() => setIsProjectModalOpen(true)}
        envs={envs}
        currentEnv={currentEnv}
        globalParams={globalParams}
        onSelectEnv={(e) => setCurrentEnv(e)}
        onOpenEnvModal={(targetEnvId) => {
          setEnvModalInitialTab(targetEnvId || null);
          setIsEnvModalOpen(true);
        }}
      />

      {/* Main Workspace with Far Left ActivityBar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Far Left Activity Rail */}
        <ActivityBar
          activeTab={activeNavTab}
          isSidebarCollapsed={isSidebarCollapsed}
          onSelectTab={(tab) => {
            if (tab === 'apis') {
              if (activeNavTab === 'apis') {
                setIsSidebarCollapsed((prev) => !prev);
              } else {
                setActiveNavTab('apis');
                setIsSidebarCollapsed(false);
              }
            } else {
              setActiveNavTab(tab);
            }
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {/* View 1: API Management Page (Sidebar + Workbench) */}
        {activeNavTab === 'apis' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <Sidebar
              treeItems={treeItems}
              activeApiId={activeTabId}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={setIsSidebarCollapsed}
              onSelectApi={(id) => openApiTab(id)}
              onSelectFolder={(id) => openFolderTab(id)}
              onCreateApi={handleCreateApi}
              onCreateFolder={handleCreateFolder}
              onCloneApi={handleCloneApi}
              onDeleteNode={handleDeleteNode}
              onClearRootApis={handleClearRootApis}
              onRenameNode={handleRenameNode}
              onReorderTree={handleReorderTree}
              onMoveApi={handleMoveApi}
              onOpenImport={() => setIsImportModalOpen(true)}
              onOpenShareFolder={(fId) => {
                setShareFolderId(fId);
                setIsShareModalOpen(true);
              }}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            />

            {/* Center / Right Workbench */}
            <div className="flex-1 flex flex-col overflow-hidden bg-canvas">
              {/* Tab Strip */}
              <TabManager
                tabs={tabs}
                activeTabId={activeTabId}
                isSidebarCollapsed={isSidebarCollapsed}
                onExpandSidebar={() => setIsSidebarCollapsed(false)}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
                onNewTab={handleNewTab}
                onSaveAll={handleSaveAll}
                onCloseOthers={handleCloseOthers}
                onCloseRight={handleCloseRight}
                onCloseLeft={handleCloseLeft}
                onCloseAll={handleCloseAll}
              />

              {/* Workbench: API Workbench or Folder Workbench or Empty State */}
              <ErrorBoundary>
                {/* 1. Long-lived streaming workbenches (SSE & WebSocket) kept alive */}
                {tabs.map((tab) => {
                  if (tab.type !== 'sse' && tab.type !== 'websocket') return null;
                  const detail = streamingTabs[tab.id] || apiDetailsCacheRef.current[tab.id];
                  if (!detail) return null;
                  const isVisible = tab.id === activeTabId;

                  return (
                    <div
                      key={tab.id}
                      style={{ display: isVisible ? 'flex' : 'none' }}
                      className="flex-1 flex flex-col min-h-0 overflow-hidden"
                    >
                      {detail.target_type === 'sse' ? (
                        <SseWorkbench
                          api={detail}
                          availableVars={availableVars}
                          onChange={handleApiChange}
                          onSave={() => handleSaveApi(detail)}
                          onSaveAs={() => handleCloneApi(detail.target_id)}
                          onOpenShare={() => {
                            setShareFolderId(null);
                            setIsShareModalOpen(true);
                          }}
                          isDirty={tab.isDirty}
                          preUrl={currentEnv?.pre_url || ''}
                          envVars={currentEnvVars}
                          globalVars={globalVarsMap}
                          treeItems={treeItems}
                          folderDetails={mergedFolderDetails}
                          onMoveApi={handleMoveApi}
                        />
                      ) : (
                        <WebSocketWorkbench
                          api={detail}
                          availableVars={availableVars}
                          onChange={handleApiChange}
                          onSave={() => handleSaveApi(detail)}
                          onSaveAs={() => handleCloneApi(detail.target_id)}
                          onOpenShare={() => {
                            setShareFolderId(null);
                            setIsShareModalOpen(true);
                          }}
                          isDirty={tab.isDirty}
                          preUrl={currentEnv?.pre_url || ''}
                          envVars={currentEnvVars}
                          globalVars={globalVarsMap}
                          treeItems={treeItems}
                          folderDetails={mergedFolderDetails}
                          onMoveApi={handleMoveApi}
                        />
                      )}
                    </div>
                  );
                })}

                {/* 2. Active HTTP API Workbench (Single instance in DOM for instant 0ms switching) */}
                {activeDetail &&
                  activeDetail.target_type !== 'sse' &&
                  activeDetail.target_type !== 'websocket' &&
                  !activeFolder && (
                    <ApiWorkbench
                      key={activeDetail.target_id}
                      api={activeDetail}
                      availableVars={availableVars}
                      onChange={handleApiChange}
                      onSave={() => handleSaveApi(activeDetail)}
                      onSaveAs={() => handleCloneApi(activeDetail.target_id)}
                      onOpenShare={() => {
                        setShareFolderId(null);
                        setIsShareModalOpen(true);
                      }}
                      isDirty={tabs.find((t) => t.id === activeDetail.target_id)?.isDirty}
                      onSend={handleSendRequest}
                      cachedResponse={apiResponses[activeDetail.target_id] || null}
                      folderDetails={mergedFolderDetails}
                      onResponseChange={(res) => {
                        const targetId = activeDetail.target_id;
                        setApiResponses((prev) => {
                          if (res === null) {
                            if (!prev[targetId]) return prev;
                            const copy = { ...prev };
                            delete copy[targetId];
                            return copy;
                          }
                          return { ...prev, [targetId]: res };
                        });
                      }}
                      preUrl={currentEnv?.pre_url || ''}
                      onExtractVariable={handleExtractVariable}
                      treeItems={treeItems}
                      onMoveApi={handleMoveApi}
                    />
                  )}

                {/* 3. Folder Workbench */}
                {activeFolder && activeTabId === activeFolder.target_id && (
                  <FolderWorkbench
                    key={activeFolder.target_id}
                    folder={activeFolder}
                    availableVars={availableVars}
                    treeItems={treeItems}
                    onUpdateFolderName={handleUpdateFolderName}
                    onSelectApi={openApiTab}
                    onCreateApi={handleCreateApi}
                    onCreateSubFolder={handleCreateFolder}
                    onDeleteFolder={handleDeleteNode}
                    onOpenShare={(fId) => {
                      setShareFolderId(fId);
                      setIsShareModalOpen(true);
                    }}
                    folderDetail={
                      folderDetails[activeFolder.target_id] ||
                      apiDetailsCacheRef.current[activeFolder.target_id]
                    }
                    onSaveFolder={(fId, detail) => handleSaveFolder(fId, detail)}
                    onChangeFolder={(detail) => handleFolderChange(activeFolder.target_id, detail)}
                    isDirty={tabs.find((t) => t.id === activeFolder.target_id)?.isDirty}
                  />
                )}

                {/* 4. Empty State when no tabs are open or no active tab */}
                {tabs.length === 0 && !activeFolder && (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-subtle border border-line flex items-center justify-center shadow-2xl p-2.5">
                      <img src="./icon.svg" alt="mypost logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-sm font-semibold text-gray-300">mypost 高效专业的 API 研发与调试协同工具</div>
                    <div className="text-xs text-gray-500">
                      请在左侧点击接口或目录进行配置，或点击下方新建快捷请求
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleNewTab('api')}
                        className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-lg shadow-orange-500/10 transition"
                      >
                        新建 HTTP 请求
                      </button>
                      <button
                        onClick={() => handleNewTab('sse')}
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-500/10 transition"
                      >
                        新建 SSE 接口
                      </button>
                      <button
                        onClick={() => handleNewTab('websocket')}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-500/10 transition"
                      >
                        新建 WebSocket 接口
                      </button>
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* View 2: Shares Management Page (同级全屏管理页面) */}
        {activeNavTab === 'shares' && (
          <ShareManagementPage
            currentProject={currentProject}
            onOpenShareModal={() => {
              setShareFolderId('0');
              setIsShareModalOpen(true);
            }}
            onNavigateToApis={() => setActiveNavTab('apis')}
          />
        )}
      </div>

      {/* Modals */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onRefreshProjects={loadProjects}
      />

      {isEnvModalOpen && (
        <ErrorBoundary
          key="env-modal-boundary"
          isModal
          onClose={() => setIsEnvModalOpen(false)}
        >
          <EnvModal
            isOpen={isEnvModalOpen}
            onClose={() => {
              setIsEnvModalOpen(false);
              setEnvModalInitialTab(null);
            }}
            envs={envs}
            currentEnv={currentEnv}
            initialEnvId={envModalInitialTab}
            globalParams={globalParams}
            onSaveEnv={async (env) => {
              if (currentProject) {
                await window.mypostAPI.saveEnv(currentProject.project_id, env);
                const nextEnvs = await window.mypostAPI.getEnvs(currentProject.project_id);
                setEnvs(nextEnvs);
                if (!currentEnv || currentEnv.env_id === env.env_id) {
                  setCurrentEnv(env);
                }
              }
            }}
            onDeleteEnv={async (envId) => {
              if (currentProject) {
                await window.mypostAPI.deleteEnv(currentProject.project_id, envId);
                const nextEnvs = await window.mypostAPI.getEnvs(currentProject.project_id);
                setEnvs(nextEnvs);
                if (currentEnv?.env_id === envId) {
                  setCurrentEnv(nextEnvs[0] || null);
                }
              }
            }}
            onSaveGlobalParams={handleSaveGlobalParams}
          />
        </ErrorBoundary>
      )}

      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          projectId={currentProject?.project_id || ''}
          onImportComplete={async () => {
            if (currentProject) {
              await loadProjectData(currentProject.project_id, true);
            }
          }}
        />
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        project={currentProject}
        treeItems={treeItems}
        activeApi={activeDetail}
        defaultFolderId={shareFolderId}
        getApiDetail={(id) =>
          currentProject
            ? window.mypostAPI.getApiDetail(currentProject.project_id, id)
            : Promise.resolve(null)
        }
      />


      {isSettingsModalOpen && (
        <ErrorBoundary
          key="settings-modal-boundary"
          isModal
          onClose={() => setIsSettingsModalOpen(false)}
        >
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            currentProject={currentProject}
            treeItems={treeItems}
            onOpenProjectModal={() => {
              setIsSettingsModalOpen(false);
              setIsProjectModalOpen(true);
            }}
            onUpdateProject={handleUpdateProject}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};
