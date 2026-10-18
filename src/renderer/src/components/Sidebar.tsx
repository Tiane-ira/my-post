import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder,
  FolderOpen,
  FileText,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Upload,
  FilePlus,
  FolderPlus,
  Copy,
  ChevronsDown,
  ChevronsUp,
  Share2,
  Settings,
  PanelLeftClose,
  Edit2,
  Radio,
  Zap
} from 'lucide-react';
import { ApiTreeNode, HttpMethod } from '../../../common/types';
import { TreeUtils } from '../../../common/treeUtils';
import { useFeedback } from './FeedbackContext';
import { Tooltip } from './Tooltip';

interface SidebarProps {
  treeItems: ApiTreeNode[];
  activeApiId: string | null;
  onSelectApi: (targetId: string) => void;
  onSelectFolder?: (targetId: string) => void;
  onCreateApi: (parentId?: string, targetType?: 'api' | 'sse' | 'websocket') => void;
  onCreateFolder: (parentId?: string) => void;
  onCloneApi?: (targetId: string) => void;
  onDeleteNode: (targetId: string) => void;
  onClearRootApis?: () => void;
  onRenameNode?: (targetId: string, newName: string) => void;
  onReorderTree?: (items: ApiTreeNode[], movedId?: string, newParentId?: string) => void;
  onMoveApi?: (targetId: string, newParentId: string) => void;
  onOpenImport: () => void;
  onOpenShareFolder?: (folderId: string) => void;
  onOpenSettings: () => void;
}

