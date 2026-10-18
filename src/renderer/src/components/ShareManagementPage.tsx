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
  Plus,
  Folder,
  Clock,
  Radio
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
    toast.success('分享链接已复制');
    setTimeout(() => {
      setCopiedId((curr) => (curr === shareId ? null : curr));
    }, 1500);
  };

  const handleCopyPassword = (pwd: string, shareId: string) => {
    navigator.clipboard.writeText(pwd);
    setCopiedPwdId(shareId);
    toast.success('密码已复制');
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
      title: '取消分享',
      message: `确定要取消分享「${share.title}」吗？取消后该链接将立即失效。`,
      confirmText: '确定取消',
      cancelText: '保留',
      type: 'danger',
    });
    if (!ok) return;

    try {
      if (window.mypostAPI?.deleteDocShare) {
        await window.mypostAPI.deleteDocShare(share.shareId);
        toast.success('已取消分享');
        loadData();
      }
    } catch (e) {
      toast.error('取消分享失败');
    }
  };

  const handleClearAll = async () => {
    if (shares.length === 0) return;
    const ok = await confirm({
      title: '清空全部分享',
      message: `确定要清空全部 ${shares.length} 个分享链接吗？所有链接将立即失效。`,
      confirmText: '全部清空',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      if (window.mypostAPI?.clearAllDocShares) {
        await window.mypostAPI.clearAllDocShares();
        toast.success('已清空全部链接');
        loadData();
      }
    } catch (e) {
      toast.error('清空失败');
    }
  };

  // Metrics
  const activeCount = useMemo(() => shares.filter((s) => !s.isExpired).length, [shares]);
  const protectedCount = useMemo(() => shares.filter((s) => Boolean(s.password)).length, [shares]);

  // Project names
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
      if (statusFilter === 'active' && item.isExpired) return false;
      if (statusFilter === 'expired' && !item.isExpired) return false;
      if (statusFilter === 'protected' && !item.password) return false;

      if (selectedProject !== 'all' && item.projectName !== selectedProject) return false;

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
      {/* Top Header */}
      <div className="bg-surface border-b border-line px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-foreground">文档分享</h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {serverInfo?.primaryIp || '127.0.0.1'}:{serverInfo?.port || 30990}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                管理已生成的在线文档链接，同局域网设备可通过浏览器免安装查阅
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-foreground transition flex items-center gap-1.5 disabled:opacity-50"
              title="刷新列表"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
              <span>刷新</span>
            </button>

            {shares.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs text-rose-400 transition flex items-center gap-1"
                title="清空全部分享"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenShareModal}
              className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建分享</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto w-full px-6 py-4 flex flex-col gap-4">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-subtle p-0.5 rounded-lg border border-line shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition ${
                statusFilter === 'all'
                  ? 'bg-surface text-accent font-semibold shadow-xs'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              全部 ({shares.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md transition ${
                statusFilter === 'active'
                  ? 'bg-surface text-emerald-400 font-semibold shadow-xs'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              活跃 ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('protected')}
              className={`px-2.5 py-1 rounded-md transition ${
                statusFilter === 'protected'
                  ? 'bg-surface text-amber-400 font-semibold shadow-xs'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              密码保护 ({protectedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('expired')}
              className={`px-2.5 py-1 rounded-md transition ${
                statusFilter === 'expired'
                  ? 'bg-surface text-rose-400 font-semibold shadow-xs'
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              已过期 ({shares.length - activeCount})
            </button>
          </div>

          {/* Search & Project Filter */}
          <div className="flex items-center gap-2">
            {projectNames.length > 1 && (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-subtle border border-line rounded-lg px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-accent"
              >
                <option value="all">所有项目</option>
                {projectNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500" />
              <input
                type="text"
                placeholder="搜索分享文档..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-subtle border border-line rounded-lg pl-8 pr-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {/* Share Items Table */}
        {filteredShares.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-xs">
            <Share2 className="w-10 h-10 text-gray-600 mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-semibold text-gray-300 mb-1">
              {searchQuery || statusFilter !== 'all' || selectedProject !== 'all'
                ? '未找到匹配的分享链接'
                : '暂无已分享的文档链接'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mb-4 leading-relaxed">
              {searchQuery || statusFilter !== 'all' || selectedProject !== 'all'
                ? '请尝试清除筛选条件或更换搜索关键词。'
                : '可将项目或指定目录生成局域网链接，团队成员在浏览器中即可在线查阅。'}
            </p>
            <button
              type="button"
              onClick={onOpenShareModal}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建分享</span>
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-subtle/50 text-gray-400 font-semibold text-[11px]">
                    <th className="py-2.5 px-3.5">文档名称</th>
                    <th className="py-2.5 px-3.5">所属项目</th>
                    <th className="py-2.5 px-3.5">接口数</th>
                    <th className="py-2.5 px-3.5">访问权限</th>
                    <th className="py-2.5 px-3.5">分享链接</th>
                    <th className="py-2.5 px-3.5">有效期限</th>
                    <th className="py-2.5 px-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {filteredShares.map((item) => {
                    const isCopied = copiedId === item.shareId;
                    const isPwdCopied = copiedPwdId === item.shareId;

                    return (
                      <tr
                        key={item.shareId}
                        className={`hover:bg-hover/50 transition ${
                          item.isExpired ? 'opacity-50 bg-subtle/20' : ''
                        }`}
                      >
                        {/* Title & Badges */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2 max-w-[240px]">
                            <span
                              className="font-medium text-gray-200 truncate hover:text-accent transition cursor-pointer"
                              title={item.title}
                              onClick={() => handleOpenBrowser(item.lanUrl)}
                            >
                              {item.title}
                            </span>
                            {item.isExpired ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/15 text-rose-400 shrink-0">
                                已过期
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Project */}
                        <td className="py-2.5 px-3.5 text-gray-300">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                            <span className="truncate max-w-[120px]">{item.projectName || '默认项目'}</span>
                          </span>
                        </td>

                        {/* API Count */}
                        <td className="py-2.5 px-3.5">
                          <span className="text-[11px] font-mono text-blue-400">
                            {item.apiCount} 个
                          </span>
                        </td>

                        {/* Auth / Password */}
                        <td className="py-2.5 px-3.5">
                          {item.password ? (
                            <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                              <Lock className="w-3 h-3" />
                              <span className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                {item.password}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(item.password!, item.shareId)}
                                className="p-0.5 hover:bg-hover rounded text-gray-400 hover:text-amber-300 transition"
                                title="复制密码"
                              >
                                {isPwdCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px] flex items-center gap-1">
                              <Globe className="w-3 h-3 text-blue-400/70" />
                              公开
                            </span>
                          )}
                        </td>

                        {/* LAN Link */}
                        <td className="py-2.5 px-3.5">
                          <span
                            className="font-mono text-[11px] text-gray-400 truncate max-w-[220px] block cursor-pointer hover:text-accent transition select-all"
                            title="点击打开链接"
                            onClick={() => handleOpenBrowser(item.lanUrl)}
                          >
                            {item.lanUrl}
                          </span>
                        </td>

                        {/* Expiry */}
                        <td className="py-2.5 px-3.5 text-gray-400 text-[11px]">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-500 shrink-0" />
                            <span>
                              {item.expiresAt
                                ? `${Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 86400000))}天后到期`
                                : '永久'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(item.lanUrl, item.shareId)}
                              className="px-2 py-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground text-[11px] flex items-center gap-1 transition border border-line"
                              title="复制链接"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>复制</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenBrowser(item.lanUrl)}
                              className="px-2 py-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground text-[11px] flex items-center gap-1 transition border border-line"
                              title="在浏览器中打开"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>打开</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteShare(item)}
                              className="p-1 rounded hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition"
                              title="删除分享"
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
