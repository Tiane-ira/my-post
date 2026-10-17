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
} from 'lucide-react';
import { KeyValueItem, ParamDataType } from '../../../common/types';
import { VariableInput, VariableItem } from './VariableInput';

interface KeyValueTableProps {
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  availableVars?: Record<string, VariableItem>;
  allowFile?: boolean;
  showType?: boolean;
  showContentType?: boolean;
  showRequired?: boolean;
}

export const KeyValueTable: React.FC<KeyValueTableProps> = ({
  items,
  onChange,
  keyPlaceholder = '参数名',
  valuePlaceholder = '参数值',
  availableVars = {},
  allowFile = false,
  showType = true,
  showContentType = false,
  showRequired = true,
}) => {
  const handleToggle = (index: number) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      is_checked: next[index].is_checked === 1 ? -1 : 1,
    };
    onChange(next);
  };

  const handleFieldChange = (index: number, field: keyof KeyValueItem, val: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: val };
    onChange(next);
  };

  const handleTypeChange = (index: number, newType: ParamDataType) => {
    const next = [...items];
    const isFile = newType === 'file';
    next[index] = {
      ...next[index],
      data_type: newType,
      type: isFile ? 'file' : 'text',
      // If switching away from file, reset file attributes
      ...(isFile ? {} : { file_path: '', file_name: '', value: next[index].file_path ? '' : next[index].value }),
    };
    onChange(next);
  };

  const handleClearFile = (index: number) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      file_path: '',
      file_name: '',
      value: '',
    };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleAdd = () => {
    const next: KeyValueItem[] = [
      ...items,
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
          const next = [...items];
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
        const next = [...items];
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
    onChange(items.map((i) => ({ ...i, is_checked: 1 })));
  };

  const handleUncheckAll = () => {
    onChange(items.map((i) => ({ ...i, is_checked: -1 })));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const typeOptions: ParamDataType[] = allowFile
    ? ['string', 'file', 'integer', 'boolean', 'array', 'object']
    : ['string', 'integer', 'number', 'boolean', 'array', 'object'];

  return (
    <div className="w-full text-xs space-y-2">
      {/* Top Toolbar: Quick Actions */}
      <div className="flex items-center justify-between text-gray-400">
        <div className="text-[11px] font-medium text-gray-400">
          参数列表 ({items.length})
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {items.length > 0 && (
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
              ? 'grid-cols-[36px_1.5fr_1.5fr_1fr_1fr_36px]'
              : 'grid-cols-[36px_1.5fr_1.7fr_1.2fr_36px]'
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
          <div>说明 / 描述</div>
          <div className="text-center">操作</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-line">
          {items.map((item, index) => {
            const currentType: ParamDataType =
              item.data_type || (item.type === 'file' ? 'file' : 'string');
            const isFileType = currentType === 'file' || item.type === 'file';

            return (
              <div
                key={`${item.param_id || 'item'}-${index}`}
                className={`grid ${
                  showContentType
                    ? 'grid-cols-[36px_1.5fr_1.5fr_1fr_1fr_36px]'
                    : 'grid-cols-[36px_1.5fr_1.7fr_1.2fr_36px]'
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
                    className="flex-1 min-w-0 bg-transparent border-none text-gray-200 focus:outline-none rounded py-0.5"
                  />

                  {/* Type Pill Selector with native overlay dropdown to prevent overflow clipping */}
                  {showType && (
                    <div className="relative shrink-0 flex items-center">
                      <select
                        value={currentType}
                        onChange={(e) => handleTypeChange(index, e.target.value as ParamDataType)}
                        className="appearance-none bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-mono text-[11px] font-semibold pl-2 pr-5 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent transition"
                        title="设置参数类型"
                      >
                        {typeOptions.map((t) => (
                          <option
                            key={t}
                            value={t}
                            className="bg-subtle text-gray-200 py-1 font-mono text-xs"
                          >
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-2.5 h-2.5 text-accent opacity-70 absolute right-1.5 pointer-events-none" />
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
                <input
                  type="text"
                  placeholder="描述 / 备注..."
                  value={item.description || ''}
                  onChange={(e) =>
                    handleFieldChange(index, 'description', e.target.value)
                  }
                  className="w-full bg-surface/60 border border-transparent focus:border-accent/50 text-gray-400 placeholder-gray-600 rounded px-1.5 py-0.5 focus:outline-none"
                />

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

          {items.length === 0 && (
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
