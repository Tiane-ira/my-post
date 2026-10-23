import React from 'react';
import {
  X,
  Layers,
  ChevronDown,
  Globe,
  Plus,
  FolderOpen,
  Eye,
  Check,
  Copy,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Edit3
} from 'lucide-react';
import { EnvironmentInfo, ProjectInfo, GlobalParams } from '../../../common/types';
import { useTheme } from '../utils/themeManager';

interface TitleBarProps {
  projects: ProjectInfo[];
  currentProject: ProjectInfo | null;
  onSelectProject: (p: ProjectInfo) => void;
  onOpenCreateProject: () => void;
  envs: EnvironmentInfo[];
  currentEnv: EnvironmentInfo | null;
  globalParams?: GlobalParams;
  onSelectEnv: (e: EnvironmentInfo | null) => void;
  onOpenEnvModal: (targetEnvId?: string) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onOpenCreateProject,
  envs,
  currentEnv,
  globalParams,
  onSelectEnv,
  onOpenEnvModal,
}) => {
  const [projectDropdown, setProjectDropdown] = React.useState(false);
  const [envDropdown, setEnvDropdown] = React.useState(false);
  const [quickLookOpen, setQuickLookOpen] = React.useState(false);
  const [copiedVarKey, setCopiedVarKey] = React.useState<string | null>(null);
  const { themeMode, setThemeMode, themePresetId, setThemePreset, presets, activePreset } = useTheme();
  const [themeDropdown, setThemeDropdown] = React.useState(false);

  const projectDropdownRef = React.useRef<HTMLDivElement>(null);
  const envDropdownRef = React.useRef<HTMLDivElement>(null);
  const quickLookRef = React.useRef<HTMLDivElement>(null);
  const themeDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!quickLookOpen && !envDropdown && !projectDropdown && !themeDropdown) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (quickLookOpen && quickLookRef.current && !quickLookRef.current.contains(target)) {
        setQuickLookOpen(false);
      }
      if (envDropdown && envDropdownRef.current && !envDropdownRef.current.contains(target)) {
        setEnvDropdown(false);
      }
      if (projectDropdown && projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setProjectDropdown(false);
      }
      if (themeDropdown && themeDropdownRef.current && !themeDropdownRef.current.contains(target)) {
        setThemeDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickLookOpen(false);
        setEnvDropdown(false);
        setProjectDropdown(false);
        setThemeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [quickLookOpen, envDropdown, projectDropdown, themeDropdown]);

  const handleCopyVar = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedVarKey(key);
    setTimeout(() => setCopiedVarKey(null), 1500);
  };

  return (
    <div className="h-10 bg-surface border-b border-line flex items-center justify-between px-3 select-none text-xs z-50">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center" title="mypost">
          <img
            src="./icon.svg"
            alt="mypost"
            className="w-5 h-5 object-contain"
          />
        </div>

        <div className="h-4 w-px bg-line"></div>

        {/* Project Dropdown */}
        <div className="relative" ref={projectDropdownRef}>
          <button
            onClick={() => {
              setProjectDropdown(!projectDropdown);
              setEnvDropdown(false);
              setQuickLookOpen(false);
              setThemeDropdown(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-foreground transition"
          >
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span className="max-w-[120px] truncate font-medium">
              {currentProject ? currentProject.name : '选择项目'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {projectDropdown && (
            <div className="absolute left-0 mt-1 w-56 bg-subtle border border-line rounded-lg shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold border-b border-line">
                选择当前项目
              </div>
              <div className="max-h-48 overflow-y-auto">
                {(projects || []).map((p) => (
                  <button
                    key={p.project_id}
                    onClick={() => {
                      onSelectProject(p);
                      setProjectDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between ${currentProject?.project_id === p.project_id
                        ? 'text-accent font-bold bg-accent/10'
                        : 'text-gray-200'
                      }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {currentProject?.project_id === p.project_id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-line pt-1 mt-1">
                <button
                  onClick={() => {
                    setProjectDropdown(false);
                    onOpenCreateProject();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-accent hover:bg-accent/15 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建/管理项目
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center - Env Selector */}
      <div className="flex items-center gap-3">
        {/* Environment Selector & Quick Look */}
        <div className="flex items-center gap-1">
          {/* Environment Selector Dropdown */}
          <div className="relative" ref={envDropdownRef}>
            <button
              onClick={() => {
                setEnvDropdown(!envDropdown);
                setQuickLookOpen(false);
                setProjectDropdown(false);
                setThemeDropdown(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-foreground transition"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[110px] truncate">
                {currentEnv ? currentEnv.name : '无环境'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {envDropdown && (
              <div className="absolute left-0 top-9 w-52 bg-subtle border border-line rounded-lg shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold border-b border-line">
                  选择当前运行环境
                </div>
                <button
                  onClick={() => {
                    onSelectEnv(null);
                    setEnvDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between ${!currentEnv ? 'text-blue-400 font-bold bg-blue-500/10' : 'text-gray-300'
                    }`}
                >
                  <span>无环境</span>
                  {!currentEnv && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
                </button>
                {(envs || []).map((env) => (
                  <div
                    key={env.env_id}
                    onClick={() => {
                      onSelectEnv(env);
                      setEnvDropdown(false);
                    }}
                    className={`w-full px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between group cursor-pointer transition ${currentEnv?.env_id === env.env_id
                        ? 'text-blue-400 font-bold bg-blue-500/10'
                        : 'text-gray-300'
                      }`}
                  >
                    <span className="truncate flex-1 pr-2">{env.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        title="编辑此环境"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnvDropdown(false);
                          onOpenEnvModal(env.env_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-hover text-gray-400 hover:text-blue-400 transition"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      {currentEnv?.env_id === env.env_id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="border-t border-line pt-1 mt-1">
                  <button
                    onClick={() => {
                      setEnvDropdown(false);
                      onOpenEnvModal(currentEnv?.env_id);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10 flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    环境与变量配置
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Eye Icon for Quick Look */}
          <div className="relative" ref={quickLookRef}>
            <button
              onClick={() => {
                setQuickLookOpen(!quickLookOpen);
                setEnvDropdown(false);
                setProjectDropdown(false);
                setThemeDropdown(false);
              }}
              className={`p-1 rounded bg-subtle hover:bg-hover border border-line transition ${quickLookOpen ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-gray-400 hover:text-foreground'
                }`}
              title="快速查看当前环境变量与全局变量"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {/* Quick Look Popover */}
            {quickLookOpen && (
              <div className="absolute right-0 top-9 w-72 bg-surface border border-line rounded-xl shadow-2xl p-3 z-50 text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                  <div className="font-bold text-gray-200 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>当前变量清单 (Quick Look)</span>
                  </div>
                  <button
                    onClick={() => setQuickLookOpen(false)}
                    className="text-gray-400 hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {/* Active Env Info */}
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold mb-1">
                      当前环境：<span className="text-blue-400">{currentEnv?.name || '未选择环境'}</span>
                    </div>
                    {currentEnv?.pre_url && (
                      <div className="text-[11px] font-mono bg-surface px-2 py-1 rounded text-emerald-400 truncate border border-line">
                        baseUrl: {currentEnv.pre_url}
                      </div>
                    )}
                  </div>

                  {/* Env Vars */}
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold mb-1 flex items-center justify-between">
                      <span>环境变量 ({currentEnv?.list?.length || 0})</span>
                      <span className="text-[9px] text-gray-500">点击复制 &#123;&#123;key&#125;&#125;</span>
                    </div>
                    {Array.isArray(currentEnv?.list) && currentEnv.list.filter(Boolean).length > 0 ? (
                      <div className="space-y-1">
                        {currentEnv.list.filter(Boolean).map((v, idx) => (
                          <div
                            key={v.param_id || v.key || `env-var-${idx}`}
                            onClick={() => v.key && handleCopyVar(String(v.key))}
                            className="flex items-center justify-between px-2 py-1 rounded bg-surface hover:bg-hover cursor-pointer transition border border-line"
                          >
                            <span className="font-mono text-amber-300 truncate max-w-[100px]">{typeof v.key === 'string' ? v.key : String(v.key || '-')}</span>
                            <span className="font-mono text-gray-400 truncate max-w-[120px] text-[11px]">
                              {typeof v.value === 'string' ? v.value : String(v.value || '(空)')}
                            </span>
                            {copiedVarKey === v.key ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-600 shrink-0 opacity-0 hover:opacity-100" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-500 py-0.5">无环境变量</div>
                    )}
                  </div>

                  {/* Global Vars */}
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold mb-1 flex items-center justify-between">
                      <span>全局变量 ({Array.isArray(globalParams?.vars) ? globalParams.vars.filter(Boolean).length : 0})</span>
                    </div>
                    {Array.isArray(globalParams?.vars) && globalParams.vars.filter(Boolean).length > 0 ? (
                      <div className="space-y-1">
                        {globalParams.vars.filter(Boolean).map((v, idx) => (
                          <div
                            key={v.param_id || v.key || `global-var-${idx}`}
                            onClick={() => v.key && handleCopyVar(String(v.key))}
                            className="flex items-center justify-between px-2 py-1 rounded bg-surface hover:bg-hover cursor-pointer transition border border-line"
                          >
                            <span className="font-mono text-blue-300 truncate max-w-[100px]">{typeof v.key === 'string' ? v.key : String(v.key || '-')}</span>
                            <span className="font-mono text-gray-400 truncate max-w-[120px] text-[11px]">
                              {typeof v.value === 'string' ? v.value : String(v.value || '(空)')}
                            </span>
                            {copiedVarKey === v.key ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-600 shrink-0 opacity-0 hover:opacity-100" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-500 py-0.5">无全局变量</div>
                    )}
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-line">
                  <button
                    onClick={() => {
                      setQuickLookOpen(false);
                      onOpenEnvModal(currentEnv?.env_id);
                    }}
                    className="w-full py-1 text-center text-blue-400 hover:text-blue-300 font-medium text-[11px]"
                  >
                    打开环境与变量配置...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right - Theme Switcher */}
      <div className="flex items-center gap-1.5">
        {/* Day / Night Theme Selector */}
        <div className="relative" ref={themeDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setThemeDropdown(!themeDropdown);
              setProjectDropdown(false);
              setEnvDropdown(false);
              setQuickLookOpen(false);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground transition text-[11px]"
            title={`当前外观: ${themeMode === 'system' ? '跟随系统' : themeMode === 'light' ? '日间模式' : '夜间模式'}`}
          >
            {themeMode === 'system' ? (
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
            ) : themeMode === 'light' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span className="hidden sm:inline">
              {themeMode === 'system' ? '跟随系统' : themeMode === 'light' ? '日间' : '夜间'}
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
          </button>

          {themeDropdown && (
            <div className="absolute right-0 top-8 w-48 bg-subtle border border-line rounded-lg shadow-2xl py-1 z-50 animate-in fade-in duration-100">
              <div className="px-3 py-1 text-[10px] text-gray-400 font-semibold border-b border-line">
                色彩模式
              </div>
              <button
                type="button"
                onClick={() => {
                  setThemeMode('system');
                  setThemeDropdown(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between transition ${
                  themeMode === 'system' ? 'text-accent font-bold bg-accent/10' : 'text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                  <span>跟随系统</span>
                </div>
                {themeMode === 'system' && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setThemeMode('light');
                  setThemeDropdown(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between transition ${
                  themeMode === 'light' ? 'text-accent font-bold bg-accent/10' : 'text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>日间模式</span>
                </div>
                {themeMode === 'light' && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setThemeMode('dark');
                  setThemeDropdown(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between transition ${
                  themeMode === 'dark' ? 'text-accent font-bold bg-accent/10' : 'text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                  <span>夜间模式</span>
                </div>
                {themeMode === 'dark' && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>

              <div className="px-3 py-1 mt-1 text-[10px] text-gray-400 font-semibold border-t border-b border-line">
                精选色彩主题
              </div>
              <div className="max-h-48 overflow-y-auto py-0.5">
                {presets.map((preset) => {
                  const isCur = themePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setThemePreset(preset.id);
                        setThemeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-hover flex items-center justify-between transition ${
                        isCur ? 'text-accent font-bold bg-accent/10' : 'text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </div>
                      {isCur && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
