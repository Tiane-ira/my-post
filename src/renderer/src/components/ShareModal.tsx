import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Lock,
  Globe,
  Folder,
  FolderOpen,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { ApiDetail, ApiTreeNode, ProjectInfo, HttpMethod, DocShareRecord } from '../../../common/types';
import { DocGenerator } from '../../../common/docGenerator';
import { TreeUtils } from '../../../common/treeUtils';
import { useFeedback } from './FeedbackContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectInfo | null;
  treeItems: ApiTreeNode[];
  activeApi: ApiDetail | null;
  defaultFolderId?: string | null;
  getApiDetail: (id: string) => Promise<ApiDetail | null>;
}

function getStatusBadge(status?: number) {
  switch (status) {
    case 1:
      return <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">🟢 已发布</span>;
    case 2:
      return <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">🟡 测试中</span>;
    case 3:
      return <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium">🔵 开发中</span>;
    case 0:
      return <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full font-medium">🔴 已废弃</span>;
    default:
      return <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">🟢 正常</span>;
  }
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  project,
  treeItems,
  activeApi,
  defaultFolderId,
  getApiDetail,
}) => {
  const { toast } = useFeedback();
  const safeTreeItems = treeItems || [];

  // Directory-focused selection: default to passed folder, or active API's folder, or root '0'
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    defaultFolderId ?? (activeApi?.parent_id || '0')
  );

  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [expiry, setExpiry] = useState<'forever' | '7d' | '30d'>('forever');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [, setIsGeneratingShare] = useState<boolean>(false);

  // View mode switcher: render view vs markdown source view
  const [viewMode, setViewMode] = useState<'render' | 'markdown'>('render');
  const [previewMarkdown, setPreviewMarkdown] = useState<string>('');

  // Preview state inside Share Dialog
  const [previewApi, setPreviewApi] = useState<ApiDetail | null>(activeApi);
  const [cachedDetails, setCachedDetails] = useState<Record<string, ApiDetail>>({});
  const [collapsedPreviewFolders, setCollapsedPreviewFolders] = useState<Record<string, boolean>>({});

  // Synchronize folder selection when modal is opened
  useEffect(() => {
    if (isOpen) {
      if (defaultFolderId !== undefined && defaultFolderId !== null) {
        setSelectedFolderId(defaultFolderId);
      } else if (activeApi?.parent_id) {
        setSelectedFolderId(activeApi.parent_id);
      } else {
        setSelectedFolderId('0');
      }
    }
  }, [isOpen, defaultFolderId, activeApi]);

  // Cache activeApi detail
  useEffect(() => {
    if (activeApi) {
      setCachedDetails((prev) => ({ ...prev, [activeApi.target_id]: activeApi }));
      setPreviewApi(activeApi);
    }
  }, [activeApi]);

  // Hierarchically ordered folder options for dropdown
  const folderOptions = useMemo(
    () => TreeUtils.getOrderedFolderOptions(safeTreeItems),
    [safeTreeItems]
  );

  // Full tree for the chosen directory (including subfolders & APIs)
  const scopedTreeHierarchy = useMemo<ApiTreeNode[]>(() => {
    return TreeUtils.getFolderHierarchy(safeTreeItems, selectedFolderId);
  }, [selectedFolderId, safeTreeItems]);

  // APIs in current scope
  const scopedApis = useMemo<ApiTreeNode[]>(() => {
    return scopedTreeHierarchy.filter((t) => t.target_type === 'api');
  }, [scopedTreeHierarchy]);

  const selectedFolderInfo = useMemo(() => {
    if (selectedFolderId === '0') {
      return { id: '0', name: '根目录', path: '根目录 (项目全部接口)', count: scopedApis.length };
    }
    const found = folderOptions.find((o) => o.id === selectedFolderId);
    return found || { id: selectedFolderId, name: '当前目录', path: '指定目录', count: scopedApis.length };
  }, [selectedFolderId, folderOptions, scopedApis.length]);

  const shareTitle =
    selectedFolderId === '0'
      ? `${project?.name || '项目'} 接口全量文档`
      : `${selectedFolderInfo.name} 接口文档`;

  // Synchronize and host LAN documentation
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const generateLanShare = async () => {
      try {
        setIsGeneratingShare(true);
        const detailMap: Record<string, ApiDetail> = { ...cachedDetails };
        const apiList: ApiDetail[] = [];

        for (const item of scopedApis) {
          if (!detailMap[item.target_id]) {
            const d = await getApiDetail(item.target_id);
            if (d) detailMap[item.target_id] = d;
          }
          if (detailMap[item.target_id]) {
            apiList.push(detailMap[item.target_id]);
          }
        }
        if (isCancelled) return;
        setCachedDetails(detailMap);

        const activeShareId =
          shareId ||
          `s_${(project?.project_id || 'proj').slice(0, 6)}_${Math.random().toString(36).slice(2, 8)}`;
        if (!shareId) setShareId(activeShareId);

        const record: DocShareRecord = {
          shareId: activeShareId,
          title: shareTitle,
          projectId: project?.project_id || '',
          projectName: project?.name || 'MyPost API',
          scope: selectedFolderId === '0' ? 'project' : 'folder',
          targetId: selectedFolderId,
          password: hasPassword ? password : '',
          createdAt: Date.now(),
          expiresAt:
            expiry === '7d'
              ? Date.now() + 7 * 86400000
              : expiry === '30d'
              ? Date.now() + 30 * 86400000
              : undefined,
          tree: scopedTreeHierarchy,
          apis: apiList,
        };

        if ((window as any).mypostAPI?.createDocShare) {
          const res = await (window as any).mypostAPI.createDocShare(record);
          if (!isCancelled) {
            setShareUrl(res.lanUrl);
            window.dispatchEvent(new CustomEvent('mypost:share-created'));
          }
        } else {
          if (!isCancelled) setShareUrl(`http://127.0.0.1:30990/share/${activeShareId}`);
        }
      } catch (e) {
        console.error('Failed to generate LAN share:', e);
      } finally {
        if (!isCancelled) setIsGeneratingShare(false);
      }
    };

    generateLanShare();
    return () => {
      isCancelled = true;
    };
  }, [
    isOpen,
    selectedFolderId,
    scopedApis,
    scopedTreeHierarchy,
    hasPassword,
    password,
    expiry,
    project,
    shareTitle,
  ]);

  // Ensure detail is cached when selecting an API in preview
  const handleSelectPreviewItem = async (targetId: string) => {
    if (cachedDetails[targetId]) {
      setPreviewApi(cachedDetails[targetId]);
      return;
    }
    const fetched = await getApiDetail(targetId);
    if (fetched) {
      setCachedDetails((prev) => ({ ...prev, [targetId]: fetched }));
      setPreviewApi(fetched);
    }
  };

  // Automatically select the first API in scope if current preview is invalid
  useEffect(() => {
    if (!isOpen) return;
    if (scopedApis.length > 0) {
      const exists = scopedApis.some((item) => item.target_id === previewApi?.target_id);
      if (!exists) {
        handleSelectPreviewItem(scopedApis[0].target_id);
      }
    } else {
      setPreviewApi(null);
    }
  }, [isOpen, scopedApis]);

  // Compile full Markdown for export and preview
  const buildFullMarkdown = async (): Promise<string> => {
    const detailMap: Record<string, ApiDetail> = { ...cachedDetails };
    for (const item of scopedApis) {
      if (!detailMap[item.target_id]) {
        const d = await getApiDetail(item.target_id);
        if (d) detailMap[item.target_id] = d;
      }
    }

    return DocGenerator.generateCollectionMarkdown(
      shareTitle,
      scopedTreeHierarchy,
      (id) => detailMap[id] || null,
      selectedFolderId,
      project?.name
    );
  };

  // Update markdown preview when folder or scope changes
  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    buildFullMarkdown()
      .then((md) => {
        if (isCurrent) setPreviewMarkdown(md);
      })
      .catch(() => {});
    return () => {
      isCurrent = false;
    };
  }, [isOpen, selectedFolderId, scopedApis, scopedTreeHierarchy]);

  // Export to Markdown (.md)
  const handleExportMarkdown = async () => {
    try {
      const md = await buildFullMarkdown();
      const filename = `${shareTitle.replace(/[/\\?%*:|"<>]/g, '_')}.md`;

      if ((window as any).mypostAPI?.saveFile) {
        const saved = await (window as any).mypostAPI.saveFile(filename, md);
        if (saved) {
          toast.success(`Markdown 文档已下载: ${filename}`);
        }
      } else {
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        toast.success(`Markdown 文档已下载: ${filename}`);
      }
    } catch (err: any) {
      toast.error(`导出失败: ${err?.message || '未知错误'}`);
    }
  };

  // Copy Markdown
  const handleCopyMarkdown = async () => {
    try {
      const md = await buildFullMarkdown();
      await navigator.clipboard.writeText(md);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
      toast.success('已复制完整 Markdown 内容！');
    } catch (err: any) {
      toast.error(`复制失败: ${err?.message || '未知错误'}`);
    }
  };

  const handleCopyLink = () => {
    const fullText = hasPassword && password ? `${shareUrl} (访问密码: ${password})` : shareUrl;
    navigator.clipboard.writeText(fullText);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('已复制局域网专属分享链接！');
  };

  const handleOpenInBrowser = () => {
    if (shareUrl && (window as any).mypostAPI?.openExternal) {
      (window as any).mypostAPI.openExternal(shareUrl);
      toast.success('已在系统浏览器中打开局域网文档');
    }
  };

  const getMethodBadge = (method: HttpMethod | '' | undefined, targetType?: string) => {
    if (targetType === 'sse') {
      return <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">SSE</span>;
    }
    if (targetType === 'websocket') {
      return <span className="text-[9px] font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">WS</span>;
    }
    switch (method) {
      case 'GET':
        return <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">GET</span>;
      case 'POST':
        return <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">POST</span>;
      case 'PUT':
        return <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">PUT</span>;
      case 'DELETE':
        return <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">DEL</span>;
      case 'PATCH':
        return <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">PAT</span>;
      default:
        return <span className="text-[9px] font-bold text-gray-400 bg-gray-500/10 px-1.5 py-0.5 rounded min-w-[28px] text-center font-mono">API</span>;
    }
  };

  // Render tree hierarchy inside preview sidebar
  const renderPreviewTree = (parentId: string, depth: number = 0) => {
    const directChildren = scopedTreeHierarchy.filter(
      (t) => (t.parent_id || '0') === parentId
    );

    return directChildren.map((item) => {
      if (item.target_type === 'folder') {
        const isCollapsed = collapsedPreviewFolders[item.target_id];
        const count = TreeUtils.countFolderApis(scopedTreeHierarchy, item.target_id);
        return (
          <div key={item.target_id} className="space-y-0.5">
            <button
              onClick={() =>
                setCollapsedPreviewFolders((prev) => ({
                  ...prev,
                  [item.target_id]: !prev[item.target_id],
                }))
              }
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              className="w-full text-left py-1 pr-2 rounded hover:bg-hover flex items-center justify-between text-gray-300 transition text-[11px] font-medium"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-gray-500 shrink-0">
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
                {isCollapsed ? (
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="truncate">{item.name}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">({count})</span>
            </button>
            {!isCollapsed && renderPreviewTree(item.target_id, depth + 1)}
          </div>
        );
      } else {
        const isSelected = previewApi?.target_id === item.target_id;
        return (
          <button
            key={item.target_id}
            onClick={() => handleSelectPreviewItem(item.target_id)}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
            className={`w-full text-left py-1 pr-2 rounded flex items-center gap-1.5 transition truncate text-[11px] ${
              isSelected
                ? 'bg-sky-500/20 text-sky-300 font-semibold border-l-2 border-sky-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-hover'
            }`}
            title={item.name}
          >
            {getMethodBadge(item.method, item.target_type)}
            <span className="truncate">{item.name}</span>
          </button>
        );
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-[1020px] h-[680px] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Modal Top Header */}
        <div className="h-12 px-5 bg-surface border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <span>文档分享与 Markdown 导出</span>
            <span className="text-[10px] text-gray-400 font-normal ml-2">
              (按目录分享 · 保持目录层级 · 包含接口完整信息 · 局域网实时协同)
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-hover text-gray-400 hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Share Settings */}
          <div className="w-80 border-r border-line bg-surface p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Directory Selection (Requirement 1: 只需指定目录进行分享，包含根目录) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-300 font-bold flex items-center gap-1.5 text-xs">
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>1. 选择分享目录</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    包含根目录
                  </span>
                </div>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full bg-subtle border border-line rounded-lg px-2.5 py-2 text-gray-200 focus:outline-none focus:border-sky-500 text-xs font-medium"
                >
                  {folderOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.depth > 0 ? `${'\u00A0'.repeat(opt.depth * 3)}📁 ${opt.name}` : `📁 ${opt.name}`} ({opt.count} 接口)
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400 px-1">
                  <span className="truncate max-w-[170px]" title={selectedFolderInfo.path}>
                    路径: <span className="text-gray-300 font-mono">{selectedFolderInfo.path}</span>
                  </span>
                  <span className="text-amber-400/90 font-mono shrink-0">共 {scopedApis.length} 个接口</span>
                </div>
              </div>

              {/* Access Security */}
              <div className="pt-2 border-t border-line space-y-3">
                <label className="text-gray-300 font-bold block text-xs">2. 权限与安全保护</label>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>设置访问密码</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={hasPassword}
                    onChange={(e) => setHasPassword(e.target.checked)}
                    className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                {hasPassword && (
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入访问验证码/密码"
                    className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-sky-500"
                  />
                )}

                <div>
                  <label className="text-gray-400 block mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>分享链接有效期</span>
                  </label>
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value as any)}
                    className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="forever">永久有效</option>
                    <option value="30d">30 天有效</option>
                    <option value="7d">7 天有效</option>
                  </select>
                </div>
              </div>

              {/* Share URL Box */}
              <div className="pt-2 border-t border-line space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-300 font-bold block text-xs">3. 局域网专属分享链接</label>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>局域网可访问</span>
                  </span>
                </div>
                <div className="bg-subtle border border-line p-2.5 rounded-xl flex items-center justify-between">
                  <div className="truncate text-[11px] font-mono text-sky-400 select-all flex-1" title={shareUrl}>
                    {shareUrl || '正在生成局域网分享链接...'}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <button
                      onClick={handleCopyLink}
                      className="px-2.5 py-1 rounded bg-subtle hover:bg-hover text-gray-200 text-xs font-medium transition flex items-center gap-1"
                      title="复制分享链接"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>复制</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenInBrowser}
                      className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 hover:text-foreground text-xs font-medium transition flex items-center gap-1"
                      title="在系统默认浏览器中打开局域网文档"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>打开</span>
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500">
                  同一 Wi-Fi 或局域网内的设备打开上方链接即可实时浏览完整接口文档。
                </div>
              </div>
            </div>

            {/* Export Action Buttons: Markdown Exclusive */}
            <div className="pt-4 border-t border-line space-y-2">
              <div className="text-[11px] text-gray-400 font-semibold mb-1">Markdown 完整文档导出：</div>

              <button
                onClick={handleExportMarkdown}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition"
              >
                <Download className="w-4 h-4" />
                <span>导出为 Markdown 文档 (.md)</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="w-full py-1.5 rounded-xl bg-subtle hover:bg-hover border border-line text-gray-300 font-medium flex items-center justify-center gap-2 transition"
              >
                {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMd ? '已复制 Markdown 内容！' : '复制完整 Markdown 内容'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Online Share Live Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-surface">
            {/* Share Page Top Banner */}
            <div className="h-10 px-4 bg-surface border-b border-line flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-300">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold text-foreground">{shareTitle}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400 font-mono">共 {scopedApis.length} 个接口</span>

                {/* View switcher toggle */}
                <div className="flex items-center p-0.5 bg-surface border border-line rounded-lg ml-3">
                  <button
                    onClick={() => setViewMode('render')}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold transition ${
                      viewMode === 'render'
                        ? 'bg-sky-500 text-foreground shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    文档渲染视图
                  </button>
                  <button
                    onClick={() => setViewMode('markdown')}
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold transition ${
                      viewMode === 'markdown'
                        ? 'bg-sky-500 text-foreground shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Markdown 源码
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-foreground transition flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制 Markdown</span>
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-xs text-sky-300 hover:text-foreground font-medium transition flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>下载 .md</span>
                </button>
              </div>
            </div>

            {/* Split View: Left Directory Nav & Right Doc Content OR Markdown Source View */}
            {viewMode === 'markdown' ? (
              <div className="flex-1 p-6 overflow-y-auto bg-surface">
                <div className="bg-subtle border border-line rounded-xl p-5 shadow-2xl space-y-3 max-w-4xl mx-auto">
                  <div className="flex items-center justify-between text-xs text-gray-400 border-b border-line pb-2">
                    <span className="font-mono text-gray-300">
                      {shareTitle} - 完整 Markdown 源码 ({previewMarkdown.length} 字符)
                    </span>
                    <button
                      onClick={handleCopyMarkdown}
                      className="px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-foreground transition flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                      <span>一键复制全文</span>
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-gray-200 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text">
                    <code>{previewMarkdown || '正在生成 Markdown 内容...'}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden">
                {/* Directory Tree Navigator in Preview */}
                <div className="w-56 border-r border-line bg-surface overflow-y-auto p-2 space-y-1 shrink-0">
                  <div className="text-[10px] text-gray-400 font-semibold px-2 py-1 flex items-center justify-between border-b border-line mb-1">
                    <span>分享目录结构</span>
                    <span className="text-gray-500 font-mono">{scopedApis.length} 项</span>
                  </div>
                  {scopedTreeHierarchy.length > 0 ? (
                    selectedFolderId === '0' ? (
                      renderPreviewTree('0', 0)
                    ) : (
                      renderPreviewTree(selectedFolderId, 0)
                    )
                  ) : (
                    <div className="text-gray-500 text-xs px-2 py-4 text-center">暂无接口</div>
                  )}
                </div>

                {/* Doc Details View (Full complete interface information) */}
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                  {previewApi ? (
                    <>
                      {/* Interface Header */}
                      <div className="space-y-2 border-b border-line pb-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold text-foreground">{previewApi.name}</h2>
                          {getStatusBadge(previewApi.status)}
                        </div>

                        <div className="flex items-center gap-2">
                          {getMethodBadge(previewApi.method, previewApi.target_type)}
                          <code className="text-xs font-mono bg-subtle px-2.5 py-1 rounded-md text-amber-300 border border-line flex-1 truncate">
                            {previewApi.url || '/'}
                          </code>
                        </div>

                        {previewApi.description && (
                          <div className="text-xs text-gray-400 leading-relaxed pt-1">
                            {previewApi.description}
                          </div>
                        )}

                        {previewApi.request?.auth && previewApi.request.auth.type !== 'none' && (
                          <div className="text-xs text-gray-400 flex items-center gap-1.5 pt-1">
                            <span className="font-semibold text-gray-300">认证方式:</span>
                            <span className="text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              {previewApi.request.auth.type === 'bearer'
                                ? `Bearer Token (${previewApi.request.auth.bearer?.token || '{{token}}'})`
                                : previewApi.request.auth.type === 'basic'
                                ? `Basic Auth (${previewApi.request.auth.basic?.username || 'user'})`
                                : previewApi.request.auth.type}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 1. Path Parameters Table */}
                      {(() => {
                        const pathSource = previewApi.request?.path?.parameter || (previewApi.request as any)?.restful?.parameter || [];
                        const pathParams = (Array.isArray(pathSource) ? pathSource : []).filter((p: any) => p.key);
                        if (pathParams.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                              <span>路径参数 (Path Parameters)</span>
                              <span className="text-[10px] text-gray-500 font-mono">({pathParams.length})</span>
                            </div>
                            <div className="border border-line rounded-lg overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-subtle text-gray-400 border-b border-line">
                                  <tr>
                                    <th className="px-3 py-1.5 font-medium">参数名</th>
                                    <th className="px-3 py-1.5 font-medium">必填</th>
                                    <th className="px-3 py-1.5 font-medium">类型</th>
                                    <th className="px-3 py-1.5 font-medium">示例值</th>
                                    <th className="px-3 py-1.5 font-medium">说明</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line bg-surface">
                                  {pathParams.map((p: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 text-amber-300 font-mono font-semibold">{p.key}</td>
                                      <td className="px-3 py-1.5">
                                        {p.is_required === 1 || p.required ? (
                                          <span className="text-rose-400 font-bold">是</span>
                                        ) : (
                                          <span className="text-gray-500">否</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-blue-300 font-mono">{p.data_type || p.type || 'string'}</td>
                                      <td className="px-3 py-1.5 text-gray-300 font-mono">{p.value || '-'}</td>
                                      <td className="px-3 py-1.5 text-gray-400">{p.description || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Query Table */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span>Query 查询参数</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({(previewApi.request?.query?.parameter || []).filter((q) => q.key && (q.is_checked === undefined || q.is_checked === 1 || (q as any).is_checked === true)).length})
                          </span>
                        </div>
                        {(previewApi.request?.query?.parameter || []).filter((q) => q.key && (q.is_checked === undefined || q.is_checked === 1 || (q as any).is_checked === true)).length > 0 ? (
                          <div className="border border-line rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-subtle text-gray-400 border-b border-line">
                                <tr>
                                  <th className="px-3 py-1.5 font-medium">参数名</th>
                                  <th className="px-3 py-1.5 font-medium">必填</th>
                                  <th className="px-3 py-1.5 font-medium">类型</th>
                                  <th className="px-3 py-1.5 font-medium">示例值</th>
                                  <th className="px-3 py-1.5 font-medium">说明</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line bg-surface">
                                {(previewApi.request?.query?.parameter || [])
                                  .filter((q) => q.key && (q.is_checked === undefined || q.is_checked === 1 || (q as any).is_checked === true))
                                  .map((q, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 text-amber-300 font-mono font-semibold">{q.key}</td>
                                      <td className="px-3 py-1.5">
                                        {q.is_required === 1 || q.required ? (
                                          <span className="text-rose-400 font-bold">是</span>
                                        ) : (
                                          <span className="text-gray-500">否</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-blue-300 font-mono">{q.data_type || q.type || 'string'}</td>
                                      <td className="px-3 py-1.5 text-gray-300 font-mono">{q.value || '-'}</td>
                                      <td className="px-3 py-1.5 text-gray-400">{q.description || '-'}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 bg-subtle p-2 rounded-lg border border-line">无 Query 参数</div>
                        )}
                      </div>

                      {/* 3. Headers Table */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                          <span>Headers 请求头</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({(previewApi.request?.header?.parameter || []).filter((h) => h.key && (h.is_checked === undefined || h.is_checked === 1 || (h as any).is_checked === true)).length})
                          </span>
                        </div>
                        {(previewApi.request?.header?.parameter || []).filter((h) => h.key && (h.is_checked === undefined || h.is_checked === 1 || (h as any).is_checked === true)).length > 0 ? (
                          <div className="border border-line rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-subtle text-gray-400 border-b border-line">
                                <tr>
                                  <th className="px-3 py-1.5 font-medium">请求头</th>
                                  <th className="px-3 py-1.5 font-medium">必填</th>
                                  <th className="px-3 py-1.5 font-medium">示例值</th>
                                  <th className="px-3 py-1.5 font-medium">说明</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line bg-surface">
                                {(previewApi.request?.header?.parameter || [])
                                  .filter((h) => h.key && (h.is_checked === undefined || h.is_checked === 1 || (h as any).is_checked === true))
                                  .map((h, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 text-blue-300 font-mono font-semibold">{h.key}</td>
                                      <td className="px-3 py-1.5">
                                        {h.is_required === 1 || h.required ? (
                                          <span className="text-rose-400 font-bold">是</span>
                                        ) : (
                                          <span className="text-gray-500">否</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-gray-300 font-mono">{h.value || '-'}</td>
                                      <td className="px-3 py-1.5 text-gray-400">{h.description || '-'}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 bg-subtle p-2 rounded-lg border border-line">无特殊 Headers</div>
                        )}
                      </div>

                      {/* 4. Cookie Parameters Table */}
                      {(() => {
                        const cookies = (previewApi.request?.cookie?.parameter || []).filter((c) => c.key && (c.is_checked === undefined || c.is_checked === 1 || (c as any).is_checked === true));
                        if (cookies.length === 0) return null;
                        return (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                              <span>Cookie 参数</span>
                              <span className="text-[10px] text-gray-500 font-mono">({cookies.length})</span>
                            </div>
                            <div className="border border-line rounded-lg overflow-hidden">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-subtle text-gray-400 border-b border-line">
                                  <tr>
                                    <th className="px-3 py-1.5 font-medium">Cookie 名</th>
                                    <th className="px-3 py-1.5 font-medium">必填</th>
                                    <th className="px-3 py-1.5 font-medium">示例值</th>
                                    <th className="px-3 py-1.5 font-medium">说明</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-line bg-surface">
                                  {cookies.map((c, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 text-purple-300 font-mono font-semibold">{c.key}</td>
                                      <td className="px-3 py-1.5">
                                        {c.is_required === 1 || c.required ? (
                                          <span className="text-rose-400 font-bold">是</span>
                                        ) : (
                                          <span className="text-gray-500">否</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-gray-300 font-mono">{c.value || '-'}</td>
                                      <td className="px-3 py-1.5 text-gray-400">{c.description || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 5. Request Body */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-2">
                          <span>请求体 (Body)</span>
                          <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 uppercase">
                            {previewApi.request?.body?.mode || 'NONE'}
                          </span>
                        </div>

                        {previewApi.request?.body?.mode === 'json' && previewApi.request?.body?.raw && (
                          <pre className="bg-subtle border border-line p-3 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto leading-relaxed">
                            <code>
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(previewApi.request.body.raw), null, 2);
                                } catch {
                                  return previewApi.request.body.raw;
                                }
                              })()}
                            </code>
                          </pre>
                        )}

                        {(previewApi.request?.body?.mode === 'form-data' || previewApi.request?.body?.mode === 'urlencoded') && (
                          <div className="border border-line rounded-lg overflow-hidden">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-subtle text-gray-400 border-b border-line">
                                <tr>
                                  <th className="px-3 py-1.5 font-medium">参数名</th>
                                  <th className="px-3 py-1.5 font-medium">类型</th>
                                  <th className="px-3 py-1.5 font-medium">必填</th>
                                  <th className="px-3 py-1.5 font-medium">示例值</th>
                                  <th className="px-3 py-1.5 font-medium">说明</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line bg-surface">
                                {((previewApi.request.body.mode === 'form-data'
                                  ? previewApi.request.body.parameter
                                  : previewApi.request.body.urlencoded) || []
                                ).map((f, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-1.5 text-amber-300 font-mono">{f.key}</td>
                                    <td className="px-3 py-1.5 text-blue-300 font-mono">{f.type || 'text'}</td>
                                    <td className="px-3 py-1.5">
                                      {f.is_required === 1 || f.required ? (
                                        <span className="text-rose-400 font-bold">是</span>
                                      ) : (
                                        <span className="text-gray-500">否</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 text-gray-300 font-mono">{f.value || '-'}</td>
                                    <td className="px-3 py-1.5 text-gray-400">{f.description || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {previewApi.request?.body?.mode === 'raw' && previewApi.request?.body?.raw && (
                          <pre className="bg-subtle border border-line p-3 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto">
                            <code>{previewApi.request.body.raw}</code>
                          </pre>
                        )}

                        {(!previewApi.request?.body?.mode || previewApi.request?.body?.mode === 'none') && (
                          <div className="text-xs text-gray-500 bg-subtle p-2 rounded-lg border border-line">无需请求体 (None)</div>
                        )}
                      </div>

                      {/* 6. Response Examples */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-200 flex items-center gap-2">
                          <span>响应示例 (Responses)</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ({(previewApi.response?.example || []).length})
                          </span>
                        </div>
                        {(previewApi.response?.example || []).length > 0 ? (
                          (previewApi.response?.example || []).map((ex, idx) => {
                            const code = ex.expect?.code || (ex as any).code || '200';
                            return (
                              <div key={idx} className="border border-line rounded-lg overflow-hidden bg-subtle/50">
                                <div className="px-3 py-2 bg-subtle border-b border-line flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-emerald-400 font-mono">[HTTP {code}]</span>
                                    <span className="font-medium text-gray-200">{ex.name || '默认响应'}</span>
                                  </div>
                                </div>
                                <pre className="p-3 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                                  <code>
                                    {(() => {
                                      try {
                                        return JSON.stringify(JSON.parse(ex.raw), null, 2);
                                      } catch {
                                        return ex.raw || '{}';
                                      }
                                    })()}
                                  </code>
                                </pre>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-gray-500 bg-subtle p-2 rounded-lg border border-line">暂无响应示例</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      请在左侧选择要预览的接口
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
