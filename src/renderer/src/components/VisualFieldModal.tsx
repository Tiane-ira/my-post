import React, { useState, useEffect } from 'react';
import { X, Layers, Check, Sparkles, RotateCcw } from 'lucide-react';
import { VisualFieldEditor } from './VisualFieldEditor';
import { VariableItem } from './VariableInput';
import { useFeedback } from './FeedbackContext';

interface VisualFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  format: 'json' | 'xml';
  onSave: (newValue: string) => void;
  availableVars?: Record<string, VariableItem>;
}

export const VisualFieldModal: React.FC<VisualFieldModalProps> = ({
  isOpen,
  onClose,
  value,
  format,
  onSave,
  availableVars = {},
}) => {
  const { toast } = useFeedback();
  const [draftValue, setDraftValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setDraftValue(value || (format === 'json' ? '{}' : '<root></root>'));
    }
  }, [isOpen, value, format]);

  const handleApply = () => {
    onSave(draftValue);
    toast.success(`✨ 可视化 ${format.toUpperCase()} 字段已更新并同步至请求体！`);
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[980px] max-w-[94vw] h-[84vh] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="h-12 px-5 bg-subtle border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 font-bold text-sm text-foreground">
            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Layers className="w-4 h-4 text-accent" />
            </div>
            <span>可视化字段编辑</span>
            <span className="ml-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent/15 text-accent border border-accent/30">
              {format.toUpperCase()}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-hover text-gray-400 hover:text-foreground transition"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-2.5 bg-surface border-b border-line flex items-center justify-between text-gray-400 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              在树形表格中可视化增删查改字段、设置字段类型与必填项，点击底部【保存并应用】即可同步回请求代码。
            </span>
          </div>
          <span className="text-gray-500 font-mono">
            {format === 'json' ? 'JSON 树状结构' : 'XML 节点树'}
          </span>
        </div>

        {/* Body Editor Container */}
        <div className="flex-1 overflow-y-auto p-4 bg-surface">
          <VisualFieldEditor
            value={draftValue}
            onChange={(newVal) => setDraftValue(newVal)}
            format={format}
            availableVars={availableVars}
          />
        </div>

        {/* Footer */}
        <div className="h-14 px-5 bg-subtle border-t border-line flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-500 font-mono">
            支持嵌套 Object / Array 容器及 {'{{变量}}'} 引用
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 font-medium transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold shadow-md shadow-orange-500/10 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存并应用到代码</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
