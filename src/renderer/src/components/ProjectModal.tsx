import React, { useState, useEffect } from 'react';
import { X, Plus, Folder, FolderOpen, Layers, Check, ExternalLink, HardDrive, RefreshCw } from 'lucide-react';
import { ProjectInfo, ApipostScannedProject } from '../../../common/types';
import { useFeedback } from './FeedbackContext';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectInfo[];
  currentProject: ProjectInfo | null;
  onSelectProject: (p: ProjectInfo) => void;
  onCreateProject: (name: string, intro: string, customPath?: string) => Promise<void>;
  onRefreshProjects?: () => Promise<void>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  onRefreshProjects,
}) => {
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Scanned Apipost Projects
  const [scannedApipostProjects, setScannedApipostProjects] = useState<ApipostScannedProject[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleScanApipost();
    }
  }, [isOpen]);

  const handleScanApipost = async () => {
    setIsScanning(true);
    try {
      const list = await window.mypostAPI.scanApipostProjects();
      setScannedApipostProjects(list);
    } catch (e) {
      console.warn('Failed to scan Apipost projects:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleImportApipost = async (scanned: ApipostScannedProject) => {
    try {
      const imported = await window.mypostAPI.importApipostProject(scanned.project_id, scanned.path);
      if (imported) {
        if (onRefreshProjects) {
          await onRefreshProjects();
        }
        onSelectProject(imported);
        toast.success(`✨ 已成功载入本地项目 "${scanned.name}" (${scanned.apiCount} 个接口)！`);
        onClose();
      }
    } catch (e: any) {
      toast.error(`导入项目失败: ${e?.message || e}`);
    }
  };

  if (!isOpen) return null;

  const handleSelectDir = async () => {
    const dir = await window.mypostAPI.selectDirectory();
    if (dir) {
      setCustomPath(dir);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.warning('请输入项目名称');
      return;
    }
    setIsCreating(true);
    try {
      await onCreateProject(name.trim(), intro.trim(), customPath.trim() || undefined);
      toast.success(`项目 "${name.trim()}" 创建成功！`);
      setName('');
      setIntro('');
      setCustomPath('');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[660px] max-h-[85vh] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="h-12 px-5 bg-subtle border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Layers className="w-4 h-4 text-accent" />
            <span>本地离线项目管理与导入</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Apipost Standalone Detection Banner */}
          <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                <HardDrive className="w-4 h-4 text-blue-400" />
                <span>本地已有离线工程数据检测 (零损耗无缝载入)</span>
              </div>
              <button
                type="button"
                onClick={handleScanApipost}
                disabled={isScanning}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                <span>重新扫描</span>
              </button>
            </div>

            {scannedApipostProjects.length > 0 ? (
              <div className="space-y-1.5 mt-2">
                {scannedApipostProjects.map((ap) => (
                  <div
                    key={ap.project_id}
                    className="p-2.5 rounded-lg bg-surface border border-line flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-200">{ap.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                          {ap.apiCount} 个接口
                        </span>
                        {ap.isImported && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> 已在 mypost 中
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                        {ap.path}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleImportApipost(ap)}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-sm"
                    >
                      {ap.isImported ? '切换至该项目' : '一键载入/挂载'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-400">
                {isScanning ? '正在扫描本地离线工程数据...' : '未在默认目录发现历史离线项目，可手动创建新项目或指定自定义本地目录'}
              </div>
            )}
          </div>

          {/* Create Project Form */}
          <div className="p-3.5 bg-surface border border-line rounded-xl space-y-3">
            <div className="font-semibold text-gray-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-accent" />
              <span>新建本地项目</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 mb-1">项目名称</label>
                <input
                  type="text"
                  placeholder="例如：商城接口项目"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-subtle border border-line rounded-md px-2.5 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">项目说明 (可选)</label>
                <input
                  type="text"
                  placeholder="项目简短描述"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  className="w-full bg-subtle border border-line rounded-md px-2.5 py-1.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">自定义本地存储路径 (留空则使用默认路径)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="默认位于 userData/offline-data/<projectId>"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  className="flex-1 bg-subtle border border-line rounded-md px-2.5 py-1.5 text-gray-300 font-mono focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSelectDir}
                  className="px-3 py-1.5 bg-subtle hover:bg-hover border border-line text-gray-200 rounded-md font-medium transition flex items-center gap-1"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  浏览
                </button>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-bold transition disabled:opacity-50"
            >
              {isCreating ? '创建中...' : '确认创建项目'}
            </button>
          </div>

          {/* Existing Projects List */}
          <div>
            <div className="font-semibold text-gray-300 mb-2">已发现的本地项目</div>
            <div className="max-h-52 overflow-y-auto space-y-1.5 border border-line rounded-xl p-2 bg-surface">
              {projects.map((p) => {
                const isSelected = currentProject?.project_id === p.project_id;
                return (
                  <div
                    key={p.project_id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-accent/10 border-accent/30 text-foreground'
                        : 'bg-surface border-line text-gray-300 hover:border-line'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate">{p.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-accent text-white font-semibold">
                            当前活跃
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                        {p.path}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.mypostAPI.openPath(p.path)}
                        className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground transition"
                        title="在系统文件管理器中打开"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      {!isSelected && (
                        <button
                          onClick={() => {
                            onSelectProject(p);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-subtle hover:bg-accent hover:text-foreground border border-line text-xs text-gray-300 font-medium transition"
                        >
                          切换
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
