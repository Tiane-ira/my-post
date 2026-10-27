import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  FolderOpen,
  Layers,
  Check,
  ExternalLink,
  HardDrive,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { ProjectInfo, ApipostScannedProject } from '../../../common/types';
import { useFeedback } from './FeedbackContext';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectInfo[];
  currentProject: ProjectInfo | null;
  onSelectProject: (p: ProjectInfo) => void;
  onCreateProject: (name: string, intro: string, customPath?: string) => Promise<void>;
  onUpdateProject?: (projectId: string, updates: { name: string; intro: string }) => Promise<ProjectInfo | null>;
  onDeleteProject?: (projectId: string, deleteFiles: boolean) => Promise<boolean>;
  onRefreshProjects?: () => Promise<void>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
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

  // Project Edit state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIntro, setEditIntro] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Project Delete state
  const [projectToDelete, setProjectToDelete] = useState<ProjectInfo | null>(null);
  const [deleteLocalFiles, setDeleteLocalFiles] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleScanApipost();
      setEditingProjectId(null);
      setProjectToDelete(null);
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

  // Start editing a project
  const handleStartEdit = (p: ProjectInfo) => {
    setEditingProjectId(p.project_id);
    setEditName(p.name);
    setEditIntro(p.intro || '');
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditName('');
    setEditIntro('');
  };

  const handleSaveEdit = async (projectId: string) => {
    if (!editName.trim()) {
      toast.warning('项目名称不能为空');
      return;
    }
    setIsSavingEdit(true);
    try {
      if (onUpdateProject) {
        await onUpdateProject(projectId, {
          name: editName.trim(),
          intro: editIntro.trim(),
        });
      } else {
        await window.mypostAPI.updateProject(projectId, {
          name: editName.trim(),
          intro: editIntro.trim(),
        });
        if (onRefreshProjects) {
          await onRefreshProjects();
        }
        toast.success(`项目 "${editName.trim()}" 信息已更新！`);
      }
      setEditingProjectId(null);
    } catch (err: any) {
      toast.error(`保存失败: ${err?.message || err}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Start deleting a project
  const handleStartDelete = (p: ProjectInfo) => {
    setProjectToDelete(p);
    setDeleteLocalFiles(false);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      if (onDeleteProject) {
        await onDeleteProject(projectToDelete.project_id, deleteLocalFiles);
      } else {
        await window.mypostAPI.deleteProject(projectToDelete.project_id, deleteLocalFiles);
        if (onRefreshProjects) {
          await onRefreshProjects();
        }
        toast.success(`项目 "${projectToDelete.name}" 已成功删除`);
      }
      setProjectToDelete(null);
    } catch (err: any) {
      toast.error(`删除失败: ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[680px] max-h-[88vh] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs relative">
        {/* Header */}
        <div className="h-12 px-5 bg-subtle border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Layers className="w-4 h-4 text-accent" />
            <span>本地项目管理、编辑与载入</span>
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
                <label className="block text-gray-400 mb-1">项目名称 *</label>
                <input
                  type="text"
                  placeholder="例如：商城接口项目"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  className="flex-1 bg-subtle border border-line rounded-md px-2.5 py-1.5 text-gray-300 font-mono focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleSelectDir}
                  className="px-3 py-1.5 bg-subtle hover:bg-hover border border-line text-gray-200 rounded-md font-medium transition flex items-center gap-1"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  浏览
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white font-bold transition disabled:opacity-50 shadow-sm"
            >
              {isCreating ? '创建中...' : '确认创建项目'}
            </button>
          </div>

          {/* Existing Projects List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-300">
                已管理的本地项目 ({projects.length})
              </span>
              <span className="text-[11px] text-gray-500">
                支持编辑项目名称与描述，或彻底删除/解绑项目
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-line rounded-xl p-2.5 bg-surface">
              {projects.map((p) => {
                const isSelected = currentProject?.project_id === p.project_id;
                const isEditing = editingProjectId === p.project_id;

                return (
                  <div
                    key={p.project_id}
                    className={`rounded-lg border transition ${
                      isSelected
                        ? 'bg-accent/10 border-accent/40 text-foreground'
                        : 'bg-subtle/40 border-line text-gray-300 hover:border-line'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Edit Form */
                      <div className="p-3 space-y-2.5 bg-subtle/80 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-accent text-xs flex items-center gap-1.5">
                            <Edit2 className="w-3.5 h-3.5" />
                            编辑项目信息
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            ID: {p.project_id}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-400 mb-1">
                              项目名称 *
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEdit(p.project_id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              className="w-full bg-surface border border-line rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-400 mb-1">
                              项目说明 / 描述
                            </label>
                            <input
                              type="text"
                              value={editIntro}
                              onChange={(e) => setEditIntro(e.target.value)}
                              placeholder="项目简要说明"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEdit(p.project_id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              className="w-full bg-surface border border-line rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="px-2.5 py-1 rounded bg-hover hover:bg-line text-gray-300 text-xs transition"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(p.project_id)}
                            disabled={isSavingEdit}
                            className="px-3 py-1 rounded bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <Save className="w-3 h-3" />
                            {isSavingEdit ? '保存中...' : '保存修改'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal Display Card */
                      <div className="p-2.5 flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate text-foreground">
                              {p.name}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-accent text-white font-semibold">
                                当前活跃
                              </span>
                            )}
                          </div>
                          {p.intro && (
                            <div className="text-[11px] text-gray-400 truncate mt-0.5">
                              {p.intro}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                            {p.path}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(p)}
                            className="p-1.5 rounded hover:bg-hover text-gray-400 hover:text-accent transition"
                            title="编辑项目信息"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartDelete(p)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition"
                            title="删除项目"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => window.mypostAPI.openPath(p.path)}
                            className="p-1.5 rounded hover:bg-hover text-gray-400 hover:text-foreground transition"
                            title="在系统文件管理器中打开"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {!isSelected && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectProject(p);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded bg-subtle hover:bg-accent hover:text-white border border-line text-xs text-gray-300 font-medium transition ml-1"
                            >
                              切换
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {projectToDelete && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-[460px] bg-surface border border-red-500/30 rounded-xl shadow-2xl p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>确认删除项目</span>
              </div>

              <div className="text-xs text-gray-300 space-y-2">
                <p>
                  你确定要删除项目 <strong className="text-white">「{projectToDelete.name}」</strong> 吗？
                </p>
                <div className="font-mono text-[11px] text-gray-400 bg-subtle p-2 rounded border border-line break-all">
                  路径: {projectToDelete.path}
                </div>

                {projects.length === 1 && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded text-[11px]">
                    ⚠️ 这是当前唯一的项目。删除后将自动为您重置一个空的默认项目。
                  </div>
                )}

                {currentProject?.project_id === projectToDelete.project_id && projects.length > 1 && (
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded text-[11px]">
                    ℹ️ 该项目是当前活跃项目，删除后将自动切换至其他可用项目。
                  </div>
                )}

                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={deleteLocalFiles}
                      onChange={(e) => setDeleteLocalFiles(e.target.checked)}
                      className="rounded accent-red-500 w-3.5 h-3.5"
                    />
                    <span className="text-red-400/90 font-medium">
                      同时彻底删除本地磁盘文件夹及全部数据 (不可恢复)
                    </span>
                  </label>
                  <p className="text-[10px] text-gray-500 ml-5 mt-0.5">
                    未勾选时仅从 mypost 列表中解除管理，本地磁盘数据依然安全保留。
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 text-xs transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? '正在删除...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
