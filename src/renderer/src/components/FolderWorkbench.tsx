import React, { useState } from 'react';
import {
  Folder,
  FolderPlus,
  FilePlus,
  Share2,
  Trash2,
  Layers,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  Save
} from 'lucide-react';
import { ApiTreeNode, HttpMethod, KeyValueItem } from '../../../common/types';
import { TreeUtils } from '../../../common/treeUtils';
import { KeyValueTable } from './KeyValueTable';
import { useFeedback } from './FeedbackContext';

interface FolderWorkbenchProps {
  folder: ApiTreeNode;
  treeItems: ApiTreeNode[];
  onUpdateFolderName: (folderId: string, newName: string) => void;
  onSelectApi: (targetId: string) => void;
  onCreateApi: (parentId: string) => void;
  onCreateSubFolder: (parentId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenShare: (folderId: string) => void;
}

export const FolderWorkbench: React.FC<FolderWorkbenchProps> = ({
  folder,
  treeItems,
  onUpdateFolderName,
  onSelectApi,
  onCreateApi,
  onCreateSubFolder,
  onDeleteFolder,
  onOpenShare,
}) => {
  const { confirm, toast } = useFeedback();
  const [folderName, setFolderName] = useState(folder.name);
  const [activeTab, setActiveTab] = useState<'apis' | 'headers' | 'params' | 'desc'>('apis');
  const [description, setDescription] = useState('');
  const [commonHeaders, setCommonHeaders] = useState<KeyValueItem[]>([]);
  const [commonParams, setCommonParams] = useState<KeyValueItem[]>([]);
  const [savedTip, setSavedTip] = useState(false);

  const directChildren = TreeUtils.getFolderChildren(treeItems, folder.target_id, false);
  const allDescendants = TreeUtils.getFolderChildren(treeItems, folder.target_id, true);
  const childApis = allDescendants.filter((d) => d.target_type === 'api' || d.target_type === 'sse' || d.target_type === 'websocket');
  const subFolders = directChildren.filter((d) => d.target_type === 'folder');
  const breadcrumbs = TreeUtils.buildBreadcrumbs(treeItems, folder.target_id);

  const handleNameBlur = () => {
    if (folderName.trim() && folderName !== folder.name) {
      onUpdateFolderName(folder.target_id, folderName.trim());
      toast.success(`目录名称已更新为 "${folderName.trim()}"`);
    }
  };

  const handleSaveConfig = () => {
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 2000);
    toast.success('目录公共配置已保存');
  };

  const getMethodBadge = (method: HttpMethod | '', targetType?: string) => {
    if (targetType === 'sse') {
      return <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 font-mono">SSE</span>;
    }
    if (targetType === 'websocket') {
      return <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20 font-mono">WS</span>;
    }
    switch (method) {
      case 'GET':
        return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">GET</span>;
      case 'POST':
        return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">POST</span>;
      case 'PUT':
        return <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">PUT</span>;
      case 'DELETE':
        return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 font-mono">DEL</span>;
      case 'PATCH':
        return <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-mono">PAT</span>;
      default:
        return <span className="text-[10px] font-bold text-gray-400 bg-gray-500/10 px-1.5 py-0.5 rounded border border-gray-500/20 font-mono">API</span>;
    }
  };

  const isRoot = folder.target_id === '0';
  const displayBreadcrumbs = isRoot ? ['根目录'] : breadcrumbs;

