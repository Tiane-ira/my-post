import React, { useState, useEffect } from 'react';
import {
  ApiDetail,
  ApiTreeNode,
  EnvironmentInfo,
  GlobalParams,
  HttpMethod,
  HttpResponseResult,
  ProjectInfo,
} from '../../common/types';
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

  // Available environment & global variables for interpolation and autocomplete
  const availableVars = React.useMemo(() => {
    const map: Record<string, { value: string; source: 'env' | 'global' }> = {};
    for (const v of globalParams.vars || []) {
      if (v.is_checked === 1 && v.key) {
        map[v.key] = { value: v.value || '', source: 'global' };
      }
    }
    for (const v of currentEnv?.list || []) {
      if (v.is_checked === 1 && v.key) {
        map[v.key] = { value: v.value || '', source: 'env' };
      }
    }
    return map;
  }, [globalParams.vars, currentEnv?.list]);

  // Tabs
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ApiDetail | null>(null);
  const [activeFolder, setActiveFolder] = useState<ApiTreeNode | null>(null);
  const [streamingTabs, setStreamingTabs] = useState<Record<string, ApiDetail>>({});
  const apiDetailsCacheRef = React.useRef<Record<string, ApiDetail>>({});

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);

  // Top-level Navigation View ('apis' | 'shares')
  const [activeNavTab, setActiveNavTab] = useState<'apis' | 'shares'>('apis');
  const [sharesCount, setSharesCount] = useState<number>(0);

  // Monitor active shared links count for ActivityBar badge
  useEffect(() => {
    const updateSharesCount = async () => {
      try {
        if (window.mypostAPI?.listDocShares) {
          const list = await window.mypostAPI.listDocShares();
          setSharesCount(list?.filter((s) => !s.isExpired).length || 0);
        }
      } catch (_) {}
    };
    updateSharesCount();
    window.addEventListener('mypost:share-created', updateSharesCount);
    return () => {
      window.removeEventListener('mypost:share-created', updateSharesCount);
    };
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, []);

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

  const openFolderTab = (folderId: string) => {
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
  };

  const openApiTab = async (targetId: string) => {
    if (!currentProject) return;

    setActiveFolder(null);

    // 1. Check synchronous cache in memory
    const cached = modifiedApisRef.current[targetId] || apiDetailsCacheRef.current[targetId];

    // Check if tab already exists in tabs
    const existing = tabs.find((t) => t.id === targetId);
    if (existing) {
      setActiveTabId(targetId);
      if (cached) {
        // Immediate synchronous switch - 0ms delay!
        setActiveDetail(cached);
        if (cached.target_type === 'sse' || cached.target_type === 'websocket') {
          setStreamingTabs((prev) => (prev[targetId] ? prev : { ...prev, [targetId]: cached }));
        }
        return;
      }
      const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, targetId);
      if (detail) {
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
      const newTab: TabItem = {
        id: cached.target_id,
        name: cached.name,
        method: cached.method,
        type: (cached.target_type as any) || 'api',
        isDirty: !!modifiedApisRef.current[targetId],
      };
      setTabs((prev) => (prev.some((t) => t.id === cached.target_id) ? prev : [...prev, newTab]));
      setActiveTabId(cached.target_id);
      setActiveDetail(cached);
      if (cached.target_type === 'sse' || cached.target_type === 'websocket') {
        setStreamingTabs((prev) => ({ ...prev, [cached.target_id]: cached }));
      }
      return;
    }

    const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, targetId);
    if (detail) {
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
      defaultUrl = 'http://localhost:3000/api/stream';
    } else if (targetType === 'websocket') {
      defaultName = '未命名 WebSocket';
      defaultUrl = 'ws://echo.websocket.events';
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

  const handleSaveApi = async (specificApi?: ApiDetail) => {
    const targetToSave = specificApi || activeDetail;
    if (!currentProject || !targetToSave) return;
    await window.mypostAPI.saveApiDetail(
      currentProject.project_id,
      targetToSave.target_id,
      targetToSave
    );
    delete modifiedApisRef.current[targetToSave.target_id];

    // Refresh tree
    const tree = await window.mypostAPI.getProjectTree(currentProject.project_id);
    setTreeItems(tree);

    // Clear dirty flag
    setTabs((prev) =>
      prev.map((t) => (t.id === targetToSave.target_id ? { ...t, isDirty: false } : t))
    );
    toast.success('接口保存成功');
  };

  const handleSaveAll = async () => {
    if (!currentProject) return;
    try {
      if (activeDetail) {
        await window.mypostAPI.saveApiDetail(
          currentProject.project_id,
          activeDetail.target_id,
          activeDetail
        );
      }
      for (const [id, detail] of Object.entries(modifiedApisRef.current)) {
        if (id !== activeDetail?.target_id) {
          await window.mypostAPI.saveApiDetail(currentProject.project_id, id, detail);
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
  };

  const handleSendRequest = async (apiToSend: ApiDetail): Promise<HttpResponseResult> => {
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

    const preUrl = currentEnv?.pre_url || '';
    return window.mypostAPI.sendRequest(apiToSend, envVars, globalVars, preUrl);
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
      defaultUrl = 'http://localhost:3000/api/stream';
    } else if (targetType === 'websocket') {
      defaultName = '新建 WebSocket 接口';
      defaultMethod = 'GET';
      defaultUrl = 'ws://echo.websocket.events';
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
      if (movedNode?.target_type === 'api') {
        const detail = await window.mypostAPI.getApiDetail(currentProject.project_id, movedId);
        if (detail) {
          detail.parent_id = newParentId;
          await window.mypostAPI.saveApiDetail(currentProject.project_id, movedId, detail);
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
    } catch (e: any) {
      console.error('Failed to move API:', e);
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
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
      />

      {/* Main Workspace with Far Left ActivityBar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Far Left Activity Rail */}
        <ActivityBar
          activeTab={activeNavTab}
          onSelectTab={setActiveNavTab}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          sharesCount={sharesCount}
        />

        {/* View 1: API Management Page (Sidebar + Workbench) */}
        {activeNavTab === 'apis' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            <Sidebar
              treeItems={treeItems}
              activeApiId={activeTabId}
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
                      preUrl={currentEnv?.pre_url || ''}
                      onExtractVariable={handleExtractVariable}
                    />
                  )}

                {/* 3. Folder Workbench */}
                {activeFolder && activeTabId === activeFolder.target_id && (
                  <FolderWorkbench
                    key={activeFolder.target_id}
                    folder={activeFolder}
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
        onRefreshProjects={loadProjects}
      />

      <EnvModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        envs={envs}
        globalParams={globalParams}
        onSaveEnv={async (env) => {
          if (currentProject) {
            await window.mypostAPI.saveEnv(currentProject.project_id, env);
            const nextEnvs = await window.mypostAPI.getEnvs(currentProject.project_id);
            setEnvs(nextEnvs);
            if (currentEnv?.env_id === env.env_id) {
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

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        currentProject={currentProject}
        treeItems={treeItems}
      />
    </div>
  );
};
