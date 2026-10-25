import React from 'react';
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  CheckCheck,
  XSquare,
  Upload,
  FileCode,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { KeyValueItem, ParamDataType } from '../../../common/types';
import { InheritedParamItem } from '../../../common/paramUtils';
import { getHeaderKeySuggestions, getHeaderValueSuggestions } from '../../../common/headerConstants';
import { VariableInput, VariableItem } from './VariableInput';

interface KeyValueTableProps {
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  inheritedItems?: InheritedParamItem[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  availableVars?: Record<string, VariableItem>;
  allowFile?: boolean;
  showType?: boolean;
  showContentType?: boolean;
  showRequired?: boolean;
  isFormData?: boolean;
  showDescription?: boolean;
}

export const KeyValueTable: React.FC<KeyValueTableProps> = ({
  items,
  onChange,
  inheritedItems,
  keyPlaceholder = '参数名',
  valuePlaceholder = '参数值',
  availableVars = {},
  allowFile = false,
  showType,
  showContentType = false,
  showRequired = true,
  isFormData = false,
  showDescription = true,
}) => {
  // Requirement 3: All Header-related parameters do not need type selection
  const isHeaderTable =
    keyPlaceholder.toLowerCase().includes('header') ||
    keyPlaceholder.includes('请求头');
  const actualShowType = showType !== undefined ? showType : !isHeaderTable;

  const isFormMode = Boolean(isFormData || allowFile);
  const [showInherited, setShowInherited] = React.useState<boolean>(false);

  const formDataOptions = [
    { value: 'text', label: 'Text' },
    { value: 'file', label: 'File' },
  ];

  const standardTypeOptions: { value: ParamDataType; label: string }[] = [
    { value: 'string', label: 'string' },
    { value: 'integer', label: 'integer' },
    { value: 'number', label: 'number' },
    { value: 'boolean', label: 'boolean' },
    { value: 'array', label: 'array' },
    { value: 'object', label: 'object' },
  ];

  const safeItems = React.useMemo(() => {
    return (Array.isArray(items) ? items : [])
      .filter((i): i is KeyValueItem => Boolean(i && typeof i === 'object'))
      .map((item, idx) => ({
        ...item,
        param_id: item.param_id || `param-${idx}`,
        key: typeof item.key === 'string' ? item.key : String(item.key || ''),
        value: typeof item.value === 'string' ? item.value : String(item.value || ''),
        description: typeof item.description === 'string' ? item.description : String(item.description || ''),
        is_checked: item.is_checked !== undefined ? item.is_checked : 1,
        data_type: item.data_type || (item.type === 'file' ? 'file' : 'string'),
        type: item.type || (item.data_type === 'file' ? 'file' : 'text'),
        is_required: item.is_required || 0,
      }));
  }, [items]);

  const safeInherited = React.useMemo(() => {
    return (Array.isArray(inheritedItems) ? inheritedItems : []).filter(
      (inh): inh is InheritedParamItem => Boolean(inh && typeof inh === 'object' && inh.key)
    );
  }, [inheritedItems]);

  const resolveInheritedValue = (val: string): { resolved: string; hasPlaceholder: boolean } => {
    if (!val || typeof val !== 'string') return { resolved: val || '', hasPlaceholder: false };
    let hasPlaceholder = false;
    const resolved = val.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey) => {
      hasPlaceholder = true;
      const k = rawKey.trim();
      if (availableVars[k]?.value !== undefined) {
        return availableVars[k].value;
      }
      return match;
    });
    return { resolved, hasPlaceholder };
  };

  const overriddenInheritedCount = React.useMemo(
    () => safeInherited.filter((i) => i.overridden).length,
    [safeInherited]
  );

  const headerKeySuggestions = React.useMemo(() => {
    return isHeaderTable ? getHeaderKeySuggestions() : [];
  }, [isHeaderTable]);

  const handleToggle = (index: number) => {
    const next = [...safeItems];
    if (!next[index]) return;
    next[index] = {
      ...next[index],
      is_checked: next[index].is_checked === 1 ? -1 : 1,
    };
    onChange(next);
  };

  const handleFieldChange = (index: number, field: keyof KeyValueItem, val: any) => {
    const next = [...safeItems];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: val };
    onChange(next);
  };

  const handleTypeChange = (index: number, newType: string) => {
    const next = [...safeItems];
    if (!next[index]) return;
    const isFile = newType === 'file';
    next[index] = {
      ...next[index],
      data_type: (isFile ? 'file' : newType === 'text' ? 'string' : newType) as ParamDataType,
      type: isFile ? 'file' : 'text',
      // If switching away from file, reset file attributes
      ...(isFile ? {} : { file_path: '', file_name: '', value: next[index].file_path ? '' : next[index].value }),
    };
    onChange(next);
  };

  const handleClearFile = (index: number) => {
    const next = [...safeItems];
    if (!next[index]) return;
    next[index] = {
      ...next[index],
      file_path: '',
      file_name: '',
      value: '',
    };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    const next = safeItems.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleAdd = () => {
    const next: KeyValueItem[] = [
      ...safeItems,
      {
        param_id: Math.random().toString(36).substring(2, 9),
        key: '',
        value: '',
        description: '',
        is_checked: 1,
        data_type: 'string',
        type: 'text',
        is_required: 0,
      },
    ];
    onChange(next);
  };

  const handleSelectFile = async (index: number) => {
    try {
      if (window.mypostAPI?.openFileDialog) {
        const res = await window.mypostAPI.openFileDialog();
        if (res && res.filePath) {
          const next = [...safeItems];
          if (!next[index]) return;
          next[index] = {
            ...next[index],
            type: 'file',
            data_type: 'file',
            file_path: res.filePath,
            file_name: res.fileName,
            value: res.filePath,
          };
          onChange(next);
          return;
        }
      }
    } catch (e) {
      console.warn('Native openFileDialog failed, falling back to input:', e);
    }

    // Web fallback
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const filePath = (file as any).path || file.name;
        const next = [...safeItems];
        if (!next[index]) return;
        next[index] = {
          ...next[index],
          type: 'file',
          data_type: 'file',
          file_path: filePath,
          file_name: file.name,
          value: filePath,
        };
        onChange(next);
      }
    };
    input.click();
  };

  const handleCheckAll = () => {
    onChange(safeItems.map((i) => ({ ...i, is_checked: 1 })));
  };

  const handleUncheckAll = () => {
    onChange(safeItems.map((i) => ({ ...i, is_checked: -1 })));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="w-full text-xs space-y-2">
      {/* Top Toolbar: Quick Actions */}
      <div className="flex items-center justify-between text-gray-400">
        <div className="text-[11px] font-medium text-gray-400">
          参数列表 ({safeItems.length})
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {safeItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleCheckAll}
                className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground transition flex items-center gap-1"
                title="全部启用"
              >
                <CheckCheck className="w-3 h-3 text-emerald-400" />
                <span>全选</span>
              </button>
              <button
                type="button"
                onClick={handleUncheckAll}
                className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground transition flex items-center gap-1"
                title="全部禁用"
              >
                <XSquare className="w-3 h-3 text-gray-400" />
                <span>全不选</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-0.5 rounded bg-subtle hover:bg-rose-500/20 border border-line hover:border-rose-500/30 text-gray-400 hover:text-rose-400 transition"
                title="清空所有参数"
              >
                清空
              </button>
            </>
          )}
        </div>
      </div>

      {/* Parameter Table */}
      <div className="border border-line rounded-lg overflow-hidden bg-surface">
        {/* Table Header */}
        <div
          className={`grid ${
            showContentType
              ? showDescription
                ? 'grid-cols-[36px_1.5fr_1.5fr_1fr_1fr_36px]'
                : 'grid-cols-[36px_1.8fr_2fr_1.2fr_36px]'
              : showDescription
              ? 'grid-cols-[36px_1.5fr_1.7fr_1.2fr_36px]'
              : 'grid-cols-[36px_1.5fr_2fr_36px]'
          } bg-subtle border-b border-line text-gray-400 font-semibold py-1.5 px-2`}
        >
          <div className="text-center">启用</div>
          <div className="flex items-center gap-1">
            <span>{keyPlaceholder}</span>
            {showRequired && (
              <span className="text-[10px] font-normal text-gray-500">(*必填)</span>
            )}
          </div>
          <div>{valuePlaceholder}</div>
          {showContentType && <div>内容类型</div>}
          {showDescription && <div>说明 / 描述</div>}
          <div className="text-center">操作</div>
        </div>

        {/* Simplified & Clean Inherited Parameters Section */}
        {safeInherited.length > 0 && (
          <div className="bg-subtle/25 border-b border-line">
            <button
              type="button"
              onClick={() => setShowInherited(!showInherited)}
              className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] hover:bg-hover/50 transition cursor-pointer select-none text-left group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight
                  className={`w-3.5 h-3.5 text-gray-400 group-hover:text-accent transition-transform duration-200 shrink-0 ${
                    showInherited ? 'rotate-90 text-accent' : ''
                  }`}
                />
                <span className="text-gray-300 font-medium group-hover:text-foreground transition-colors">
                  继承参数
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface border border-line text-gray-400 font-mono">
                  {safeInherited.length}
                </span>

                {overriddenInheritedCount > 0 ? (
                  <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.2 rounded font-sans">
                    {`${overriddenInheritedCount} 项已覆盖`}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500 hidden sm:inline">
                    · 来自上级目录、鉴权或系统配置
                  </span>
                )}
              </div>

              <span className="text-[10px] text-gray-400 group-hover:text-accent transition-colors shrink-0">
                {showInherited ? '收起' : '展开'}
              </span>
            </button>

            {showInherited && (
              <div className="px-3 py-1.5 bg-canvas/30 border-t border-line/40 space-y-1 max-h-60 overflow-y-auto">
                {safeInherited.map((inh, iIdx) => {
                  const { resolved: resolvedVal, hasPlaceholder: hasValVar } = resolveInheritedValue(inh.value || '');
                  const { resolved: resolvedKey, hasPlaceholder: hasKeyVar } = resolveInheritedValue(inh.key || '');

                  return (
                    <div
                      key={`inh-${inh.source}-${inh.key}-${iIdx}`}
                      className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded text-xs transition ${
                        inh.overridden
                          ? 'opacity-45 bg-surface/30'
                          : 'bg-surface/60 hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0 ${
                            inh.source === 'folder'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : inh.source === 'auth'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          }`}
                          title={inh.sourceName}
                        >
                          {inh.source === 'folder' ? '目录' : inh.source === 'auth' ? '鉴权' : '系统'}
                        </span>

                        <span
                          className={`font-mono font-medium truncate ${
                            inh.overridden ? 'line-through text-gray-400' : 'text-gray-200'
                          }`}
                          title={hasKeyVar ? `原始参数名: ${inh.key}\n解析参数名: ${resolvedKey}` : inh.key}
                        >
                          {resolvedKey}
                        </span>

                        <span className="text-gray-500 text-[11px] shrink-0">:</span>

                        <div className="min-w-0 flex items-center gap-1.5">
                          {hasValVar ? (
                            <span
                              className="font-mono text-emerald-400 font-medium text-[11px] truncate max-w-[280px]"
                              title={`原始占位变量: ${inh.value}\n变量已解析: ${resolvedVal}`}
                            >
                              {resolvedVal}
                              <span className="ml-1 text-[10px] text-gray-400/80 font-sans">
                                ({inh.value})
                              </span>
                            </span>
                          ) : (
                            <span
                              className="font-mono text-gray-300 text-[11px] truncate max-w-[280px]"
                              title={inh.value}
                            >
                              {inh.value || '<空>'}
                            </span>
                          )}
                        </div>

                        {inh.overridden && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 shrink-0 font-sans"
                            title="当前接口已定义同名参数，已覆盖此继承参数"
                          >
                            已覆盖
                          </span>
                        )}
                      </div>

                      <div
                        className="text-[10px] text-gray-500 truncate text-right max-w-[240px] shrink-0"
                        title={inh.description || inh.sourceName}
                      >
                        {inh.description || inh.sourceName}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Rows */}
        <div className="divide-y divide-line">
          {safeItems.map((item, index) => {
            const currentType: ParamDataType =
              item.data_type || (item.type === 'file' ? 'file' : 'string');
            const isFileType = currentType === 'file' || item.type === 'file';

            return (
              <div
                key={`${item.param_id || 'item'}-${index}`}
                className={`grid ${
                  showContentType
                    ? showDescription
                      ? 'grid-cols-[36px_1.5fr_1.5fr_1fr_1fr_36px]'
                      : 'grid-cols-[36px_1.8fr_2fr_1.2fr_36px]'
                    : showDescription
                    ? 'grid-cols-[36px_1.5fr_1.7fr_1.2fr_36px]'
                    : 'grid-cols-[36px_1.5fr_2fr_36px]'
                } items-center px-2 py-1 gap-2 hover:bg-hover transition ${
                  item.is_checked !== 1 ? 'opacity-50' : ''
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggle(index)}
                  className="flex items-center justify-center text-gray-400 hover:text-accent"
                >
                  {item.is_checked === 1 ? (
                    <CheckSquare className="w-4 h-4 text-accent" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {/* Key with Type & Required Mark */}
                <div className="flex items-center gap-1.5 min-w-0 bg-surface/60 rounded px-1 border border-transparent focus-within:border-accent/50">
                  <VariableInput
                    placeholder={keyPlaceholder}
                    value={item.key}
                    onChange={(val) => handleFieldChange(index, 'key', val)}
                    availableVars={availableVars}
                    suggestions={headerKeySuggestions}
                    className="flex-1 min-w-0 bg-transparent border-none text-gray-200 focus:outline-none rounded py-0.5"
                  />

                  {/* Subtle, clean Type Selector (Postman style, headers omitted, form-data limited to Text/File) */}
                  {actualShowType && !isHeaderTable && (
                    <div className="relative shrink-0 flex items-center group/type">
                      <select
                        value={isFormMode ? (isFileType ? 'file' : 'text') : currentType}
                        onChange={(e) => handleTypeChange(index, e.target.value)}
                        className="appearance-none bg-subtle/80 hover:bg-hover border border-line hover:border-gray-500/50 text-gray-400 hover:text-gray-200 text-[11px] font-medium pl-2 pr-4 py-0.5 rounded cursor-pointer focus:outline-none focus:border-accent/60 focus:text-foreground transition select-none"
                        title="设置参数类型"
                      >
                        {isFormMode
                          ? formDataOptions.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                className="bg-surface text-gray-200 py-1 text-xs"
                              >
                                {opt.label}
                              </option>
                            ))
                          : standardTypeOptions.map((opt) => (
                              <option
                                key={opt.value}
                                value={opt.value}
                                className="bg-surface text-gray-200 py-1 font-mono text-xs"
                              >
                                {opt.label}
                              </option>
                            ))}
                      </select>
                      <ChevronDown className="w-2.5 h-2.5 text-gray-500 group-hover/type:text-gray-300 absolute right-1 pointer-events-none transition-colors" />
                    </div>
                  )}

                  {/* Required * button */}
                  {showRequired && (
                    <button
                      type="button"
                      onClick={() =>
                        handleFieldChange(
                          index,
                          'is_required',
                          item.is_required === 1 ? 0 : 1
                        )
                      }
                      className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold shrink-0 transition select-none cursor-pointer ${
                        item.is_required === 1
                          ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 font-black'
                          : 'text-gray-400/35 hover:text-rose-400 hover:bg-hover'
                      }`}
                      title={
                        item.is_required === 1
                          ? '必填参数 (已开启，点击设为非必填)'
                          : '非必填 (点击设为必填)'
                      }
                    >
                      *
                    </button>
                  )}
                </div>

                {/* Value (Text input or File picker) */}
                {isFileType ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.file_path || item.value ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-subtle border border-line text-gray-200 text-xs flex-1 min-w-0">
                        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span
                          className="truncate flex-1 font-mono text-[11px]"
                          title={item.file_path || item.value}
                        >
                          {item.file_name ||
                            (item.file_path ? item.file_path.split(/[/\\]/).pop() : '') ||
                            item.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectFile(index)}
                          className="px-1.5 py-0.5 rounded bg-subtle hover:bg-hover text-gray-300 text-[10px] shrink-0 transition"
                          title="重新选择其他文件"
                        >
                          更换
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearFile(index)}
                          className="text-gray-400 hover:text-rose-400 shrink-0 p-0.5 transition"
                          title="删除所选文件"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectFile(index)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground transition text-[11px]"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>选择文件</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <VariableInput
                    placeholder={valuePlaceholder}
                    value={item.value}
                    onChange={(val) => handleFieldChange(index, 'value', val)}
                    availableVars={availableVars}
                    suggestions={isHeaderTable ? getHeaderValueSuggestions(item.key) : undefined}
                    className="w-full bg-surface/60 border border-transparent focus-within:border-accent/50 text-gray-200 rounded px-1.5 py-0.5"
                  />
                )}

                {/* Content Type (for Form-Data) */}
                {showContentType && (
                  <input
                    type="text"
                    placeholder="自动 (content-type)"
                    value={item.content_type || ''}
                    onChange={(e) =>
                      handleFieldChange(index, 'content_type', e.target.value)
                    }
                    className="w-full bg-surface/60 border border-transparent focus:border-accent/50 text-gray-300 placeholder-gray-600 rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none"
                  />
                )}

                {/* Description */}
                {showDescription && (
                  <input
                    type="text"
                    placeholder="说明 / 备注..."
                    value={item.description || ''}
                    onChange={(e) =>
                      handleFieldChange(index, 'description', e.target.value)
                    }
                    className="w-full bg-surface/60 border border-transparent focus:border-accent/50 text-gray-400 placeholder-gray-600 rounded px-1.5 py-0.5 focus:outline-none"
                  />
                )}

                {/* Delete Row */}
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="flex items-center justify-center text-gray-500 hover:text-rose-400 transition"
                  title="删除此行参数"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {safeItems.length === 0 && (
            <div className="py-6 text-center text-gray-500 text-xs">
              暂无参数，点击下方添加一行参数
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-subtle hover:bg-hover border border-line text-gray-300 font-medium transition"
      >
        <Plus className="w-3.5 h-3.5 text-accent" />
        添加一行参数
      </button>
    </div>
  );
};
