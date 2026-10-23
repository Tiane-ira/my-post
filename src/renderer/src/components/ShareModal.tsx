import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  Lock,
  Folder,
  Calendar,
  ExternalLink,
  FileText,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { ApiDetail, ApiTreeNode, ProjectInfo, DocShareRecord } from '../../../common/types';
import { DocGenerator } from '../../../common/docGenerator';
import { TreeUtils } from '../../../common/treeUtils';
import { ParamUtils } from '../../../common/paramUtils';
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

  // Folder selection
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    defaultFolderId ?? (activeApi?.parent_id || '0')
  );

  const [customTitle, setCustomTitle] = useState<string>('');
  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [expiry, setExpiry] = useState<'forever' | '7d' | '30d'>('forever');

  // Share result state: ONLY populated when user clicks "确认生成分享链接"
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  const [cachedDetails, setCachedDetails] = useState<Record<string, ApiDetail>>({});

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialFolder = defaultFolderId ?? (activeApi?.parent_id || '0');
      setSelectedFolderId(initialFolder);
      setCustomTitle('');
      setShareUrl('');
      setShareId('');
      setHasPassword(false);
      setPassword('');
      setExpiry('forever');
    }
  }, [isOpen, defaultFolderId, activeApi]);

  // Hierarchically ordered folder options
  const folderOptions = useMemo(
    () => TreeUtils.getOrderedFolderOptions(safeTreeItems),
    [safeTreeItems]
  );

  // Scoped tree hierarchy for chosen directory
  const scopedTreeHierarchy = useMemo<ApiTreeNode[]>(() => {
    return TreeUtils.getFolderHierarchy(safeTreeItems, selectedFolderId);
  }, [selectedFolderId, safeTreeItems]);

  // APIs in current scope
  const scopedApis = useMemo<ApiTreeNode[]>(() => {
    return scopedTreeHierarchy.filter((t) => t.target_type === 'api');
  }, [scopedTreeHierarchy]);

  const selectedFolderInfo = useMemo(() => {
    if (selectedFolderId === '0') {
      return { id: '0', name: '根目录', path: '项目全部接口', count: scopedApis.length };
    }
    const found = folderOptions.find((o) => o.id === selectedFolderId);
    return found || { id: selectedFolderId, name: '当前目录', path: '指定目录', count: scopedApis.length };
  }, [selectedFolderId, folderOptions, scopedApis.length]);

  const defaultShareTitle = useMemo(() => {
    return selectedFolderId === '0'
      ? `${project?.name || '项目'} 接口全量文档`
      : `${selectedFolderInfo.name} 接口文档`;
  }, [selectedFolderId, project?.name, selectedFolderInfo.name]);

  const activeTitle = customTitle.trim() || defaultShareTitle;

  // Confirm and Generate Share (Only executes when user clicks button)
  const handleConfirmShare = async () => {
    if (scopedApis.length === 0) {
      toast.warning('所选目录下暂无任何接口，请先添加接口再分享');
      return;
    }

    try {
      setIsCreating(true);
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
      setCachedDetails(detailMap);

      // Preload ancestor folder details for all apis to merge folder params
      const folderMap: Record<string, ApiDetail> = {};
      const folderIdsToLoad = new Set<string>(['0']);
      for (const a of apiList) {
        let cur = a.parent_id;
        while (cur && cur !== '0') {
          folderIdsToLoad.add(cur);
          const node = treeItems.find((t) => t.target_id === cur);
          cur = node ? node.parent_id : '';
        }
      }

      await Promise.all(
        Array.from(folderIdsToLoad).map(async (fId) => {
          if (detailMap[fId]) {
            folderMap[fId] = detailMap[fId];
          } else {
            const fd = await getApiDetail(fId);
            if (fd) {
              folderMap[fId] = fd;
              detailMap[fId] = fd;
            }
          }
        })
      );

      const mergedApiList = apiList.map((a) =>
        ParamUtils.mergeApiWithFolderParams(a, treeItems, folderMap)
      );

      const activeShareId =
        shareId ||
        `s_${(project?.project_id || 'proj').slice(0, 6)}_${Math.random().toString(36).slice(2, 8)}`;
      if (!shareId) setShareId(activeShareId);

      const record: DocShareRecord = {
        shareId: activeShareId,
        title: activeTitle,
        projectId: project?.project_id || '',
        projectName: project?.name || 'MyPost API',
        scope: selectedFolderId === '0' ? 'project' : 'folder',
        targetId: selectedFolderId,
        password: hasPassword ? password.trim() : '',
        createdAt: Date.now(),
        expiresAt:
          expiry === '7d'
            ? Date.now() + 7 * 86400000
            : expiry === '30d'
            ? Date.now() + 30 * 86400000
            : undefined,
        tree: scopedTreeHierarchy,
        apis: mergedApiList,
      };

      if (window.mypostAPI?.createDocShare) {
        const res = await window.mypostAPI.createDocShare(record);
        setShareUrl(res.lanUrl);
        window.dispatchEvent(new CustomEvent('mypost:share-created'));
        toast.success('分享已成功生效！');
      } else {
        const fallbackUrl = `http://127.0.0.1:30990/share/${activeShareId}`;
        setShareUrl(fallbackUrl);
        toast.success('分享链接已生成！');
      }
    } catch (e: any) {
      console.error('Failed to create share:', e);
      toast.error(`分享创建失败: ${e?.message || '未知错误'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    const fullText = hasPassword && password.trim() ? `${shareUrl} (访问密码: ${password.trim()})` : shareUrl;
    navigator.clipboard.writeText(fullText);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('分享链接已复制到剪贴板！');
  };

  const handleOpenInBrowser = () => {
    if (shareUrl && window.mypostAPI?.openExternal) {
      window.mypostAPI.openExternal(shareUrl);
      toast.success('已在浏览器中打开文档');
    }
  };

  // Compile full Markdown for export
  const buildFullMarkdown = async (): Promise<string> => {
    const detailMap: Record<string, ApiDetail> = { ...cachedDetails };
    for (const item of scopedApis) {
      if (!detailMap[item.target_id]) {
        const d = await getApiDetail(item.target_id);
        if (d) detailMap[item.target_id] = d;
      }
    }
    return DocGenerator.generateCollectionMarkdown(
      activeTitle,
      scopedTreeHierarchy,
      (id) => detailMap[id] || null,
      selectedFolderId,
      project?.name
    );
  };

  const handleExportMarkdown = async () => {
    try {
      const md = await buildFullMarkdown();
      const filename = `${activeTitle.replace(/[/\\?%*:|"<>]/g, '_')}.md`;

      if (window.mypostAPI?.saveFile) {
        const saved = await window.mypostAPI.saveFile(filename, md);
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

  const handleCopyMarkdown = async () => {
    try {
      const md = await buildFullMarkdown();
      navigator.clipboard.writeText(md);
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
      toast.success('已复制完整 Markdown 内容！');
    } catch (err: any) {
      toast.error(`复制失败: ${err?.message || '未知错误'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="h-12 px-5 bg-subtle/50 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <div className="w-6 h-6 rounded-md bg-accent/15 border border-accent/25 flex items-center justify-center text-accent">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <span>文档分享</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-hover text-gray-400 hover:text-foreground transition"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* 1. Scope / Folder selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-gray-300 font-medium">
              <label className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>分享范围</span>
              </label>
              <span className="text-[11px] text-gray-400 font-mono">
                共 {scopedApis.length} 个接口
              </span>
            </div>
            <select
              value={selectedFolderId}
              disabled={Boolean(shareUrl)}
              onChange={(e) => {
                setSelectedFolderId(e.target.value);
                setShareUrl('');
              }}
              className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-gray-200 outline-none focus:border-accent text-xs disabled:opacity-60"
            >
              {folderOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.depth > 0 ? `${'\u00A0'.repeat(opt.depth * 3)}📁 ${opt.name}` : `📁 ${opt.name}`} ({opt.count} 接口)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Document Title */}
          <div className="space-y-1.5">
            <label className="text-gray-300 font-medium block">
              文档标题
            </label>
            <input
              type="text"
              disabled={Boolean(shareUrl)}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={defaultShareTitle}
              className="w-full bg-subtle border border-line rounded-lg px-3 py-2 text-gray-200 placeholder-gray-500 outline-none focus:border-accent text-xs disabled:opacity-60"
            />
          </div>

          {/* 3. Password Protection & Expiry */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-gray-300 font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>访问密码</span>
                </span>
                <input
                  type="checkbox"
                  disabled={Boolean(shareUrl)}
                  checked={hasPassword}
                  onChange={(e) => setHasPassword(e.target.checked)}
                  className="rounded accent-accent w-3.5 h-3.5 cursor-pointer disabled:opacity-60"
                />
              </label>
              {hasPassword ? (
                <input
                  type="text"
                  disabled={Boolean(shareUrl)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入访问密码"
                  className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-accent text-xs disabled:opacity-60"
                />
              ) : (
                <div className="px-2.5 py-1.5 rounded-lg bg-subtle/50 border border-line text-gray-500 text-[11px]">
                  公开（无需密码）
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-300 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>有效期限</span>
              </label>
              <select
                value={expiry}
                disabled={Boolean(shareUrl)}
                onChange={(e) => setExpiry(e.target.value as any)}
                className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 outline-none focus:border-accent text-xs disabled:opacity-60"
              >
                <option value="forever">永久有效</option>
                <option value="7d">7 天有效</option>
                <option value="30d">30 天有效</option>
              </select>
            </div>
          </div>

          {/* 4. Generated Share Result (Appears only after clicking confirm) */}
          {shareUrl ? (
            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/25 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-accent font-semibold flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>分享已生效</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  同一局域网设备免安装直接打开
                </span>
              </div>

              <div className="bg-surface border border-line rounded-lg p-2 flex items-center justify-between gap-2">
                <span className="font-mono text-gray-200 text-xs truncate select-all flex-1" title={shareUrl}>
                  {shareUrl}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-2.5 py-1 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                  >
                    {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? '已复制' : '复制'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInBrowser}
                    className="p-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground transition border border-line"
                    title="在浏览器中打开"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* 5. Markdown Offline Export (Collapsed / Compact) */}
          <div className="pt-2 border-t border-line flex items-center justify-between text-gray-400">
            <span className="text-[11px] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span>或离线导出文档：</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="hover:text-foreground text-[11px] flex items-center gap-1 transition"
              >
                {copiedMd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMd ? '已复制' : '复制 Markdown'}</span>
              </button>
              <span className="text-gray-600">|</span>
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="hover:text-foreground text-[11px] flex items-center gap-1 transition"
              >
                <Download className="w-3 h-3" />
                <span>下载 .md</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="px-5 py-3 bg-subtle/30 border-t border-line flex items-center justify-end gap-2.5">
          {shareUrl ? (
            <>
              <button
                type="button"
                onClick={() => setShareUrl('')}
                className="px-3.5 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 font-medium transition text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                <span>修改配置并重新生成</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition text-xs shadow-sm"
              >
                完成
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 font-medium transition text-xs"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={handleConfirmShare}
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>正在生成分享链接...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>确认生成分享链接</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