  return (
      <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden select-none">
        {/* Top Bar */}
        <div className="h-12 px-6 border-b border-line flex items-center justify-between bg-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={folderName}
                  disabled={isRoot}
                  onChange={(e) => setFolderName(e.target.value)}
                  onBlur={handleNameBlur}
                  className={`bg-transparent border-none text-base font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 px-1 py-0.5 rounded ${
                    isRoot ? 'cursor-default opacity-90' : ''
                  }`}
                  placeholder="目录名称"
                />
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-subtle border border-line text-gray-400 font-mono">
                  {childApis.length} 个接口
                </span>
              </div>
              <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                <span>路径：</span>
                <span>{displayBreadcrumbs.join(' / ')}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCreateApi(folder.target_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-xs text-accent font-semibold transition"
              title="在此目录下新建接口"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>新建接口</span>
            </button>

            <button
              onClick={() => onCreateSubFolder(folder.target_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-xs text-gray-300 font-medium transition"
              title="在此目录下新建子目录"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>新建子目录</span>
            </button>

            <button
              onClick={() => onOpenShare(folder.target_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-xs text-gray-300 font-medium transition"
              title={isRoot ? "分享根目录文档 (项目全部接口)" : "分享或导出此目录文档"}
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{isRoot ? '分享根目录文档' : '分享目录'}</span>
            </button>

            <div className="h-4 w-[1px] bg-subtle"></div>

            <button
              onClick={async () => {
                const ok = await confirm({
                  title: isRoot ? '清空根目录下所有接口' : '删除目录确认',
                  message: isRoot
                    ? `确认清空根目录下的全部接口与子目录吗？此操作将永久删除当前项目中的全部接口数据 (${childApis.length} 个接口)，且无法恢复。`
                    : `确认删除目录 "${folder.name}" 及其全部子接口吗？此操作无法撤销。`,
                  type: 'danger',
                  confirmText: isRoot ? '确认清空全部' : '确认删除',
                  cancelText: '取消',
                });
                if (ok) {
                  onDeleteFolder(folder.target_id);
                  toast.success(isRoot ? '已清空根目录下的所有接口' : `已删除目录 "${folder.name}"`);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs text-rose-400 transition"
              title={isRoot ? '清空根目录下所有接口' : '删除目录'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isRoot && <span className="font-medium">清空所有接口</span>}
            </button>
          </div>
        </div>

      {/* Tabs */}
      <div className="h-10 px-6 bg-surface border-b border-line flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('apis')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'apis'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            子接口概览 ({childApis.length})
          </button>

          <button
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'headers'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            目录公共 Header
          </button>

          <button
            onClick={() => setActiveTab('params')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'params'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            目录公共 Query
          </button>

          <button
            onClick={() => setActiveTab('desc')}
            className={`px-3 py-1.5 rounded-md font-semibold transition ${
              activeTab === 'desc'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            目录说明文档
          </button>
        </div>

        <button
          onClick={handleSaveConfig}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-200 transition"
        >
          <Save className="w-3.5 h-3.5 text-amber-400" />
          <span>{savedTip ? '已保存！' : '保存目录配置'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full">
        {/* Child APIs Tab */}
        {activeTab === 'apis' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-gray-400 text-xs">下级接口总数</div>
                  <div className="text-2xl font-black text-foreground mt-1">{childApis.length}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-gray-400 text-xs">子目录总数</div>
                  <div className="text-2xl font-black text-foreground mt-1">{subFolders.length}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Folder className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-gray-400 text-xs">公共 Header 规则</div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {commonHeaders.filter((h) => h.is_checked === 1).length} 项
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* APIs List Table */}
            <div className="border border-line rounded-xl overflow-hidden bg-surface shadow-xl">
              <div className="px-4 py-3 bg-surface border-b border-line flex items-center justify-between">
                <span className="text-xs font-bold text-gray-200">目录内接口列表</span>
                <span className="text-[11px] text-gray-400">点击任意接口可直接打开进行调试</span>
              </div>

              {childApis.length > 0 ? (
                <div className="divide-y divide-line">
                  {childApis.map((apiItem) => (
                    <div
                      key={apiItem.target_id}
                      onClick={() => onSelectApi(apiItem.target_id)}
                      className="px-4 py-3 hover:bg-hover cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getMethodBadge(apiItem.method, apiItem.target_type)}
                        <span className="text-xs font-semibold text-gray-200 group-hover:text-amber-400 transition truncate">
                          {apiItem.name}
                        </span>
                        <code className="text-[11px] font-mono text-gray-400 truncate max-w-xs">
                          {apiItem.url || '/'}
                        </code>
                      </div>

                      <div className="flex items-center gap-3">
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs">
                  <p>当前目录下暂无接口，点击右上角「新建接口」开始创建</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Common Headers Tab */}
        {activeTab === 'headers' && (
          <div className="space-y-4">
            <div className="bg-surface border border-line p-3.5 rounded-xl text-xs text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                目录公共 Header：当前目录及所有子目录下接口发起请求时，将自动注入勾选的请求头。
              </span>
            </div>
            <KeyValueTable
              items={commonHeaders}
              onChange={setCommonHeaders}
              keyPlaceholder="请求头 Key (例如 X-User-Token)"
              valuePlaceholder="请求头 Value"
            />
          </div>
        )}

        {/* Common Params Tab */}
        {activeTab === 'params' && (
          <div className="space-y-4">
            <div className="bg-surface border border-line p-3.5 rounded-xl text-xs text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                目录公共 Query：当前目录及子目录下接口发起请求时，将自动携带勾选的公共查询参数。
              </span>
            </div>
            <KeyValueTable
              items={commonParams}
              onChange={setCommonParams}
              keyPlaceholder="参数名 (例如 api_version)"
              valuePlaceholder="参数值 (例如 v2.0)"
            />
          </div>
        )}

        {/* Folder Description Tab */}
        {activeTab === 'desc' && (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-300 block">目录模块说明与业务规范</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              className="w-full bg-sidebar border border-line rounded-xl p-4 text-xs text-gray-200 focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
              placeholder="编写该模块的业务说明、规范文档或注意事项..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
