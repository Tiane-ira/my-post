import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Layers,
  Palette,
  Globe,
  Info,
  Copy,
  Check,
  HardDrive,
  Sun,
  Moon,
  Monitor,
  Folder,
  Radio,
  Zap,
  Sparkles,
  ShieldCheck,
  Activity,
  Sliders,
  Power,
  AppWindow,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Download,
  Edit2,
  Save,
} from 'lucide-react';
import { ProjectInfo, ApiTreeNode } from '../../../common/types';
import { useTheme } from '../utils/themeManager';
import { useFeedback } from './FeedbackContext';
import {
  APP_VERSION,
  GITHUB_REPO_URL,
  GITHUB_RELEASES_URL,
  checkForUpdates,
  getAutoCheckEnabled,
  setAutoCheckEnabled,
  getLastCheckedTimestamp,
  UpdateCheckResult,
} from '../utils/updateChecker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: ProjectInfo | null;
  treeItems: ApiTreeNode[];
  onOpenProjectModal?: () => void;
  onUpdateProject?: (projectId: string, updates: { name: string; intro: string }) => Promise<ProjectInfo | null>;
}

type SettingsTab = 'project' | 'appearance' | 'system' | 'network' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  treeItems,
  onOpenProjectModal,
  onUpdateProject,
}) => {
  const { toast } = useFeedback();
  const { themeMode, setThemeMode, themePresetId, setThemePreset, presets, activePreset } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('project');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Project editing state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjName, setEditProjName] = useState('');
  const [editProjIntro, setEditProjIntro] = useState('');
  const [isSavingProj, setIsSavingProj] = useState(false);

  const handleStartEditProject = () => {
    if (!currentProject) return;
    setEditProjName(currentProject.name || '');
    setEditProjIntro(currentProject.intro || '');
    setIsEditingProject(true);
  };

  const handleSaveEditProject = async () => {
    if (!currentProject) return;
    if (!editProjName.trim()) {
      toast.warning('项目名称不能为空');
      return;
    }
    setIsSavingProj(true);
    try {
      if (onUpdateProject) {
        await onUpdateProject(currentProject.project_id, {
          name: editProjName.trim(),
          intro: editProjIntro.trim(),
        });
      } else {
        await window.mypostAPI.updateProject(currentProject.project_id, {
          name: editProjName.trim(),
          intro: editProjIntro.trim(),
        });
      }
      setIsEditingProject(false);
    } catch (err: any) {
      toast.error(`更新项目失败: ${err?.message || err}`);
    } finally {
      setIsSavingProj(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // System & Tray preference with persistence
  const [closeToTray, setCloseToTray] = useState<boolean>(() => {
    const saved = localStorage.getItem('mypost:system:closeToTray');
    return saved !== null ? saved === 'true' : true;
  });

  const handleCloseToTrayChange = (val: boolean) => {
    setCloseToTray(val);
    localStorage.setItem('mypost:system:closeToTray', String(val));
    if (window.mypostAPI?.setCloseToTray) {
      window.mypostAPI.setCloseToTray(val);
    }
    toast.success(val ? '已开启关闭退出到托盘' : '已关闭退出到托盘（关闭窗口直接退出）');
  };

  // Network preferences with persistence in localStorage
  const [timeoutMs, setTimeoutMs] = useState<number>(() => {
    const saved = localStorage.getItem('mypost:network:timeout');
    return saved !== null ? Number(saved) : 0;
  });
  const [followRedirects, setFollowRedirects] = useState<boolean>(() => {
    const saved = localStorage.getItem('mypost:network:followRedirects');
    return saved !== null ? saved === 'true' : true;
  });
  const [sslVerify, setSslVerify] = useState<boolean>(() => {
    const saved = localStorage.getItem('mypost:network:sslVerify');
    return saved !== null ? saved === 'true' : false;
  });

  // Software update state (defaults to false for auto-check)
  const [autoCheckUpdates, setAutoCheckUpdates] = useState<boolean>(() => getAutoCheckEnabled());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<number | null>(() => getLastCheckedTimestamp());

  const handleToggleAutoCheck = (enabled: boolean) => {
    setAutoCheckUpdates(enabled);
    setAutoCheckEnabled(enabled);
    if (enabled) {
      toast.success('已开启启动时自动检测新版本');
    } else {
      toast.info('已关闭自动检测新版本');
    }
  };

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateResult(null);
    try {
      const res = await checkForUpdates();
      setUpdateResult(res);
      setLastCheckedTime(res.checkedAt);
      if (res.hasUpdate) {
        toast.success(`发现新版本 v${res.latestVersion}！`);
      } else if (res.success) {
        toast.info('当前已是最新版本');
      } else {
        toast.error(`检测更新未成功: ${res.error || '无法连接 GitHub'}`);
      }
    } catch (err: any) {
      const errMsg = err?.message || '检查更新发生异常';
      setUpdateResult({
        success: false,
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        checkedAt: Date.now(),
        error: errMsg,
      });
      toast.error(errMsg);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleOpenGithub = () => {
    if (window.mypostAPI?.openExternal) {
      window.mypostAPI.openExternal(GITHUB_REPO_URL);
    } else {
      window.open(GITHUB_REPO_URL, '_blank');
    }
  };

  const handleOpenRelease = (url?: string) => {
    const targetUrl = url || GITHUB_RELEASES_URL;
    if (window.mypostAPI?.openExternal) {
      window.mypostAPI.openExternal(targetUrl);
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`已复制 ${label}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTimeoutChange = (val: number) => {
    setTimeoutMs(val);
    localStorage.setItem('mypost:network:timeout', String(val));
  };

  const handleFollowRedirectsChange = (val: boolean) => {
    setFollowRedirects(val);
    localStorage.setItem('mypost:network:followRedirects', String(val));
  };

  const handleSslVerifyChange = (val: boolean) => {
    setSslVerify(val);
    localStorage.setItem('mypost:network:sslVerify', String(val));
  };

  // Calibrate Metrics according to current workspace
  const safeTreeItems = (Array.isArray(treeItems) ? treeItems : []).filter(
    (i): i is ApiTreeNode => Boolean(i && typeof i === 'object')
  );
  const totalHttpApis = safeTreeItems.filter((i) => !i.target_type || i.target_type === 'api').length;
  const totalSse = safeTreeItems.filter((i) => i.target_type === 'sse').length;
  const totalWs = safeTreeItems.filter((i) => i.target_type === 'websocket').length;
  const totalFolders = safeTreeItems.filter((i) => i.target_type === 'folder').length;

  const methodCounts: Record<string, number> = {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    OTHER: 0,
  };

  safeTreeItems.forEach((item) => {
    if ((!item.target_type || item.target_type === 'api') && item.method) {
      const m = (typeof item.method === 'string' ? item.method : '').toUpperCase();
      if (['GET', 'POST', 'PUT', 'DELETE'].includes(m)) {
        methodCounts[m] = (methodCounts[m] || 0) + 1;
      } else if (m) {
        methodCounts.OTHER = (methodCounts.OTHER || 0) + 1;
      }
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-3xl h-[560px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-13 px-5 border-b border-line flex items-center justify-between bg-subtle/50 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">应用与项目设置</div>
              <div className="text-[11px] text-gray-400">配置项目属性、外观主题与请求引擎</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-hover transition"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Body: Left-Right Multi-Tab Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Bar */}
          <div className="w-48 bg-subtle/40 border-r border-line p-3 flex flex-col justify-between shrink-0 select-none">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('project')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'project'
                    ? 'bg-accent text-white shadow-md shadow-orange-500/15'
                    : 'text-gray-400 hover:text-foreground hover:bg-hover'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>项目概览</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('appearance')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'appearance'
                    ? 'bg-accent text-white shadow-md shadow-orange-500/15'
                    : 'text-gray-400 hover:text-foreground hover:bg-hover'
                }`}
              >
                <Palette className="w-4 h-4 shrink-0" />
                <span>界面外观</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('system')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'system'
                    ? 'bg-accent text-white shadow-md shadow-orange-500/15'
                    : 'text-gray-400 hover:text-foreground hover:bg-hover'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>系统与托盘</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('network')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'network'
                    ? 'bg-accent text-white shadow-md shadow-orange-500/15'
                    : 'text-gray-400 hover:text-foreground hover:bg-hover'
                }`}
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>网络与连接</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'about'
                    ? 'bg-accent text-white shadow-md shadow-orange-500/15'
                    : 'text-gray-400 hover:text-foreground hover:bg-hover'
                }`}
              >
                <Info className="w-4 h-4 shrink-0" />
                <span>关于 mypost</span>
              </button>
            </div>

            <div className="text-[10px] text-gray-500 text-center font-mono py-1">
              v{APP_VERSION} Desktop
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 overflow-y-auto p-6 bg-surface">
            {/* 1. 项目概览 Tab */}
            {activeTab === 'project' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-foreground">当前项目详细信息</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    查看当前工作空间的元数据、本地存储归属与全协议接口数量统计
                  </p>
                </div>

                {currentProject ? (
                  <div className="space-y-4">
                    {/* Project Basic Info Card */}
                    <div className="bg-subtle/50 border border-line rounded-xl p-4 space-y-3">
                      {isEditingProject ? (
                        <div className="space-y-3 bg-surface p-3 rounded-lg border border-accent/40">
                          <div className="font-bold text-xs text-accent flex items-center gap-1.5">
                            <Edit2 className="w-3.5 h-3.5" />
                            编辑当前项目信息
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] text-gray-400 mb-1">项目名称 *</label>
                              <input
                                type="text"
                                value={editProjName}
                                onChange={(e) => setEditProjName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditProject();
                                  if (e.key === 'Escape') setIsEditingProject(false);
                                }}
                                className="w-full bg-subtle border border-line rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-400 mb-1">项目说明 / 描述</label>
                              <input
                                type="text"
                                value={editProjIntro}
                                onChange={(e) => setEditProjIntro(e.target.value)}
                                placeholder="输入项目简短描述"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditProject();
                                  if (e.key === 'Escape') setIsEditingProject(false);
                                }}
                                className="w-full bg-subtle border border-line rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-accent"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsEditingProject(false)}
                              disabled={isSavingProj}
                              className="px-2.5 py-1 rounded bg-hover hover:bg-line text-gray-300 text-xs transition"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditProject}
                              disabled={isSavingProj}
                              className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Save className="w-3 h-3" />
                              {isSavingProj ? '保存中...' : '保存'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-orange-500/15 text-accent border border-accent/30 flex items-center justify-center font-bold text-sm">
                              {typeof currentProject.name === 'string' && currentProject.name ? currentProject.name.substring(0, 1).toUpperCase() : 'P'}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground">
                                {typeof currentProject.name === 'string' ? currentProject.name : '未命名项目'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {typeof currentProject.intro === 'string' && currentProject.intro ? currentProject.intro : '暂无项目描述'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleStartEditProject}
                              className="px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-accent flex items-center gap-1 text-xs transition"
                              title="修改项目名称与描述"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              编辑信息
                            </button>
                            {onOpenProjectModal && (
                              <button
                                type="button"
                                onClick={onOpenProjectModal}
                                className="px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground flex items-center gap-1 text-xs transition"
                                title="切换或新建项目"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                切换/管理项目
                              </button>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              活动项目中
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-line text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line">
                          <span className="text-gray-400">项目标识 (ID):</span>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-200">
                            <span className="truncate max-w-[130px]">{typeof currentProject.project_id === 'string' ? currentProject.project_id : '-'}</span>
                            {currentProject.project_id && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(String(currentProject.project_id), 'id', '项目 ID')
                                }
                                className="text-gray-400 hover:text-accent p-0.5"
                                title="复制项目 ID"
                              >
                                {copiedKey === 'id' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line">
                          <span className="text-gray-400">创建时间:</span>
                          <span className="text-gray-200 font-mono text-[11px]">
                            {typeof currentProject.created_at === 'string' ? currentProject.created_at : '刚刚'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line text-xs">
                        <span className="text-gray-400 flex items-center gap-1 shrink-0">
                          <HardDrive className="w-3.5 h-3.5 text-accent" />
                          <span>本地存储目录:</span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300 truncate max-w-[340px]">
                          <span className="truncate" title={typeof currentProject.path === 'string' ? currentProject.path : ''}>
                            {typeof currentProject.path === 'string' ? currentProject.path : '未设置存储目录'}
                          </span>
                          {currentProject.path && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(String(currentProject.path), 'path', '项目存储目录')
                              }
                              className="text-gray-400 hover:text-accent p-0.5 shrink-0"
                              title="复制存储目录路径"
                            >
                              {copiedKey === 'path' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Calibrated Resource Statistics Card */}
                    <div>
                      <div className="text-xs font-bold text-gray-300 mb-2">多协议接口与分类统计</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        <div className="p-3 rounded-xl bg-subtle/50 border border-line text-center">
                          <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                            <Activity className="w-3 h-3 text-orange-400" />
                            <span>HTTP 接口</span>
                          </div>
                          <div className="text-xl font-extrabold text-foreground mt-1">
                            {totalHttpApis}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-subtle/50 border border-line text-center">
                          <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                            <Zap className="w-3 h-3 text-sky-400" />
                            <span>SSE 流式</span>
                          </div>
                          <div className="text-xl font-extrabold text-sky-400 mt-1">
                            {totalSse}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-subtle/50 border border-line text-center">
                          <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                            <Radio className="w-3 h-3 text-teal-400" />
                            <span>WebSocket</span>
                          </div>
                          <div className="text-xl font-extrabold text-teal-400 mt-1">
                            {totalWs}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-subtle/50 border border-line text-center">
                          <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                            <Folder className="w-3 h-3 text-gray-400" />
                            <span>目录分组</span>
                          </div>
                          <div className="text-xl font-extrabold text-gray-300 mt-1">
                            {totalFolders}
                          </div>
                        </div>
                      </div>

                      {/* HTTP Method distribution */}
                      <div className="mt-3 p-3 rounded-xl bg-subtle/30 border border-line flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-medium">HTTP 请求方法分布:</span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                            GET: {methodCounts.GET}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                            POST: {methodCounts.POST}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">
                            PUT: {methodCounts.PUT}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400">
                            DELETE: {methodCounts.DELETE}
                          </span>
                          {methodCounts.OTHER > 0 && (
                            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400">
                              其他: {methodCounts.OTHER}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-xs border border-dashed border-line rounded-xl">
                    未选择当前项目
                  </div>
                )}
              </div>
            )}

            {/* 2. 界面外观 Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-foreground">主题与外观个性化</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    自由切换亮色、暗黑模式，或选择精心调配的色彩主题，实时应用生效
                  </p>
                </div>

                {/* 模式选择 */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-gray-300">模式偏好</div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setThemeMode('light')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition ${
                        themeMode === 'light'
                          ? 'border-accent bg-accent/10 text-accent shadow-sm'
                          : 'border-line bg-subtle/40 text-gray-300 hover:bg-hover hover:border-gray-400/60'
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>亮色日间模式</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemeMode('dark')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition ${
                        themeMode === 'dark'
                          ? 'border-accent bg-accent/10 text-accent shadow-sm'
                          : 'border-line bg-subtle/40 text-gray-300 hover:bg-hover hover:border-gray-400/60'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span>暗黑夜间模式</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemeMode('system')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition ${
                        themeMode === 'system'
                          ? 'border-accent bg-accent/10 text-accent shadow-sm'
                          : 'border-line bg-subtle/40 text-gray-300 hover:bg-hover hover:border-gray-400/60'
                      }`}
                    >
                      <Monitor className="w-4 h-4 text-emerald-400" />
                      <span>跟随系统设置</span>
                    </button>
                  </div>
                </div>

                {/* 精选预设主题 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-accent" />
                      <span>工作台精选主题库</span>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      当前激活: {activePreset.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {presets.map((preset) => {
                      const isActive = themePresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setThemePreset(preset.id)}
                          className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between relative overflow-hidden group ${
                            isActive
                              ? 'border-accent bg-accent/10 shadow-md ring-1 ring-accent/30'
                              : 'border-line bg-subtle/40 hover:bg-hover hover:border-gray-400/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">
                                  {preset.name}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
                                    preset.type === 'dark'
                                      ? 'bg-gray-800 text-gray-300 border-gray-700'
                                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  }`}
                                >
                                  {preset.type === 'dark' ? 'Dark' : 'Light'}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                                {preset.subtitle}
                              </div>
                            </div>

                            {isActive ? (
                              <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-line group-hover:border-accent/40 shrink-0 transition" />
                            )}
                          </div>

                          {/* Color Palette Preview Swatches */}
                          <div className="flex items-center gap-2 pt-2 border-t border-line/60">
                            <span className="text-[10px] text-gray-500 font-mono">色盘:</span>
                            <div className="flex items-center gap-1.5">
                              {/* Canvas swatch */}
                              <div
                                className="w-4 h-4 rounded border shadow-xs"
                                style={{
                                  backgroundColor: preset.previewColors.canvas,
                                  borderColor: preset.previewColors.border,
                                }}
                                title="画布底色"
                              />
                              {/* Surface swatch */}
                              <div
                                className="w-4 h-4 rounded border shadow-xs"
                                style={{
                                  backgroundColor: preset.previewColors.surface,
                                  borderColor: preset.previewColors.border,
                                }}
                                title="卡片容器色"
                              />
                              {/* Accent swatch */}
                              <div
                                className="w-4 h-4 rounded shadow-xs"
                                style={{ backgroundColor: preset.previewColors.accent }}
                                title="品牌强调色"
                              />
                              {/* Text swatch */}
                              <div
                                className="w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] border shadow-xs"
                                style={{
                                  backgroundColor: preset.previewColors.surface,
                                  color: preset.previewColors.text,
                                  borderColor: preset.previewColors.border,
                                }}
                                title="文字主色"
                              >
                                Aa
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-subtle/40 border border-line space-y-2 text-xs">
                  <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>统一设计系统与主题架构说明</span>
                  </div>
                  <p className="text-gray-400 leading-relaxed text-[11px]">
                    mypost 遵循设计系统原则，提取全局语义色彩 Tokens（画布底色 <code className="text-accent font-mono">--color-canvas</code>、卡片容器 <code className="text-accent font-mono">--color-surface</code>、边框线 <code className="text-accent font-mono">--color-line</code>、主色调 <code className="text-accent font-mono">--color-accent</code>）。无论切换至哪款主题，HTTP、SSE 与 WebSocket 工作台的视觉对比度、字体层级与操作按钮均保持 100% 体验一致性。
                  </p>
                </div>
              </div>
            )}

            {/* 3. 系统与托盘 Tab */}
            {activeTab === 'system' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-foreground">系统与托盘偏好</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    配置窗口关闭行为、后台驻留运行以及系统托盘行为
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-subtle/40 border border-line">
                    <div className="space-y-0.5 pr-4">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>关闭主窗口时退出到系统托盘</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 font-normal">推荐</span>
                      </div>
                      <div className="text-gray-400 text-[11px] leading-relaxed">
                        点击窗口右上角关闭按钮（X）时，将应用最小化隐藏至系统任务栏托盘。文档分享服务将在后台持续运行不中断。
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={closeToTray}
                        onChange={(e) => handleCloseToTrayChange(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>

                  {/* Tray quick guide */}
                  <div className="p-4 rounded-xl bg-subtle/30 border border-line space-y-2 text-xs">
                    <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                      <AppWindow className="w-4 h-4 text-accent" />
                      <span>系统托盘快捷交互说明</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-surface border border-line space-y-1">
                        <div className="font-bold text-gray-200">鼠标单击托盘图标</div>
                        <div className="text-gray-400 leading-relaxed">若主窗口隐藏则唤醒并聚焦，若当前已处于前台聚焦状态则快速收起隐藏。</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface border border-line space-y-1">
                        <div className="font-bold text-gray-200">鼠标双击托盘图标</div>
                        <div className="text-gray-400 leading-relaxed">立刻恢复主窗口并置于屏幕最前台展示。</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface border border-line space-y-1">
                        <div className="font-bold text-gray-200">鼠标右键托盘图标</div>
                        <div className="text-gray-400 leading-relaxed">呼出托盘上下文菜单，支持快速显示主窗口、最小化到托盘以及彻底退出应用。</div>
                      </div>
                    </div>
                  </div>

                  {/* Exit application action */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div>
                      <div className="font-semibold text-rose-300">彻底退出 mypost</div>
                      <div className="text-gray-400 text-[11px]">关闭主窗口并终止所有正在后台运行的文档分享服务</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.mypostAPI?.quitApp) {
                          window.mypostAPI.quitApp();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>退出程序</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. 网络与连接 Tab */}
            {activeTab === 'network' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-foreground">请求执行与连接配置</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    管理 HTTP/HTTPS 客户端超时时间、重定向以及流式长连接特性
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-subtle/40 border border-line">
                    <div>
                      <div className="font-semibold text-foreground">请求超时时间 (Timeout)</div>
                      <div className="text-gray-400 text-[11px]">单个 API 请求等待响应的最大毫秒数（填 0 为无超时限制，支持在响应区手动取消）</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={timeoutMs}
                        onChange={(e) => handleTimeoutChange(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        className="w-24 bg-surface border border-line rounded px-2.5 py-1 text-xs font-mono text-center text-foreground focus:outline-none focus:border-accent"
                      />
                      <span className="text-gray-400 text-[11px]">{timeoutMs === 0 ? '不限制' : 'ms'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-subtle/40 border border-line">
                    <div>
                      <div className="font-semibold text-foreground">自动跟随重定向 (Follow Redirects)</div>
                      <div className="text-gray-400 text-[11px]">收到 301/302/307 等跳转状态码时自动追踪下一目标地址</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={followRedirects}
                        onChange={(e) => handleFollowRedirectsChange(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-subtle/40 border border-line">
                    <div>
                      <div className="font-semibold text-foreground">严格 SSL 证书验证 (SSL Verification)</div>
                      <div className="text-gray-400 text-[11px]">测试自签名证书或本地 HTTPS 开发服务时可关闭该项</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sslVerify}
                        onChange={(e) => handleSslVerifyChange(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>

                  <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs space-y-1.5">
                    <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-teal-400" />
                      <span>原生流式长连接引擎支持</span>
                    </div>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      mypost 具备 Node.js 原生 IPC 流式中继桥接能力，支持 SSE（Server-Sent Events）与全双工 WebSocket 长连接。即使切换标签页，已建立的连接与心跳保活依然在后台平稳运行，无需担心数据丢失或断连。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. 关于 mypost Tab */}
            {activeTab === 'about' && (
              <div className="space-y-5 text-left py-1">
                {/* Brand Header */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-subtle/50 border border-line">
                  <div className="w-14 h-14 rounded-2xl bg-surface border border-line flex items-center justify-center p-2.5 shadow-lg shrink-0">
                    <img src="./icon.svg" alt="mypost logo" className="w-full h-full object-contain" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-extrabold text-foreground">mypost 桌面工作台</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-accent/15 text-accent border border-accent/30">
                        v{APP_VERSION}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>纯本地离线版</span>
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      专为个人开发者量身打造的轻量、专注、纯本地 API 研发与调试工作台。无需登录，数据本地明文存储，天然拥抱 Git 协同。
                    </p>
                  </div>
                </div>

                {/* 1. GitHub 官方开源仓库卡片 */}
                <div className="p-4 rounded-xl bg-subtle/40 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-foreground shrink-0 shadow-xs">
                      {/* GitHub Official SVG Icon */}
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <span>GitHub 开源仓库</span>
                        <span className="text-[10px] text-gray-400 font-mono">Tiane-ira/my-post</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        欢迎 Star 关注动态、提交 Issue 反馈缺陷或发起 Pull Request
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(GITHUB_REPO_URL, 'github', 'GitHub 仓库地址')}
                      className="px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-hover text-gray-300 hover:text-foreground text-xs flex items-center gap-1 transition"
                      title="复制仓库链接"
                    >
                      {copiedKey === 'github' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'github' ? '已复制' : '复制地址'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenGithub}
                      className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                      title="在浏览器中访问 GitHub 仓库"
                    >
                      <span>访问 GitHub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. 软件版本更新与检测卡片 */}
                <div className="p-4 rounded-xl bg-subtle/40 border border-line space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 text-accent ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                      <span className="font-bold text-xs text-foreground">软件版本与更新检测</span>
                      <span className="text-[10px] text-gray-400 font-mono bg-surface px-1.5 py-0.5 rounded border border-line">
                        当前: v{APP_VERSION}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualCheckUpdate}
                      disabled={isCheckingUpdate}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-hover border border-line text-xs font-semibold text-foreground flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-accent ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                      <span>{isCheckingUpdate ? '正在检查...' : '检查更新'}</span>
                    </button>
                  </div>

                  {/* 自动检测开关 (默认关闭) */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-line text-xs">
                    <div className="pr-4 space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>启动应用时自动检测新版本更新</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-subtle text-gray-400 font-normal">默认关闭</span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        开启后，每次冷启动将静默查询 GitHub Releases；关闭状态下完全不发起任何网络检查，彻底保障离线静默体验。
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={autoCheckUpdates}
                        onChange={(e) => handleToggleAutoCheck(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                    </label>
                  </div>

                  {/* 检测结果反馈卡片 */}
                  {isCheckingUpdate ? (
                    <div className="p-3 rounded-lg bg-surface border border-accent/30 text-xs flex items-center gap-2 text-accent animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>正在连接 GitHub Releases 查询最新版本信息...</span>
                    </div>
                  ) : updateResult ? (
                    updateResult.hasUpdate ? (
                      /* 发现新版本 */
                      <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 space-y-2.5 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-xs text-accent">
                            <Sparkles className="w-4 h-4" />
                            <span>发现可用新版本: v{updateResult.latestVersion}</span>
                          </div>
                          {updateResult.publishedAt && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              发布于: {new Date(updateResult.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {updateResult.releaseNotes && (
                          <div className="text-[11px] text-gray-300 bg-surface/80 p-2.5 rounded-lg border border-line max-h-32 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed select-text">
                            {updateResult.releaseNotes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenRelease(updateResult.downloadUrl || updateResult.releaseUrl)}
                            className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>前往 GitHub 下载更新</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenRelease(updateResult.releaseUrl)}
                            className="px-3 py-1.5 rounded-lg bg-surface hover:bg-hover border border-line text-xs text-gray-300 hover:text-foreground flex items-center gap-1 transition"
                          >
                            <span>查看更新日志</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : updateResult.success ? (
                      /* 已是最新版本 */
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between text-emerald-400">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>太棒了！当前已是最新版本 (v{APP_VERSION})</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">刚刚检查</span>
                      </div>
                    ) : (
                      /* 检查失败 / 离线 */
                      <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between gap-2 text-rose-400">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{updateResult.error || '检查更新失败，请确认网络连接'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleManualCheckUpdate}
                          className="px-2 py-1 rounded bg-surface hover:bg-hover border border-rose-500/30 text-rose-300 text-[11px] font-medium"
                        >
                          重试
                        </button>
                      </div>
                    )
                  ) : (
                    /* 初始空闲状态 */
                    <div className="text-[11px] text-gray-400 flex items-center justify-between px-1">
                      <span>可点击右上角“检查更新”按钮即时检测 GitHub 最新版本</span>
                      <span className="font-mono text-[10px]">
                        上次检测: {lastCheckedTime ? new Date(lastCheckedTime).toLocaleString() : '暂未检查'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. 核心能力与特色亮点 */}
                <div>
                  <div className="text-xs font-bold text-gray-300 mb-2.5">核心架构与能力矩阵</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-subtle/50 border border-line space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-orange-400" />
                        <span>全协议栈通信支持</span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        完整支持 HTTP/HTTPS 常见方法、SSE 流式事件帧与全双工 WebSocket 长连接实时通信。
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-subtle/50 border border-line space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                        <span>纯本地数据隐私</span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        零云端依赖与遥测追踪，明文结构化 JSON 本地存储，天生拥抱 Git 版本管理与团队协同。
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-subtle/50 border border-line space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-sky-400" />
                        <span>目录继承与参数补全</span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        祖先目录参数与 Headers 自顶向下继承，内置数十种常见 Header 规范键与值候选智能补全。
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-subtle/50 border border-line space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-purple-400" />
                        <span>局域网免密在线分享</span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">
                        内置轻量极速 HTTP 静态分享引擎，一键生成美化在线文档，便于跨设备与局域网移动端自测。
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. 技术栈规格一览 */}
                <div className="p-3.5 rounded-xl bg-subtle/50 border border-line text-xs grid grid-cols-2 gap-2 text-left">
                  <div className="text-gray-400">运行内核:</div>
                  <div className="text-gray-200 font-mono">Electron + Node.js (原生 IPC 流式中继桥接)</div>
                  <div className="text-gray-400">前端技术栈:</div>
                  <div className="text-gray-200 font-mono">React 19 + TypeScript + Vite + Tailwind CSS</div>
                  <div className="text-gray-400">本地存储架构:</div>
                  <div className="text-gray-200 font-mono">纯本地结构化 JSON (支持直接提交至 Git)</div>
                  <div className="text-gray-400">开源协议:</div>
                  <div className="text-gray-200 font-mono">MIT Open Source License</div>
                  <div className="text-gray-400">运行状态与隐私:</div>
                  <div className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>100% 离线就绪 · 零外部追踪</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
