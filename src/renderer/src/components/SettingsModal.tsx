import React, { useState } from 'react';
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
} from 'lucide-react';
import { ProjectInfo, ApiTreeNode } from '../../../common/types';
import { useTheme } from '../utils/themeManager';
import { useFeedback } from './FeedbackContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: ProjectInfo | null;
  treeItems: ApiTreeNode[];
}

type SettingsTab = 'project' | 'appearance' | 'system' | 'network' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  treeItems,
}) => {
  const { toast } = useFeedback();
  const { themeMode, setThemeMode } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('project');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
    return saved ? Number(saved) : 30000;
  });
  const [followRedirects, setFollowRedirects] = useState<boolean>(() => {
    const saved = localStorage.getItem('mypost:network:followRedirects');
    return saved !== null ? saved === 'true' : true;
  });
  const [sslVerify, setSslVerify] = useState<boolean>(() => {
    const saved = localStorage.getItem('mypost:network:sslVerify');
    return saved !== null ? saved === 'true' : false;
  });

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
  const safeTreeItems = treeItems || [];
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
      const m = item.method.toUpperCase();
      if (['GET', 'POST', 'PUT', 'DELETE'].includes(m)) {
        methodCounts[m] = (methodCounts[m] || 0) + 1;
      } else {
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
            title="关闭 (Esc)"
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
              v2026.10.19 Desktop
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-orange-500/15 text-accent border border-accent/30 flex items-center justify-center font-bold text-sm">
                            {currentProject.name?.substring(0, 1) || 'P'}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">
                              {currentProject.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {currentProject.intro || '暂无项目描述'}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          活动项目中
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-line text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line">
                          <span className="text-gray-400">项目标识 (ID):</span>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-200">
                            <span className="truncate max-w-[130px]">{currentProject.project_id}</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(currentProject.project_id, 'id', '项目 ID')
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
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line">
                          <span className="text-gray-400">创建时间:</span>
                          <span className="text-gray-200 font-mono text-[11px]">
                            {currentProject.created_at || '刚刚'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line text-xs">
                        <span className="text-gray-400 flex items-center gap-1 shrink-0">
                          <HardDrive className="w-3.5 h-3.5 text-accent" />
                          <span>本地存储目录:</span>
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300 truncate max-w-[340px]">
                          <span className="truncate" title={currentProject.path}>
                            {currentProject.path}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(currentProject.path, 'path', '项目存储目录')
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
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-foreground">主题与外观个性化</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    自由切换亮色、暗黑模式，或让应用自动跟随操作系统偏好
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-gray-300">主题色彩模式</div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setThemeMode('light')}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition ${
                        themeMode === 'light'
                          ? 'border-accent bg-accent/10 text-accent shadow-sm'
                          : 'border-line bg-subtle/40 text-gray-300 hover:bg-hover hover:border-gray-400/60'
                      }`}
                    >
                      <Sun className="w-5 h-5 text-amber-500" />
                      <span>亮色日间模式</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemeMode('dark')}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition ${
                        themeMode === 'dark'
                          ? 'border-accent bg-accent/10 text-accent shadow-sm'
                          : 'border-line bg-subtle/40 text-gray-300 hover:bg-hover hover:border-gray-400/60'
                      }`}
                    >
                      <Moon className="w-5 h-5 text-indigo-400" />
                      <span>暗黑夜间模式</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setThemeMode('system')}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition ${
                        themeMode === 'system'
                          ? 'border-accent bg-accent/10 text-accent shadow-sm'
                          : 'border-line bg-subtle/40 text-gray-300 hover:bg-hover hover:border-gray-400/60'
                      }`}
                    >
                      <Monitor className="w-5 h-5 text-emerald-400" />
                      <span>跟随系统设置</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-subtle/40 border border-line space-y-2 text-xs">
                  <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>设计语言说明</span>
                  </div>
                  <p className="text-gray-400 leading-relaxed text-[11px]">
                    mypost 遵循现代专业桌面软件标准，采用深色玻璃拟态（Glassmorphism）与高对比度色彩体系，专为长时间研发调试设计，提供舒适护眼的视觉体验。
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
                      <div className="text-gray-400 text-[11px]">单个 API 请求等待响应的最大毫秒数（默认 30,000 ms）</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={timeoutMs}
                        onChange={(e) => handleTimeoutChange(Number(e.target.value) || 30000)}
                        className="w-24 bg-surface border border-line rounded px-2.5 py-1 text-xs font-mono text-center text-foreground focus:outline-none focus:border-accent"
                      />
                      <span className="text-gray-400 text-[11px]">ms</span>
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

            {/* 4. 关于 mypost Tab */}
            {activeTab === 'about' && (
              <div className="space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-2xl bg-subtle border border-line flex items-center justify-center p-3 shadow-xl mx-auto">
                  <img src="./icon.svg" alt="mypost logo" className="w-full h-full object-contain" />
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-foreground">mypost 桌面工作台</h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Version 2026.10.19 (Release Build)</p>
                </div>

                <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">
                  专为个人打造的纯本地 API 调试与管理工具。无需登录与网络，数据本地明文 JSON 存储，支持 HTTP、SSE 与 WebSocket 全协议通信。
                </p>

                <div className="max-w-md mx-auto p-3.5 rounded-xl bg-subtle/50 border border-line text-xs grid grid-cols-2 gap-2 text-left">
                  <div className="text-gray-400">运行内核:</div>
                  <div className="text-gray-200 font-mono">Electron + Node.js</div>
                  <div className="text-gray-400">前端技术栈:</div>
                  <div className="text-gray-200 font-mono">React 19 + TypeScript + Vite</div>
                  <div className="text-gray-400">通信协议支持:</div>
                  <div className="text-gray-200 font-mono">HTTP / HTTPS / SSE / WebSocket</div>
                  <div className="text-gray-400">本地存储架构:</div>
                  <div className="text-gray-200 font-mono">纯本地结构化 JSON (支持 Git 协同)</div>
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
