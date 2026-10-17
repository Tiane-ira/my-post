import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Share2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Lock,
  Globe,
  Calendar,
  Folder,
  Plus,
  ShieldCheck,
  Server,
  Layers,
  Link2,
  Clock,
  Radio,
  FileCode,
  ArrowRight
} from 'lucide-react';
import { DocShareItem, ShareServerInfo, ProjectInfo } from '../../../common/types';
import { useFeedback } from './FeedbackContext';

interface ShareManagementPageProps {
  currentProject: ProjectInfo | null;
  onOpenShareModal: () => void;
  onNavigateToApis?: () => void;
}

export const ShareManagementPage: React.FC<ShareManagementPageProps> = ({
  currentProject,
  onOpenShareModal,
  onNavigateToApis,
}) => {
  const { confirm, toast } = useFeedback();
  const [shares, setShares] = useState<DocShareItem[]>([]);
  const [serverInfo, setServerInfo] = useState<ShareServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'protected' | 'expired'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPwdId, setCopiedPwdId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (window.mypostAPI?.listDocShares) {
        const list = await window.mypostAPI.listDocShares();
        setShares(list || []);
      }
      if (window.mypostAPI?.getShareServerInfo) {
        const info = await window.mypostAPI.getShareServerInfo();
        setServerInfo(info);
      }
    } catch (e) {
      console.error('Failed to load shared links:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleShareUpdated = () => {
      loadData();
    };
    window.addEventListener('mypost:share-created', handleShareUpdated);
    return () => {
      window.removeEventListener('mypost:share-created', handleShareUpdated);
    };
  }, [loadData]);

  const handleCopyUrl = (url: string, shareId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    toast.success('局域网链接已复制到剪贴板！');
    setTimeout(() => {
      setCopiedId((curr) => (curr === shareId ? null : curr));
    }, 1500);
  };

  const handleCopyPassword = (pwd: string, shareId: string) => {
    navigator.clipboard.writeText(pwd);
    setCopiedPwdId(shareId);
    toast.success('访问密码已复制！');
    setTimeout(() => {
      setCopiedPwdId((curr) => (curr === shareId ? null : curr));
    }, 1500);
  };

  const handleOpenBrowser = (url: string) => {
    if (window.mypostAPI?.openExternal) {
      window.mypostAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDeleteShare = async (share: DocShareItem) => {
    const ok = await confirm({
      title: '取消局域网分享',
      message: `确定要取消分享文档「${share.title}」吗？取消后该局域网链接将立即失效，其他局域网成员将无法继续访问。`,
      confirmText: '确定取消分享',
      cancelText: '保留',
      type: 'danger',
    });
    if (!ok) return;

    try {
      if (window.mypostAPI?.deleteDocShare) {
        await window.mypostAPI.deleteDocShare(share.shareId);
        toast.success('已取消该文档的局域网分享');
        loadData();
      }
    } catch (e) {
      toast.error('取消分享失败');
    }
  };

  const handleClearAll = async () => {
    if (shares.length === 0) return;
    const ok = await confirm({
      title: '清空所有已分享文档',
      message: `确定要清空全部 ${shares.length} 个局域网分享链接吗？所有链接将立即失效，且无法撤销。`,
      confirmText: '全部清空',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      if (window.mypostAPI?.clearAllDocShares) {
        await window.mypostAPI.clearAllDocShares();
        toast.success('已清空全部局域网分享链接');
        loadData();
      }
    } catch (e) {
      toast.error('清空分享失败');
    }
  };

  // Metrics
  const activeCount = useMemo(() => shares.filter((s) => !s.isExpired).length, [shares]);
  const protectedCount = useMemo(() => shares.filter((s) => Boolean(s.password)).length, [shares]);
  const totalApisCount = useMemo(
    () => shares.reduce((sum, item) => sum + (item.apiCount || 0), 0),
    [shares]
  );

  // Available project names for filtering
  const projectNames = useMemo(() => {
    const set = new Set<string>();
    shares.forEach((s) => {
      if (s.projectName) set.add(s.projectName);
    });
    return Array.from(set);
  }, [shares]);

  // Filtered List
  const filteredShares = useMemo(() => {
    return shares.filter((item) => {
      // 1. Status Filter
      if (statusFilter === 'active' && item.isExpired) return false;
      if (statusFilter === 'expired' && !item.isExpired) return false;
      if (statusFilter === 'protected' && !item.password) return false;

      // 2. Project Filter
      if (selectedProject !== 'all' && item.projectName !== selectedProject) return false;

      // 3. Search Query
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesProject = item.projectName && item.projectName.toLowerCase().includes(q);
        const matchesShareId = item.shareId.toLowerCase().includes(q);
        const matchesUrl = item.lanUrl && item.lanUrl.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesShareId && !matchesUrl) return false;
      }

      return true;
    });
  }, [shares, statusFilter, selectedProject, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-y-auto select-none">
      {/* Top Banner / Page Header */}
      <div className="bg-sidebar border-b border-line px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0 shadow-lg shadow-orange-500/10">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">
                  局域网文档分享管理
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  局域网服务运行中
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-2xl">
                管理当前设备对外共享的接口文档链接。同局域网内的前端开发、测试与产品人员可通过浏览器在线查阅，参数及示例与本地工程实时同步。
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-subtle hover:bg-hover border border-line text-xs font-medium text-gray-300 hover:text-foreground transition flex items-center gap-1.5 disabled:opacity-50"
              title="刷新已分享列表"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
              <span>刷新列表</span>
            </button>

            {shares.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-400 transition flex items-center gap-1.5"
                title="清空全部分享链接"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空全部</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenShareModal}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition shadow-lg shadow-orange-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>新建文档分享</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-8 py-6 flex flex-col gap-6">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Server Status */}
          <div className="bg-card border border-line rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">局域网服务地址</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <div className="font-mono text-sm font-bold text-gray-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {serverInfo?.primaryIp || '127.0.0.1'}:{serverInfo?.port || 30990}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                同一 Wi-Fi / 局域网设备均可直接访问
              </div>
            </div>
          </div>

          {/* Card 2: Active Shares */}
          <div className="bg-card border border-line rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">当前活跃分享</span>
              <Radio className="w-4 h-4 text-accent" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-gray-100 font-mono">
                {activeCount} <span className="text-xs font-normal text-gray-400">个文档</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                共记录 {shares.length} 个历史分享
              </div>
            </div>
          </div>

          {/* Card 3: Total APIs Shared */}
          <div className="bg-card border border-line rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">对外共享接口数</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-blue-400 font-mono">
                {totalApisCount} <span className="text-xs font-normal text-gray-400">个接口</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                覆盖全部已分享文档中的接口定义
              </div>
            </div>
          </div>

          {/* Card 4: Protected Shares */}
          <div className="bg-card border border-line rounded-xl p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">密码安全保护</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-400 font-mono">
                {protectedCount} <span className="text-xs font-normal text-gray-400">/ {shares.length}</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                需凭密码访问的受保护文档
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-card border border-line rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-subtle p-1 rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              全部 ({shares.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                statusFilter === 'active'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              🟢 活跃中 ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('protected')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                statusFilter === 'protected'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              🔒 密码保护 ({protectedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                statusFilter === 'expired'
                  ? 'bg-accent text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              🔴 已过期 ({shares.length - activeCount})
            </button>
          </div>

          {/* Search & Project Filter */}
          <div className="flex items-center gap-3">
            {projectNames.length > 0 && (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-subtle border border-line rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-accent"
              >
                <option value="all">所有项目</option>
                {projectNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="搜索标题、项目名称或链接..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-subtle border border-line rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Share Items Table / List */}
        {filteredShares.length === 0 ? (
          <div className="bg-card border border-line rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-subtle border border-line flex items-center justify-center text-gray-400 mb-4 shadow-inner">
              <Share2 className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-gray-200 mb-1">
              {searchQuery || statusFilter !== 'all' || selectedProject !== 'all'
                ? '没有找到符合条件的分享链接'
                : '暂无已分享的局域网文档链接'}
            </h3>
            <p className="text-xs text-gray-500 max-w-md mb-6 leading-relaxed">
              {searchQuery || statusFilter !== 'all' || selectedProject !== 'all'
                ? '请尝试清除筛选条件或更换搜索关键词。'
                : '您可以前往「APIs」接口管理页面，右键任意目录或接口，或者点击右上角分享按钮，即可生成局域网分享链接供团队访问。'}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenShareModal}
                className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition shadow-lg shadow-orange-500/20 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>立即分享文档</span>
              </button>
              {onNavigateToApis && (
                <button
                  type="button"
                  onClick={onNavigateToApis}
                  className="px-4 py-2.5 rounded-xl bg-subtle hover:bg-hover border border-line text-xs font-semibold text-gray-300 hover:text-foreground transition flex items-center gap-1.5"
                >
                  <FileCode className="w-4 h-4 text-accent" />
                  <span>前往接口列表</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-line rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-subtle/60 text-gray-400 font-semibold text-[11px]">
                    <th className="py-3 px-4">分享文档名称</th>
                    <th className="py-3 px-4">所属项目</th>
                    <th className="py-3 px-4">包含接口</th>
                    <th className="py-3 px-4">访问权限</th>
                    <th className="py-3 px-4">局域网链接</th>
                    <th className="py-3 px-4">有效期限</th>
                    <th className="py-3 px-4">创建时间</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filteredShares.map((item) => {
                    const isCopied = copiedId === item.shareId;
                    const isPwdCopied = copiedPwdId === item.shareId;
                    const formattedDate = new Date(item.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr
                        key={item.shareId}
                        className={`hover:bg-hover/60 transition ${
                          item.isExpired ? 'opacity-60 bg-subtle/30' : ''
                        }`}
                      >
                        {/* Title & Badges */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 max-w-[260px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-bold text-gray-200 truncate hover:text-accent transition cursor-pointer"
                                title={item.title}
                                onClick={() => handleOpenBrowser(item.lanUrl)}
                              >
                                {item.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              {item.isExpired ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25 font-semibold">
                                  已过期
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold">
                                  活跃中
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-subtle text-gray-400 border border-line">
                                {item.scope === 'project' ? '📁 根目录全量' : '📂 指定目录'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Project */}
                        <td className="py-3 px-4 text-gray-300">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Folder className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                            {item.projectName || '默认项目'}
                          </span>
                        </td>

                        {/* API Count */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono text-[11px] font-semibold border border-blue-500/25">
                            {item.apiCount} 个接口
                          </span>
                        </td>

                        {/* Auth / Password */}
                        <td className="py-3 px-4">
                          {item.password ? (
                            <div className="flex items-center gap-1.5 text-amber-400">
                              <Lock className="w-3.5 h-3.5" />
                              <span className="font-mono bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                {item.password}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(item.password!, item.shareId)}
                                className="p-1 hover:bg-hover rounded text-gray-400 hover:text-amber-300 transition"
                                title="复制访问密码"
                              >
                                {isPwdCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                              <Globe className="w-3.5 h-3.5 text-blue-400/80" />
                              公开无密码
                            </span>
                          )}
                        </td>

                        {/* LAN Link */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 max-w-[280px]">
                            <span
                              className="font-mono text-[11px] text-gray-300 bg-background/80 border border-line px-2 py-1 rounded truncate flex-1 select-all"
                              title={item.lanUrl}
                            >
                              {item.lanUrl}
                            </span>
                          </div>
                        </td>

                        {/* Expiry */}
                        <td className="py-3 px-4 text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span>
                              {item.expiresAt
                                ? `${Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 86400000))} 天后到期`
                                : '永久有效'}
                            </span>
                          </div>
                        </td>

                        {/* Created At */}
                        <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                          {formattedDate}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(item.lanUrl, item.shareId)}
                              className="px-2.5 py-1 rounded-md bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold flex items-center gap-1 transition border border-accent/25"
                              title="复制局域网分享链接"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>复制链接</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenBrowser(item.lanUrl)}
                              className="px-2.5 py-1 rounded-md bg-subtle hover:bg-hover text-gray-300 hover:text-foreground text-xs flex items-center gap-1 transition border border-line"
                              title="在浏览器中打开页面"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>打开</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteShare(item)}
                              className="p-1.5 rounded-md hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition"
                              title="取消分享此文档"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
