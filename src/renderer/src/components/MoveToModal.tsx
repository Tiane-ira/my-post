import React, { useState, useMemo, useEffect } from 'react';
import { X, Folder, FolderCheck, ArrowRight, Search, Check } from 'lucide-react';
import { ApiTreeNode } from '../../../common/types';
import { TreeUtils } from '../../../common/treeUtils';

interface MoveToModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode: {
    target_id: string;
    name: string;
    parent_id?: string;
    target_type?: string;
  } | null;
  treeItems: ApiTreeNode[];
  onMove: (targetId: string, newParentId: string) => Promise<void> | void;
}

export const MoveToModal: React.FC<MoveToModalProps> = ({
  isOpen,
  onClose,
  targetNode,
  treeItems,
  onMove,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('0');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentParentId = useMemo(() => {
    if (!targetNode) return '0';
    const inTree = treeItems.find((t) => t.target_id === targetNode.target_id);
    return inTree ? inTree.parent_id || '0' : targetNode.parent_id || '0';
  }, [targetNode, treeItems]);

  useEffect(() => {
    if (isOpen) {
      setSelectedFolderId(currentParentId);
      setSearchQuery('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentParentId]);

  // Compute excluded folder IDs (self + descendants if targetNode is a folder)
  const excludedFolderIds = useMemo(() => {
    const set = new Set<string>();
    if (!targetNode || targetNode.target_type !== 'folder') return set;

    set.add(targetNode.target_id);
    const collectDescendants = (parentId: string) => {
      const children = treeItems.filter((t) => t.parent_id === parentId && t.target_type === 'folder');
      for (const child of children) {
        set.add(child.target_id);
        collectDescendants(child.target_id);
      }
    };
    collectDescendants(targetNode.target_id);
    return set;
  }, [targetNode, treeItems]);

  const folderOptions = useMemo(() => {
    const all = TreeUtils.getOrderedFolderOptions(treeItems);
    return all.filter((f) => !excludedFolderIds.has(f.id));
  }, [treeItems, excludedFolderIds]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return folderOptions;
    const q = searchQuery.toLowerCase().trim();
    return folderOptions.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
  }, [folderOptions, searchQuery]);

  if (!isOpen || !targetNode) return null;

  const handleConfirm = async () => {
    if (selectedFolderId === currentParentId) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      await onMove(targetNode.target_id, selectedFolderId);
      onClose();
    } catch (e) {
      console.error('Failed to move:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFolder = targetNode.target_type === 'folder';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <FolderCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                移动{isFolder ? '目录' : '接口'}到新目录
              </h3>
              <p className="text-xs text-gray-400 truncate max-w-[280px]">
                当前：<span className="text-foreground font-medium">{targetNode.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-hover transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-line bg-surface">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索目标目录..."
              className="w-full pl-9 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs text-foreground placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[220px]">
          {filteredOptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              未找到匹配的目录
            </div>
          ) : (
            filteredOptions.map((f) => {
              const isSelected = selectedFolderId === f.id;
              const isCurrent = currentParentId === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  style={{ paddingLeft: `${Math.max(f.depth * 14 + 10, 10)}px` }}
                  className={`flex items-center justify-between py-2 pr-3 rounded-lg cursor-pointer text-xs transition border ${
                    isSelected
                      ? 'bg-accent/15 border-accent text-accent font-medium'
                      : 'border-transparent hover:bg-hover text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                    <Folder
                      className={`w-4 h-4 shrink-0 ${
                        f.id === '0'
                          ? 'text-sky-400'
                          : isSelected
                          ? 'text-accent'
                          : 'text-amber-400'
                      }`}
                    />
                    <span className="truncate">{f.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-subtle text-gray-400 shrink-0 border border-line">
                        当前位置
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-accent shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-line bg-subtle">
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <span>目标：</span>
            <span className="text-foreground font-medium">
              {folderOptions.find((f) => f.id === selectedFolderId)?.name || '未选择'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs rounded-lg border border-line text-gray-300 hover:bg-hover transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || selectedFolderId === currentParentId}
              className={`px-4 py-1.5 text-xs rounded-lg font-medium transition flex items-center gap-1.5 ${
                selectedFolderId === currentParentId
                  ? 'bg-subtle text-gray-500 border border-line cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-white shadow-sm'
              }`}
            >
              {isSubmitting ? (
                <span>移动中...</span>
              ) : (
                <>
                  <span>确认移动</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
