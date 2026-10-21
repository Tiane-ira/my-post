import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Globe, Save, Copy, Layers, FileText } from 'lucide-react';
import { EnvironmentInfo, GlobalParams, KeyValueItem } from '../../../common/types';
import { KeyValueTable } from './KeyValueTable';
import { useFeedback } from './FeedbackContext';

interface EnvModalProps {
  isOpen: boolean;
  onClose: () => void;
  envs: EnvironmentInfo[];
  globalParams: GlobalParams;
  onSaveEnv: (env: EnvironmentInfo) => Promise<void>;
  onDeleteEnv: (envId: string) => Promise<void>;
  onSaveGlobalParams: (params: GlobalParams) => Promise<void>;
}

const CLEAN_LEGACY_DESCS = new Set([
  '用户Token',
  '全局鉴权Token',
  '环境专属Token',
  '默认接口版本',
  '应用ID',
  '服务器地址',
]);

const cleanLegacyItems = (items?: any[]): KeyValueItem[] => {
  if (!items || !Array.isArray(items)) return [];
  return items
    .filter((item): item is KeyValueItem => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      ...item,
      param_id: item.param_id || `param-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      key: typeof item.key === 'string' ? item.key : String(item.key || ''),
      value: typeof item.value === 'string' ? item.value : String(item.value || ''),
      description: CLEAN_LEGACY_DESCS.has(String(item.description || '')) ? '' : String(item.description || ''),
      is_checked: item.is_checked !== undefined ? item.is_checked : 1,
      data_type: item.data_type || 'string',
      type: item.type || 'text',
      is_required: item.is_required || 0,
    }));
};

export const EnvModal: React.FC<EnvModalProps> = ({
  isOpen,
  onClose,
  envs,
  globalParams,
  onSaveEnv,
  onDeleteEnv,
  onSaveGlobalParams,
}) => {
  const { confirm, toast } = useFeedback();

  const safeEnvs = React.useMemo(() => {
    return (Array.isArray(envs) ? envs : []).filter(
      (e): e is EnvironmentInfo => Boolean(e && typeof e === 'object' && e.env_id)
    );
  }, [envs]);

  const safeGlobalParams = React.useMemo<GlobalParams>(() => {
    if (!globalParams || typeof globalParams !== 'object') {
      return { header: [], query: [], body: [], vars: [] };
    }
    return {
      header: Array.isArray(globalParams.header) ? globalParams.header : [],
      query: Array.isArray(globalParams.query) ? globalParams.query : [],
      body: Array.isArray(globalParams.body) ? globalParams.body : [],
      vars: Array.isArray(globalParams.vars) ? globalParams.vars : [],
    };
  }, [globalParams]);

  const [selectedTab, setSelectedTab] = useState<'globals' | string>(() => {
    return safeEnvs[0]?.env_id || 'globals';
  });
  const [currentEditEnv, setCurrentEditEnv] = useState<EnvironmentInfo | null>(() => {
    return safeEnvs[0]
      ? {
          ...safeEnvs[0],
          name: safeEnvs[0].name || '',
          pre_url: safeEnvs[0].pre_url || '',
          list: cleanLegacyItems(safeEnvs[0].list),
        }
      : null;
  });
  const [currentGlobals, setCurrentGlobals] = useState<GlobalParams>(() => ({
    ...safeGlobalParams,
    vars: cleanLegacyItems(safeGlobalParams.vars),
  }));
  const [showDescription, setShowDescription] = useState(false);

  useEffect(() => {
    setCurrentGlobals({
      ...safeGlobalParams,
      vars: cleanLegacyItems(safeGlobalParams.vars),
    });
  }, [safeGlobalParams]);

  useEffect(() => {
    if (selectedTab !== 'globals') {
      const found = safeEnvs.find((e) => e.env_id === selectedTab);
      if (found) {
        setCurrentEditEnv({
          ...found,
          name: found.name || '',
          pre_url: found.pre_url || '',
          list: cleanLegacyItems(found.list),
        });
      } else if (safeEnvs.length > 0) {
        setSelectedTab(safeEnvs[0].env_id);
        setCurrentEditEnv({
          ...safeEnvs[0],
          name: safeEnvs[0].name || '',
          pre_url: safeEnvs[0].pre_url || '',
          list: cleanLegacyItems(safeEnvs[0].list),
        });
      } else {
        setSelectedTab('globals');
        setCurrentEditEnv(null);
      }
    }
  }, [selectedTab, safeEnvs]);

  // Sync state whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      if (selectedTab !== 'globals') {
        const found = safeEnvs.find((e) => e.env_id === selectedTab);
        if (found) {
          setCurrentEditEnv({
            ...found,
            name: found.name || '',
            pre_url: found.pre_url || '',
            list: cleanLegacyItems(found.list),
          });
        } else if (safeEnvs.length > 0) {
          setSelectedTab(safeEnvs[0].env_id);
          setCurrentEditEnv({
            ...safeEnvs[0],
            name: safeEnvs[0].name || '',
            pre_url: safeEnvs[0].pre_url || '',
            list: cleanLegacyItems(safeEnvs[0].list),
          });
        } else {
          setSelectedTab('globals');
          setCurrentEditEnv(null);
        }
      }
      setCurrentGlobals({
        ...safeGlobalParams,
        vars: cleanLegacyItems(safeGlobalParams.vars),
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectEnv = (env: EnvironmentInfo) => {
    if (!env) return;
    setSelectedTab(env.env_id);
    setCurrentEditEnv({
      ...env,
      name: env.name || '',
      pre_url: env.pre_url || '',
      list: cleanLegacyItems(env.list),
    });
  };

  const handleSelectGlobals = () => {
    setSelectedTab('globals');
  };

  const handleCreateNew = () => {
    const newId = `env-${Date.now().toString(36)}`;
    const newEnv: EnvironmentInfo = {
      env_id: newId,
      name: '新环境',
      pre_url: '',
      list: [],
    };
    setSelectedTab(newId);
    setCurrentEditEnv(newEnv);
  };

  const handleCloneEnv = () => {
    if (!currentEditEnv) return;
    const newId = `env-${Date.now().toString(36)}`;
    const clonedEnv: EnvironmentInfo = {
      ...currentEditEnv,
      env_id: newId,
      name: `${currentEditEnv.name || '环境'} (副本)`,
      pre_url: currentEditEnv.pre_url || '',
      list: Array.isArray(currentEditEnv.list) ? [...currentEditEnv.list] : [],
    };
    setSelectedTab(newId);
    setCurrentEditEnv(clonedEnv);
  };

  const handleSave = async () => {
    if (selectedTab === 'globals') {
      await onSaveGlobalParams(currentGlobals);
      toast.success('全局变量已保存');
    } else if (currentEditEnv) {
      await onSaveEnv(currentEditEnv);
      toast.success('环境配置已保存');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedTab, currentGlobals, currentEditEnv]);

  const handleDelete = async () => {
    if (!currentEditEnv) return;
    const ok = await confirm({
      title: '删除环境确认',
      message: `确认删除环境 "${currentEditEnv.name}" 吗？此操作无法撤销。`,
      type: 'danger',
      confirmText: '确认删除',
      cancelText: '取消',
    });
    if (ok) {
      await onDeleteEnv(currentEditEnv.env_id);
      setSelectedTab('globals');
      setCurrentEditEnv(null);
      toast.success(`已删除环境 "${currentEditEnv.name}"`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[820px] h-[580px] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs relative">
        {/* Header */}
        <div className="h-12 px-5 bg-surface border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Globe className="w-4 h-4 text-accent" />
            <span>环境与全局变量</span>
            <span className="text-[11px] text-gray-500 font-normal ml-1">
              (在接口中通过 &#123;&#123;变量名&#125;&#125; 引用)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-hover text-gray-400 hover:text-foreground transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Envs & Globals List */}
          <div className="w-56 border-r border-line bg-surface p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1 overflow-y-auto">
              <div className="text-[10px] text-gray-500 font-semibold px-2 py-1 uppercase tracking-wider">
                全局作用域
              </div>
              <button
                type="button"
                onClick={handleSelectGlobals}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center gap-2 ${
                  selectedTab === 'globals'
                    ? 'bg-accent/15 text-accent font-bold border border-accent/30 shadow-xs'
                    : 'text-gray-300 hover:bg-hover'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate">全局变量 (Globals)</span>
              </button>

              <div className="h-[1px] bg-line my-2" />

              <div className="text-[10px] text-gray-500 font-semibold px-2 py-1 uppercase tracking-wider">
                独立环境列表
              </div>
              {safeEnvs.map((e) => (
                <button
                  key={e.env_id}
                  type="button"
                  onClick={() => handleSelectEnv(e)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs truncate transition flex items-center justify-between ${
                    selectedTab === e.env_id
                      ? 'bg-accent/15 text-accent font-bold border border-accent/30 shadow-xs'
                      : 'text-gray-300 hover:bg-hover'
                  }`}
                >
                  <span className="truncate">{typeof e.name === 'string' ? e.name : '未命名环境'}</span>
                  <span className="text-[10px] text-gray-500 font-mono shrink-0">
                    {Array.isArray(e.list) ? e.list.length : 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-line">
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full py-1.5 rounded-xl bg-subtle hover:bg-hover border border-line text-gray-200 font-medium flex items-center justify-center gap-1.5 transition text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>新建环境</span>
              </button>

              {selectedTab !== 'globals' && currentEditEnv && (
                <button
                  type="button"
                  onClick={handleCloneEnv}
                  className="w-full py-1.5 rounded-xl bg-surface hover:bg-hover border border-line text-gray-400 hover:text-gray-200 font-medium flex items-center justify-center gap-1.5 transition text-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>克隆当前环境</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Editor */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between bg-subtle">
            {selectedTab === 'globals' ? (
              /* Global Variables Editor */
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-accent" />
                      <span>全局变量 (Global Variables)</span>
                    </h3>
                    <p className="text-gray-400 text-[11px] mt-0.5">
                      全局变量在所有环境下均生效；当与环境变量同名时，所选环境的变量优先生效。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDescription((prev) => !prev)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-surface hover:bg-hover border border-line text-gray-400 hover:text-gray-200 text-[11px] transition cursor-pointer shrink-0"
                    title={showDescription ? '隐藏描述列' : '显示描述列'}
                  >
                    <FileText className="w-3 h-3 text-gray-400" />
                    <span>{showDescription ? '隐藏说明' : '显示说明'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <KeyValueTable
                    items={Array.isArray(currentGlobals.vars) ? currentGlobals.vars : []}
                    onChange={(vars) => setCurrentGlobals({ ...currentGlobals, vars })}
                    keyPlaceholder="变量名"
                    valuePlaceholder="变量值"
                    showType={false}
                    showRequired={false}
                    showDescription={showDescription}
                  />
                </div>
              </div>
            ) : currentEditEnv ? (
              /* Environment Specific Editor */
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 font-medium mb-1 text-xs">环境名称</label>
                    <input
                      type="text"
                      value={typeof currentEditEnv.name === 'string' ? currentEditEnv.name : String(currentEditEnv.name || '')}
                      onChange={(e) => setCurrentEditEnv({ ...currentEditEnv, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                      }}
                      className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:border-accent font-medium text-xs"
                      placeholder="环境名称"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-medium mb-1 text-xs">前置 Base URL</label>
                    <input
                      type="text"
                      value={typeof currentEditEnv.pre_url === 'string' ? currentEditEnv.pre_url : String(currentEditEnv.pre_url || '')}
                      onChange={(e) => setCurrentEditEnv({ ...currentEditEnv, pre_url: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                      }}
                      className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-gray-200 font-mono focus:outline-none focus:border-accent text-xs"
                      placeholder="https://api.example.com"
                    />
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="text-gray-300 font-semibold mb-1.5 flex items-center justify-between text-xs">
                    <span>环境变量列表</span>
                    <button
                      type="button"
                      onClick={() => setShowDescription((prev) => !prev)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface hover:bg-hover border border-line text-gray-400 hover:text-gray-200 text-[11px] transition cursor-pointer"
                      title={showDescription ? '隐藏描述列' : '显示描述列'}
                    >
                      <FileText className="w-3 h-3 text-gray-400" />
                      <span>{showDescription ? '隐藏说明' : '显示说明'}</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <KeyValueTable
                      items={Array.isArray(currentEditEnv.list) ? currentEditEnv.list : []}
                      onChange={(list) => setCurrentEditEnv({ ...currentEditEnv, list })}
                      keyPlaceholder="变量名"
                      valuePlaceholder="变量值"
                      showType={false}
                      showRequired={false}
                      showDescription={showDescription}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                请在左侧选择或新建环境
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-line pt-3 mt-3 shrink-0">
              {selectedTab !== 'globals' && currentEditEnv ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除此环境</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold transition shadow-sm cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{selectedTab === 'globals' ? '保存全局变量' : '保存环境配置'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
