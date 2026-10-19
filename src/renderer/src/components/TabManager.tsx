import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Folder,
  Save,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Radio,
  Zap,
  PanelLeftOpen,
} from 'lucide-react';
import { HttpMethod } from '../../../common/types';

export interface TabItem {
  id: string;
  name: string;
  method?: HttpMethod | '';
  type?: 'api' | 'folder' | 'sse' | 'websocket';
  isDirty?: boolean;
}

interface TabManagerProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab: (type?: 'api' | 'sse' | 'websocket') => void;
  onSaveAll?: () => void;
  onCloseOthers?: (id: string) => void;
  onCloseRight?: (id: string) => void;
  onCloseLeft?: (id: string) => void;
  onCloseAll?: () => void;
  isSidebarCollapsed?: boolean;
  onExpandSidebar?: () => void;
}

interface TabContextMenuState {
  x: number;
  y: number;
  tabId: string | null;
}

export const TabManager: React.FC<TabManagerProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onSaveAll,
  onCloseOthers,
  onCloseRight,
  onCloseLeft,
  onCloseAll,
  isSidebarCollapsed = false,
  onExpandSidebar,
}) => {
  const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 175;
    const menuHeight = 230;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x, y, tabId });
  };

  const handleEmptyBarContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuWidth = 175;
    const menuHeight = 130;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);
    setContextMenu({ x, y, tabId: null });
  };

  const getMethodColor = (m?: HttpMethod | '') => {
    switch (m) {
      case 'GET': return 'text-emerald-400';
      case 'POST': return 'text-amber-400';
      case 'PUT': return 'text-blue-400';
      case 'DELETE': return 'text-rose-400';
      case 'PATCH': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const currentTabIdx = contextMenu?.tabId ? tabs.findIndex((t) => t.id === contextMenu.tabId) : -1;
  const isFirstTab = currentTabIdx === 0;
  const isLastTab = currentTabIdx === tabs.length - 1;
  const isSingleTab = tabs.length <= 1;

  return (
    <div
      onContextMenu={handleEmptyBarContextMenu}
      className="h-9 bg-subtle border-b border-line flex items-center px-1 overflow-x-auto select-none relative"
    >
      <div className="flex items-center gap-1">
        {isSidebarCollapsed && onExpandSidebar && (
          <button
            type="button"
            onClick={onExpandSidebar}
            className="p-1.5 mr-0.5 rounded hover:bg-hover border border-line text-gray-400 hover:text-accent transition shrink-0 flex items-center justify-center group"
            title="展开接口列表栏 (Ctrl+B)"
          >
            <PanelLeftOpen className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
          </button>
        )}
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isFolder = tab.type === 'folder' || !tab.method;
          return (
            <div
              key={`${tab.id}-${index}`}
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-t-2 transition max-w-[180px] ${
                isActive
                  ? 'bg-surface border-accent text-foreground font-medium shadow-sm'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-hover'
              }`}
            >
              {tab.type === 'folder' ? (
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : tab.type === 'sse' ? (
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1 rounded shrink-0 font-mono">
                  SSE
                </span>
              ) : tab.type === 'websocket' ? (
                <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-1 rounded shrink-0 font-mono">
                  WS
                </span>
              ) : !tab.method ? (
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <span className={`text-[10px] font-bold shrink-0 ${getMethodColor(tab.method)} font-mono`}>
                  {tab.method}
                </span>
              )}
              <span className="truncate flex-1" title={tab.name}>
                {tab.name || '未命名'}
              </span>

              {/* Dirty indicator or Close button */}
              <div className="flex items-center justify-center w-4 h-4 shrink-0">
                {tab.isDirty ? (
                  <span
                    onClick={(e) => onCloseTab(tab.id, e)}
                    className="w-2 h-2 rounded-full bg-accent group-hover:hidden"
                    title="有未保存修改"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className={`p-0.5 rounded-full hover:bg-hover text-gray-400 hover:text-foreground ${
                    tab.isDirty ? 'hidden group-hover:flex' : 'flex'
                  }`}
                  title="关闭标签"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => onNewTab('api')}
          className="p-1.5 ml-1 rounded hover:bg-hover text-gray-400 hover:text-foreground transition shrink-0"
          title="新建空白请求标签"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Context Menu */}
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
            className="w-48 bg-surface border border-line rounded-lg shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {contextMenu.tabId ? (
              <>
                {onSaveAll && (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveAll();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center justify-between text-gray-200 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Save className="w-3.5 h-3.5 text-emerald-400" />
                      <span>全部保存</span>
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    if (contextMenu.tabId) {
                      onCloseTab(contextMenu.tabId, e);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                  <span>关闭</span>
                </button>
                <button
                  type="button"
                  disabled={isSingleTab}
                  onClick={() => {
                    if (contextMenu.tabId && onCloseOthers) {
                      onCloseOthers(contextMenu.tabId);
                    }
                    setContextMenu(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition ${
                    isSingleTab
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'hover:bg-hover text-gray-200'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>关闭其他标签</span>
                </button>
                <button
                  type="button"
                  disabled={isLastTab}
                  onClick={() => {
                    if (contextMenu.tabId && onCloseRight) {
                      onCloseRight(contextMenu.tabId);
                    }
                    setContextMenu(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition ${
                    isLastTab
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'hover:bg-hover text-gray-200'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>关闭右侧标签</span>
                </button>
                <button
                  type="button"
                  disabled={isFirstTab}
                  onClick={() => {
                    if (contextMenu.tabId && onCloseLeft) {
                      onCloseLeft(contextMenu.tabId);
                    }
                    setContextMenu(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition ${
                    isFirstTab
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'hover:bg-hover text-gray-200'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
                  <span>关闭左侧标签</span>
                </button>
                <div className="h-[1px] bg-line my-1" />
                {onCloseAll && (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseAll();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 flex items-center gap-2 text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>关闭全部</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onNewTab('api');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-accent" />
                  <span>新建 HTTP 请求</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNewTab('sse');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span>新建 SSE 请求</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNewTab('websocket');
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  <span>新建 WebSocket</span>
                </button>
                {onSaveAll && (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveAll();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-hover flex items-center gap-2 text-gray-200 transition"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>全部保存</span>
                  </button>
                )}
                {onCloseAll && tabs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onCloseAll();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 flex items-center gap-2 text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>关闭全部</span>
                  </button>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
