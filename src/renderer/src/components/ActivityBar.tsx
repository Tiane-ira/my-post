import React from 'react';
import { FileCode, Share2, Settings } from 'lucide-react';

interface ActivityBarProps {
  activeTab: 'apis' | 'shares';
  onSelectTab: (tab: 'apis' | 'shares') => void;
  onOpenSettings: () => void;
  isSidebarCollapsed?: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  isSidebarCollapsed = false,
}) => {
  return (
    <div className="w-12 bg-rail border-r border-line flex flex-col justify-between items-center py-3 shrink-0 select-none z-10">
      {/* Top Primary Tabs */}
      <div className="flex flex-col items-center gap-3">
        {/* APIs Management Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('apis')}
          className={`p-2 rounded-lg transition relative flex flex-col items-center gap-0.5 group ${
            activeTab === 'apis' && !isSidebarCollapsed
              ? 'bg-accent/20 text-accent font-semibold'
              : activeTab === 'apis' && isSidebarCollapsed
              ? 'text-gray-300 hover:text-accent hover:bg-hover'
              : 'text-gray-400 hover:text-foreground hover:bg-hover'
          }`}
          title={
            activeTab === 'apis'
              ? isSidebarCollapsed
                ? '接口管理 (已收起，点击展开)'
                : '接口管理 (点击收起列表栏)'
              : '接口管理 (APIs)'
          }
        >
          <FileCode className="w-5 h-5 transition group-hover:scale-105" />
          <span className="text-[9px] font-medium scale-90">APIs</span>
          {activeTab === 'apis' && !isSidebarCollapsed && (
            <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-r"></span>
          )}
        </button>

        {/* Share Management Tab */}
        <button
          type="button"
          onClick={() => onSelectTab('shares')}
          className={`p-2 rounded-lg transition relative flex flex-col items-center gap-0.5 group ${
            activeTab === 'shares'
              ? 'bg-accent/20 text-accent font-semibold'
              : 'text-gray-400 hover:text-foreground hover:bg-hover'
          }`}
          title="分享链接管理"
        >
          <Share2 className="w-5 h-5 transition group-hover:scale-105" />
          <span className="text-[9px] font-medium scale-90">分享</span>
          {activeTab === 'shares' && (
            <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-r"></span>
          )}
        </button>
      </div>

      {/* Bottom Actions: Settings */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-gray-400 hover:text-accent hover:bg-hover transition flex flex-col items-center gap-0.5 group"
          title="应用与项目设置"
        >
          <Settings className="w-4 h-4 transition group-hover:rotate-45 duration-300" />
          <span className="text-[9px] scale-90">设置</span>
        </button>
      </div>
    </div>
  );
};
