import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Globe, Save, Copy, Sparkles, Layers, Check } from 'lucide-react';
import { EnvironmentInfo, GlobalParams } from '../../../common/types';
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
  const [selectedTab, setSelectedTab] = useState<'globals' | string>(envs[0]?.env_id || 'globals');
  const [currentEditEnv, setCurrentEditEnv] = useState<EnvironmentInfo | null>(envs[0] || null);
  const [currentGlobals, setCurrentGlobals] = useState<GlobalParams>(globalParams);

  useEffect(() => {
    setCurrentGlobals(globalParams);
  }, [globalParams]);

  useEffect(() => {
    if (selectedTab !== 'globals') {
      const found = envs.find((e) => e.env_id === selectedTab);
      if (found) {
        setCurrentEditEnv({ ...found });
      }
    }
  }, [selectedTab, envs]);

  if (!isOpen) return null;

  const handleSelectEnv = (env: EnvironmentInfo) => {
    setSelectedTab(env.env_id);
    setCurrentEditEnv({ ...env });
  };

  const handleSelectGlobals = () => {
    setSelectedTab('globals');
  };

  const handleCreateNew = () => {
    const newId = `env-${Date.now().toString(36)}`;
    const newEnv: EnvironmentInfo = {
      env_id: newId,
      name: '新环境',
      pre_url: 'http://127.0.0.1:8000',
      list: [
        { param_id: '1', key: 'token', value: '', description: '用户Token', is_checked: 1 },
      ],
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
      name: `${currentEditEnv.name} (副本)`,
    };
    setSelectedTab(newId);
    setCurrentEditEnv(clonedEnv);
  };

  const handleSave = async () => {
    if (selectedTab === 'globals') {
      await onSaveGlobalParams(currentGlobals);
      toast.success('✨ 全局变量已成功保存！');
    } else if (currentEditEnv) {
      await onSaveEnv(currentEditEnv);
      toast.success('✨ 环境配置已成功保存！');
    }
  };

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

  const handleAddPresetVar = (key: string, defaultVal: string, desc: string) => {
    if (selectedTab === 'globals') {
      const vars = currentGlobals.vars || [];
      if (vars.some((v) => v.key === key)) return;
      setCurrentGlobals({
        ...currentGlobals,
        vars: [
          ...vars,
          { param_id: `v-${Date.now()}`, key, value: defaultVal, description: desc, is_checked: 1 },
        ],
      });
    } else if (currentEditEnv) {
      const list = currentEditEnv.list || [];
      if (list.some((v) => v.key === key)) return;
      setCurrentEditEnv({
        ...currentEditEnv,
        list: [
          ...list,
          { param_id: `v-${Date.now()}`, key, value: defaultVal, description: desc, is_checked: 1 },
        ],
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[820px] h-[600px] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs relative">

        {/* Header */}
        <div className="h-12 px-5 bg-surface border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Globe className="w-4 h-4 text-blue-400" />
            <span>环境与全局变量管理器</span>
            <span className="text-[10px] text-gray-400 font-normal ml-2">
              (在 URL、Headers、Body 中使用 &#123;&#123;变量名&#125;&#125; 快速调用)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-hover text-gray-400 hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Envs & Globals List */}
          <div className="w-56 border-r border-line bg-surface p-3 flex flex-col justify-between">
            <div className="space-y-1 overflow-y-auto">
              {/* Globals Tab */}
              <div className="text-[10px] text-gray-500 font-semibold px-2 py-1 uppercase tracking-wider">
                全局作用域
              </div>
              <button
                onClick={handleSelectGlobals}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center gap-2 ${
                  selectedTab === 'globals'
                    ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30 shadow-sm'
                    : 'text-gray-300 hover:bg-hover'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">全局变量 (Globals)</span>
              </button>

              <div className="h-[1px] bg-subtle my-2" />

              {/* Environments List */}
              <div className="text-[10px] text-gray-500 font-semibold px-2 py-1 uppercase tracking-wider">
                独立环境列表
              </div>
              {envs.map((e) => (
                <button
                  key={e.env_id}
                  onClick={() => handleSelectEnv(e)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs truncate transition flex items-center justify-between ${
                    selectedTab === e.env_id
                      ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30 shadow-sm'
                      : 'text-gray-300 hover:bg-hover'
                  }`}
                >
                  <span className="truncate">{e.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono shrink-0">
                    {e.list?.length || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-line">
              <button
                onClick={handleCreateNew}
                className="w-full py-1.5 rounded-xl bg-subtle hover:bg-hover border border-line text-gray-200 font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>新建环境</span>
              </button>

              {selectedTab !== 'globals' && currentEditEnv && (
                <button
                  onClick={handleCloneEnv}
                  className="w-full py-1.5 rounded-xl bg-surface hover:bg-hover border border-line text-gray-400 hover:text-gray-200 font-medium flex items-center justify-center gap-1.5 transition"
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
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>全局变量配置 (Global Variables)</span>
                  </h3>
                  <div className="mt-1 bg-surface border border-line p-3 rounded-xl text-gray-300 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      全局变量在所有环境下均生效。当环境变量与全局变量同名时，当前所选环境的变量拥有更高优先级。
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">快速添加预设：</span>
                  <button
                    onClick={() => handleAddPresetVar('token', '', '全局鉴权Token')}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300"
                  >
                    + token
                  </button>
                  <button
                    onClick={() => handleAddPresetVar('version', 'v1', '默认接口版本')}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300"
                  >
                    + version
                  </button>
                  <button
                    onClick={() => handleAddPresetVar('appId', '10001', '应用ID')}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300"
                  >
                    + appId
                  </button>
                </div>

                <div>
                  <KeyValueTable
                    items={currentGlobals.vars || []}
                    onChange={(vars) => setCurrentGlobals({ ...currentGlobals, vars })}
                    keyPlaceholder="全局变量名 (如 baseUrl, token)"
                    valuePlaceholder="变量默认值 (Value)"
                    showType={false}
                    showRequired={false}
                  />
                </div>
              </div>
            ) : currentEditEnv ? (
              /* Environment Specific Editor */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 font-medium mb-1">环境名称</label>
                    <input
                      type="text"
                      value={currentEditEnv.name}
                      onChange={(e) => setCurrentEditEnv({ ...currentEditEnv, name: e.target.value })}
                      className="w-full bg-subtle border border-line rounded-xl px-3 py-1.5 text-gray-200 focus:outline-none focus:border-blue-500 font-medium"
                      placeholder="例如：开发环境 / 测试环境 / 生产环境"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 font-medium mb-1">前置 Base URL</label>
                    <input
                      type="text"
                      value={currentEditEnv.pre_url}
                      onChange={(e) => setCurrentEditEnv({ ...currentEditEnv, pre_url: e.target.value })}
                      className="w-full bg-subtle border border-line rounded-xl px-3 py-1.5 text-gray-200 font-mono focus:outline-none focus:border-blue-500"
                      placeholder="http://127.0.0.1:8000"
                    />
                  </div>
                </div>

                {/* Pre-URL Quick Presets */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-500">前置 URL 快捷填入：</span>
                  <button
                    onClick={() => setCurrentEditEnv({ ...currentEditEnv, pre_url: 'http://127.0.0.1:8000' })}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300 font-mono"
                  >
                    :8000
                  </button>
                  <button
                    onClick={() => setCurrentEditEnv({ ...currentEditEnv, pre_url: 'http://127.0.0.1:8080' })}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-blue-400 font-mono"
                  >
                    :8080
                  </button>
                  <button
                    onClick={() => setCurrentEditEnv({ ...currentEditEnv, pre_url: 'https://httpbin.org' })}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-amber-400 font-mono"
                  >
                    httpbin.org
                  </button>
                </div>

                <div>
                  <div className="text-gray-300 font-semibold mb-2 flex items-center justify-between">
                    <span>环境变量列表 (当前环境专用)</span>
                    <div className="flex items-center gap-2 text-[11px] font-normal">
                      <button
                        onClick={() => handleAddPresetVar('token', '', '环境专属Token')}
                        className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300"
                      >
                        + token
                      </button>
                      <button
                        onClick={() => handleAddPresetVar('baseUrl', currentEditEnv.pre_url, '服务器地址')}
                        className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300"
                      >
                        + baseUrl
                      </button>
                    </div>
                  </div>
                  <KeyValueTable
                    items={currentEditEnv.list || []}
                    onChange={(list) => setCurrentEditEnv({ ...currentEditEnv, list })}
                    keyPlaceholder="变量名 (Variable)"
                    valuePlaceholder="变量默认值 (Value)"
                    showType={false}
                    showRequired={false}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                请在左侧选择或新建环境
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-line pt-4 mt-4">
              {selectedTab !== 'globals' && currentEditEnv ? (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除此环境</span>
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold transition shadow-sm"
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