interface DragOverState {
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

interface ContextMenuState {
  x: number;
  y: number;
  node: ApiTreeNode;
  isRoot?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  treeItems,
  activeApiId,
  onSelectApi,
  onSelectFolder,
  onCreateApi,
  onCreateFolder,
  onCloneApi,
  onDeleteNode,
  onClearRootApis,
  onRenameNode,
  onReorderTree,
  onOpenImport,
  onOpenShareFolder,
  onOpenSettings,
}) => {
  const { confirm, toast } = useFeedback();
  const [isRootCollapsed, setIsRootCollapsed] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

  // Drag and Drop state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<DragOverState | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Inline rename state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Top action dropdown state
  const [showNewApiDropdown, setShowNewApiDropdown] = useState(false);
  const newApiDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingNodeId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingNodeId]);

  // Close context menu and dropdown on global click or Escape
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setContextMenu(null);
      if (newApiDropdownRef.current && !newApiDropdownRef.current.contains(e.target as Node)) {
        setShowNewApiDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setEditingNodeId(null);
        setShowNewApiDropdown(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllFolders = () => {
    setIsRootCollapsed(false);
    setCollapsedFolders({});
  };

  const collapseAllFolders = () => {
    const allCollapsed: Record<string, boolean> = {};
    for (const item of treeItems || []) {
      if (item.target_type === 'folder') {
        allCollapsed[item.target_id] = true;
      }
    }
    setCollapsedFolders(allCollapsed);
  };

  const handleClearRootConfirm = async () => {
    const totalCount = (treeItems || []).filter((i) => i.target_type === 'api').length;
    const ok = await confirm({
      title: '清空根目录下所有接口',
      message: `确定要清空根目录下的所有接口与子目录吗？此操作将永久清空当前项目下的全部接口数据 (${totalCount} 个接口)，且无法恢复。`,
      type: 'danger',
      confirmText: '确认清空全部',
      cancelText: '取消',
    });
    if (ok) {
      if (onClearRootApis) {
        onClearRootApis();
      } else {
        const top = (treeItems || []).filter((i) => i.parent_id === '0' || !i.parent_id);
        for (const item of top) {
          onDeleteNode(item.target_id);
        }
      }
      toast.success('已清空根目录下的所有接口');
    }
  };

  const getMethodBadge = (method: HttpMethod | '', targetType?: string) => {
    if (targetType === 'sse') {
      return <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1 rounded min-w-[28px] text-center shrink-0 font-mono">SSE</span>;
    }
    if (targetType === 'websocket') {
      return <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-1 rounded min-w-[28px] text-center shrink-0 font-mono">WS</span>;
    }
    switch (method) {
      case 'GET':
        return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded min-w-[28px] text-center shrink-0">GET</span>;
      case 'POST':
        return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1 rounded min-w-[28px] text-center shrink-0">POST</span>;
      case 'PUT':
        return <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1 rounded min-w-[28px] text-center shrink-0">PUT</span>;
      case 'DELETE':
        return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded min-w-[28px] text-center shrink-0">DEL</span>;
      case 'PATCH':
        return <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1 rounded min-w-[28px] text-center shrink-0">PAT</span>;
      default:
        return <span className="text-[10px] font-bold text-gray-400 bg-gray-500/10 px-1 rounded min-w-[28px] text-center shrink-0">DOC</span>;
    }
  };

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return treeItems || [];
    const q = searchQuery.toLowerCase();
    const matchingIds = new Set<string>();

    for (const item of treeItems || []) {
      const matches =
        (item.name || '').toLowerCase().includes(q) ||
        (item.url || '').toLowerCase().includes(q);
      if (matches) {
        matchingIds.add(item.target_id);
        let curr = item;
        const visited = new Set<string>();
        while (curr.parent_id && curr.parent_id !== '0' && !visited.has(curr.parent_id)) {
          visited.add(curr.parent_id);
          matchingIds.add(curr.parent_id);
          const parent = (treeItems || []).find((t) => t.target_id === curr.parent_id);
          if (!parent) break;
          curr = parent;
        }
      }
    }

    return (treeItems || []).filter((item) => matchingIds.has(item.target_id));
  }, [treeItems, searchQuery]);

  const topLevelItems = filteredItems.filter((i) => i.parent_id === '0' || !i.parent_id);
  const getChildren = (parentId: string) => filteredItems.filter((i) => i.parent_id === parentId);

  // Determine current active folder context for top action buttons
  const currentActiveFolderId = React.useMemo(() => {
    if (!activeApiId || activeApiId === '0') return '0';
    const node = (treeItems || []).find((t) => t.target_id === activeApiId);
    if (node?.target_type === 'folder') return node.target_id;
    if (node?.parent_id && node.parent_id !== '0') return node.parent_id;
    return '0';
  }, [activeApiId, treeItems]);

  // Check if childCandidateId is a descendant of parentCandidateId
  const isDescendant = (parentCandidateId: string, childCandidateId: string): boolean => {
    let current = treeItems.find((t) => t.target_id === childCandidateId);
    const visited = new Set<string>();
    while (current && !visited.has(current.target_id)) {
      visited.add(current.target_id);
      if (current.parent_id === parentCandidateId) return true;
      if (!current.parent_id || current.parent_id === '0') break;
      current = treeItems.find((t) => t.target_id === current!.parent_id);
    }
    return false;
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, node: ApiTreeNode) => {
    if (editingNodeId) {
      e.preventDefault();
      return;
    }
    setDraggedNodeId(node.target_id);
    e.dataTransfer.setData('text/plain', node.target_id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetNode: ApiTreeNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNodeId || draggedNodeId === targetNode.target_id) return;
    if (isDescendant(draggedNodeId, targetNode.target_id)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const height = rect.height;

    let pos: 'before' | 'after' | 'inside';
    if (targetNode.target_type === 'folder') {
      if (offset < height * 0.28) {
        pos = 'before';
      } else if (offset > height * 0.72) {
        pos = 'after';
      } else {
        pos = 'inside';
      }
    } else {
      pos = offset < height * 0.5 ? 'before' : 'after';
    }

    if (dragOverInfo?.targetId !== targetNode.target_id || dragOverInfo?.position !== pos) {
      setDragOverInfo({ targetId: targetNode.target_id, position: pos });
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetNode: ApiTreeNode) => {
    e.stopPropagation();
    if (dragOverInfo?.targetId === targetNode.target_id) {
      setDragOverInfo(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setDragOverInfo(null);
  };

  const handleDrop = (e: React.DragEvent, targetNode: ApiTreeNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedNodeId || !dragOverInfo || draggedNodeId === targetNode.target_id) {
      setDraggedNodeId(null);
      setDragOverInfo(null);
      return;
    }

    const { position } = dragOverInfo;
    executeMove(draggedNodeId, targetNode.target_id, position);
    setDraggedNodeId(null);
    setDragOverInfo(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNodeId) return;
    if (dragOverInfo?.targetId !== '0' || dragOverInfo?.position !== 'inside') {
      setDragOverInfo({ targetId: '0', position: 'inside' });
    }
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNodeId) {
      setDraggedNodeId(null);
      setDragOverInfo(null);
      return;
    }
    executeMove(draggedNodeId, '0', 'inside');
    setDraggedNodeId(null);
    setDragOverInfo(null);
  };

  // Helper to reorder tree and update parent_id
  const executeMove = (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => {
    if (!onReorderTree) return;
    const sourceNode = treeItems.find((t) => t.target_id === sourceId);
    if (!sourceNode) return;

    // Collect all descendant ids of source if it's a folder
    const descendantIds: string[] = [];
    const collectDescendants = (parentId: string) => {
      const children = treeItems.filter((t) => t.parent_id === parentId);
      for (const child of children) {
        descendantIds.push(child.target_id);
        if (child.target_type === 'folder') {
          collectDescendants(child.target_id);
        }
      }
    };
    if (sourceNode.target_type === 'folder') {
      collectDescendants(sourceId);
    }

    const movingSubtree = treeItems.filter(
      (t) => t.target_id === sourceId || descendantIds.includes(t.target_id)
    );
    const remainingTree = treeItems.filter(
      (t) => t.target_id !== sourceId && !descendantIds.includes(t.target_id)
    );

    if (targetId === '0') {
      const updatedSourceSubtree = movingSubtree.map((item) => {
        if (item.target_id === sourceId) {
          return { ...item, parent_id: '0', updated_at: new Date().toISOString() };
        }
        return item;
      });
      const newTree = [...remainingTree, ...updatedSourceSubtree].map((item, idx) => ({
        ...item,
        sort: (idx + 1) * 1000,
      }));
      onReorderTree(newTree, sourceId, '0');
      toast.success(`已移动 "${sourceNode.name}" 到根目录`);
      return;
    }

    const targetNode = treeItems.find((t) => t.target_id === targetId);
    if (!targetNode) return;

    let newParentId = '0';
    let insertIndex = 0;

    if (position === 'inside') {
      newParentId = targetNode.target_id;
      // Auto expand target folder
      setCollapsedFolders((prev) => ({ ...prev, [targetNode.target_id]: false }));
      const targetIdx = remainingTree.findIndex((t) => t.target_id === targetId);
      insertIndex = targetIdx + 1;
    } else if (position === 'before') {
      newParentId = targetNode.parent_id || '0';
      const targetIdx = remainingTree.findIndex((t) => t.target_id === targetId);
      insertIndex = Math.max(0, targetIdx);
    } else {
      // after
      newParentId = targetNode.parent_id || '0';
      const targetIdx = remainingTree.findIndex((t) => t.target_id === targetId);
      insertIndex = targetIdx + 1;
    }

    // Update parent_id of sourceNode
    const updatedSourceSubtree = movingSubtree.map((item) => {
      if (item.target_id === sourceId) {
        return { ...item, parent_id: newParentId, updated_at: new Date().toISOString() };
      }
      return item;
    });

    const newTree = [
      ...remainingTree.slice(0, insertIndex),
      ...updatedSourceSubtree,
      ...remainingTree.slice(insertIndex),
    ].map((item, idx) => ({
      ...item,
      sort: (idx + 1) * 1000,
    }));

    onReorderTree(newTree, sourceId, newParentId);
    toast.success(`已移动 "${sourceNode.name}"`);
  };

  const handleDropToRootEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNodeId || !onReorderTree) {
      setDraggedNodeId(null);
      setDragOverInfo(null);
      return;
    }

    const sourceNode = treeItems.find((t) => t.target_id === draggedNodeId);
    if (!sourceNode) return;

    const descendantIds: string[] = [];
    const collectDescendants = (parentId: string) => {
      const children = treeItems.filter((t) => t.parent_id === parentId);
      for (const child of children) {
        descendantIds.push(child.target_id);
        if (child.target_type === 'folder') {
          collectDescendants(child.target_id);
        }
      }
    };
    if (sourceNode.target_type === 'folder') {
      collectDescendants(draggedNodeId);
    }

    const movingSubtree = treeItems.filter(
      (t) => t.target_id === draggedNodeId || descendantIds.includes(t.target_id)
    );
    const remainingTree = treeItems.filter(
      (t) => t.target_id !== draggedNodeId && !descendantIds.includes(t.target_id)
    );

    const updatedSourceSubtree = movingSubtree.map((item) => {
      if (item.target_id === draggedNodeId) {
        return { ...item, parent_id: '0', updated_at: new Date().toISOString() };
      }
      return item;
    });

    const newTree = [...remainingTree, ...updatedSourceSubtree].map((item, idx) => ({
      ...item,
      sort: (idx + 1) * 1000,
    }));

    onReorderTree(newTree, draggedNodeId, '0');
    toast.success(`已移动 "${sourceNode.name}" 至根目录`);
    setDraggedNodeId(null);
    setDragOverInfo(null);
  };

  // Context menu opening
  const handleContextMenu = (e: React.MouseEvent, node: ApiTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 185;
    const menuHeight = node.target_type === 'folder' ? 220 : 160;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x, y, node });
  };

  // Submit rename
  const handleRenameSubmit = (node: ApiTreeNode) => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== node.name && onRenameNode) {
      onRenameNode(node.target_id, trimmed);
      toast.success('已重命名');
    }
    setEditingNodeId(null);
    setEditingName('');
  };

  // Delete node with confirmation
  const handleDeleteConfirm = async (node: ApiTreeNode) => {
    const isFolder = node.target_type === 'folder';
    const ok = await confirm({
      title: isFolder ? '删除目录确认' : '删除接口确认',
      message: isFolder
        ? `确认删除目录 "${node.name}" 及其下所有子项吗？此操作无法撤销。`
        : `确认删除接口 "${node.name}" 吗？此操作无法撤销。`,
      type: 'danger',
      confirmText: '确认删除',
      cancelText: '取消',
    });
    if (ok) {
      onDeleteNode(node.target_id);
      toast.success(`已删除 "${node.name}"`);
    }
  };

  const renderNode = (
    node: ApiTreeNode,
    depth: number = 0,
    index: number = 0,
    ancestorIds: Set<string> = new Set()
  ) => {
    if (!node || depth > 25 || ancestorIds.has(node.target_id)) {
      return null;
    }
    const nextAncestors = new Set(ancestorIds);
    nextAncestors.add(node.target_id);

    const isFolder = node.target_type === 'folder';
    const isDoc = node.target_type === 'doc';
    const isCollapsed = collapsedFolders[node.target_id];
    const children = getChildren(node.target_id);
    const isSelected = activeApiId === node.target_id;
    const isEditing = editingNodeId === node.target_id;

    // Drag indicators
    const isOver = dragOverInfo?.targetId === node.target_id;
    const isDragged = draggedNodeId === node.target_id;

    let dragHighlightClass = '';
    if (isOver) {
      if (dragOverInfo.position === 'before') {
        dragHighlightClass = 'border-t-2 border-accent';
      } else if (dragOverInfo.position === 'after') {
        dragHighlightClass = 'border-b-2 border-accent';
      } else if (dragOverInfo.position === 'inside') {
        dragHighlightClass = 'bg-accent/20 ring-1 ring-accent';
      }
    }

    return (
      <div
        key={`${node.target_id}-${depth}-${index}`}
        className="select-none"
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        <div
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={(e) => handleDragLeave(e, node)}
          onDrop={(e) => handleDrop(e, node)}
          onDragEnd={handleDragEnd}
          onClick={() => {
            if (isEditing) return;
            if (isFolder) {
              if (onSelectFolder) {
                onSelectFolder(node.target_id);
              } else {
                setCollapsedFolders((prev) => ({ ...prev, [node.target_id]: !prev[node.target_id] }));
              }
            } else {
              onSelectApi(node.target_id);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-md cursor-pointer transition text-xs relative ${
            isDragged ? 'opacity-40' : ''
          } ${dragHighlightClass} ${
            isSelected
              ? isFolder
                ? 'bg-amber-500/15 text-amber-400 font-semibold'
                : 'bg-accent/15 text-accent font-semibold'
              : 'hover:bg-hover text-gray-300'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
            {isFolder ? (
              <span
                onClick={(e) => toggleFolder(node.target_id, e)}
                className="text-gray-400 hover:text-foreground shrink-0"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {isFolder ? (
              isCollapsed ? (
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              )
            ) : isDoc ? (
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            ) : (
              getMethodBadge(node.method, node.target_type)
            )}

            {isEditing ? (
              <input
                ref={renameInputRef}
                type="text"
                value={editingName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSubmit(node);
                  } else if (e.key === 'Escape') {
                    setEditingNodeId(null);
                  }
                }}
                onBlur={() => handleRenameSubmit(node)}
                className="bg-subtle border border-accent rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none flex-1 min-w-0"
              />
            ) : (
              <Tooltip
                content={node.name}
                placement="right"
                delayMs={250}
                onlyIfTruncated={true}
                className="min-w-0 flex-1 truncate"
              >
                <span className="truncate text-[12px] block">{node.name}</span>
              </Tooltip>
            )}
          </div>

          {/* Hover Actions: only delete button */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteConfirm(node);
              }}
              className="p-1 hover:bg-rose-500/20 rounded text-gray-400 hover:text-rose-400"
              title={isFolder ? "删除目录" : "删除接口"}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children Render */}
        {isFolder && !isCollapsed && children.length > 0 && (
          <div>{children.map((child, idx) => renderNode(child, depth + 1, idx, nextAncestors))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 flex flex-col h-full bg-sidebar border-r border-line relative shrink-0">
      {/* Search & Actions Bar */}
        <div className="p-2 border-b border-line flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="搜索接口与文档..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-subtle border border-line rounded-md pl-8 pr-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={expandAllFolders}
              className="p-1.5 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-foreground transition"
              title="全部展开目录"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={collapseAllFolders}
              className="p-1.5 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-foreground transition"
              title="全部折叠目录"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsTreeCollapsed(true)}
              className="p-1.5 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-foreground transition"
              title="完全收起接口列表栏"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <div ref={newApiDropdownRef} className="flex-1 relative flex items-center rounded-md bg-subtle border border-line shadow-xs">
              <button
                type="button"
                onClick={() => onCreateApi(currentActiveFolderId, 'api')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 hover:bg-hover text-gray-200 hover:text-white font-medium transition text-xs group rounded-l-md truncate"
                title="新建 HTTP 接口"
              >
                <FilePlus className="w-3.5 h-3.5 text-accent shrink-0 group-hover:scale-105 transition-transform" />
                <span className="truncate">新建接口</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewApiDropdown((prev) => !prev);
                }}
                className="px-1.5 py-1.5 border-l border-line hover:bg-hover text-gray-400 hover:text-gray-200 transition rounded-r-md shrink-0"
                title="选择新建接口类型"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Dropdown Menu */}
              {showNewApiDropdown && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-1 w-44 bg-surface border border-line rounded-lg shadow-2xl py-1 text-xs text-gray-200 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onCreateApi(currentActiveFolderId, 'api');
                      setShowNewApiDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <FilePlus className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>新建 HTTP 接口</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCreateApi(currentActiveFolderId, 'sse');
                      setShowNewApiDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>新建 SSE 流式接口</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCreateApi(currentActiveFolderId, 'websocket');
                      setShowNewApiDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>新建 WebSocket 接口</span>
                  </button>
                </div>
              )}
            </div>

            <Tooltip content="新建目录" placement="bottom">
              <button
                type="button"
                onClick={() => onCreateFolder(currentActiveFolderId)}
                className="p-1.5 rounded-md bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-amber-400 transition shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </Tooltip>

            {onOpenShareFolder && (
              <Tooltip content="分享文档" placement="bottom">
                <button
                  type="button"
                  onClick={() => onOpenShareFolder(currentActiveFolderId)}
                  className="p-1.5 rounded-md bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-sky-400 transition shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5 text-sky-400" />
                </button>
              </Tooltip>
            )}

            <Tooltip content="导入文档" placement="bottom">
              <button
                type="button"
                onClick={onOpenImport}
                className="p-1.5 rounded-md bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-blue-400 transition shrink-0"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Tree Container */}
        <div
          className="flex-1 overflow-y-auto p-1.5 space-y-0.5 flex flex-col"
          onDragOver={(e) => {
            if (draggedNodeId) {
              e.preventDefault();
            }
          }}
          onDrop={handleDropToRootEnd}
        >
          {/* Default Root Directory Node */}
          <div className="select-none mb-1">
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  node: {
                    target_id: '0',
                    parent_id: '',
                    target_type: 'folder',
                    name: '根目录',
                    method: '',
                    url: '',
                    sort: 0,
                    status: 1,
                  },
                  isRoot: true,
                });
              }}
              onDragOver={handleRootDragOver}
              onDragLeave={() => {
                if (dragOverInfo?.targetId === '0') setDragOverInfo(null);
              }}
              onDrop={handleRootDrop}
              onClick={() => {
                if (onSelectFolder) {
                  onSelectFolder('0');
                } else {
                  setIsRootCollapsed((prev) => !prev);
                }
              }}
              className={`group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition text-xs relative ${
                dragOverInfo?.targetId === '0' ? 'bg-accent/20 ring-1 ring-accent' : ''
              } ${
                activeApiId === '0'
                  ? 'bg-amber-500/15 text-amber-400 font-semibold'
                  : 'hover:bg-hover text-gray-300 font-medium'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRootCollapsed((prev) => !prev);
                  }}
                  className="text-gray-400 hover:text-foreground shrink-0 p-0.5"
                >
                  {isRootCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>

                {isRootCollapsed ? (
                  <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                )}

                <Tooltip
                  content="根目录"
                  placement="right"
                  delayMs={250}
                  onlyIfTruncated={true}
                  className="min-w-0 flex-1 truncate"
                >
                  <span className="truncate text-[12px] block font-semibold text-gray-200">根目录</span>
                </Tooltip>
              </div>

              {/* Hover Actions for Root Directory: only delete button */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearRootConfirm();
                  }}
                  className="p-1 hover:bg-rose-500/20 rounded text-gray-400 hover:text-rose-400"
                  title="清空根目录下所有接口"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Root Children */}
            {!isRootCollapsed && (
              <div className="space-y-0.5 mt-0.5">
                {topLevelItems.length === 0 ? (
                  <div className="py-6 px-4 text-center text-gray-500 text-xs select-none">
                    暂无接口数据
                  </div>
                ) : (
                  topLevelItems.map((item, idx) => renderNode(item, 1, idx))
                )}
              </div>
            )}
          </div>

          {/* Droppable space at bottom of tree to easily drop into root */}
          <div
            className="flex-1 min-h-[48px]"
            onDragOver={(e) => {
              if (draggedNodeId) {
                e.preventDefault();
              }
            }}
            onDrop={handleDropToRootEnd}
          />
        </div>

      {/* Context Menu for Folder & API */}
      {contextMenu &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-44 bg-surface border border-line rounded-lg shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {contextMenu.isRoot ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onCreateApi('0', 'api');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <FilePlus className="w-3.5 h-3.5 text-accent" />
                  <span>新建 HTTP 接口</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateApi('0', 'sse');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span>新建 SSE 接口</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateApi('0', 'websocket');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  <span>新建 WebSocket 接口</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateFolder('0');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>新建子目录</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenImport();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>导入接口文档</span>
                </button>
                {onOpenShareFolder && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenShareFolder('0');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>分享根目录文档</span>
                  </button>
                )}
                <div className="h-[1px] bg-line my-1" />
                <button
                  type="button"
                  onClick={() => {
                    expandAllFolders();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <ChevronsDown className="w-3.5 h-3.5 text-gray-400" />
                  <span>全部展开</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    collapseAllFolders();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <ChevronsUp className="w-3.5 h-3.5 text-gray-400" />
                  <span>全部折叠</span>
                </button>
                <div className="h-[1px] bg-line my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setContextMenu(null);
                    handleClearRootConfirm();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 flex items-center gap-2 text-rose-400 font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清空所有接口</span>
                </button>
              </>
            ) : contextMenu.node.target_type === 'folder' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNodeId(contextMenu.node.target_id);
                    setEditingName(contextMenu.node.name);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>重命名目录</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateApi(contextMenu.node.target_id, 'api');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <FilePlus className="w-3.5 h-3.5 text-accent" />
                  <span>新建 HTTP 接口</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateApi(contextMenu.node.target_id, 'sse');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span>新建 SSE 接口</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateApi(contextMenu.node.target_id, 'websocket');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  <span>新建 WebSocket 接口</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCreateFolder(contextMenu.node.target_id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>新建子目录</span>
                </button>
                {onOpenShareFolder && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenShareFolder(contextMenu.node.target_id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>分享目录文档</span>
                  </button>
                )}
                <div className="h-[1px] bg-line my-1" />
                <button
                  type="button"
                  onClick={() => {
                    const node = contextMenu.node;
                    setContextMenu(null);
                    handleDeleteConfirm(node);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 flex items-center gap-2 text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除目录</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNodeId(contextMenu.node.target_id);
                    setEditingName(contextMenu.node.name);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>重命名接口</span>
                </button>
                {onCloneApi && (
                  <button
                    type="button"
                    onClick={() => {
                      onCloneApi(contextMenu.node.target_id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                    <span>克隆接口</span>
                  </button>
                )}
                <div className="h-[1px] bg-line my-1" />
                <button
                  type="button"
                  onClick={() => {
                    const node = contextMenu.node;
                    setContextMenu(null);
                    handleDeleteConfirm(node);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 flex items-center gap-2 text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除接口</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
