import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Code2, ChevronDown, Radio, Zap, Sparkles } from 'lucide-react';
import { ApiDetail } from '../../../common/types';
import { CodeGenerator, SupportedLanguage } from '../../../common/codeGenerator';
import { Tooltip } from './Tooltip';

interface CodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  api: ApiDetail;
  preUrl?: string;
  availableVars?: Record<string, any>;
}

export const CodeDrawer: React.FC<CodeDrawerProps> = ({
  isOpen,
  onClose,
  api,
  preUrl = '',
  availableVars = {},
}) => {
  const languages = useMemo(() => {
    return CodeGenerator.getLanguagesForApi(api);
  }, [api.target_type]);

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(() => {
    return languages[0]?.id || 'curl';
  });
  const [copied, setCopied] = useState(false);
  const [resolveVariables, setResolveVariables] = useState<boolean>(true);

  // Synchronize default language when switching API types (HTTP, SSE, WebSocket)
  useEffect(() => {
    const exists = languages.some((l) => l.id === selectedLang);
    if (!exists && languages.length > 0) {
      setSelectedLang(languages[0].id);
    }
  }, [languages, selectedLang]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const code = useMemo(() => {
    return CodeGenerator.generate(
      api,
      selectedLang,
      preUrl,
      resolveVariables ? availableVars : undefined
    );
  }, [api, selectedLang, preUrl, resolveVariables, availableVars]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWs = api.target_type === 'websocket';
  const isSse = api.target_type === 'sse';

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none select-none">
      {/* Standalone backdrop overlay layer */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-auto transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
      />

      {/* Right Sidebar Drawer layer: Spans 100% height from top to bottom of window without affecting main layout */}
      <div className="relative w-[480px] max-w-[90vw] h-full bg-surface border-l border-line shadow-2xl flex flex-col z-10 pointer-events-auto animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="h-12 px-4 bg-subtle border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent" />
            <span className="font-bold text-xs text-foreground">生成客户端代码</span>
            {isWs ? (
              <span className="text-[10px] text-teal-400 font-mono bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/30 flex items-center gap-1">
                <Radio className="w-3 h-3" />
                <span>WebSocket</span>
              </span>
            ) : isSse ? (
              <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/30 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>SSE ({api.method || 'GET'})</span>
              </span>
            ) : (
              <span className="text-[10px] text-gray-300 font-mono bg-surface px-1.5 py-0.5 rounded border border-line">
                {api.method || 'GET'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip content={copied ? '已复制到剪贴板' : '复制代码片段'} delayMs={300}>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-foreground transition"
                aria-label="复制代码"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
            </Tooltip>

            <Tooltip content="关闭代码生成器" delayMs={300}>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground transition"
                aria-label="关闭侧边栏"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Language Selector & Variable Resolution Controls */}
        <div className="p-3 border-b border-line bg-surface shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              选择目标编程语言 / 客户端
            </label>
            <Tooltip
              content={
                resolveVariables
                  ? '当前已生效变量替换：将 {{变量}} 占位符解析为实际值（点击切换为保留原始占位符）'
                  : '当前保留原始占位符：显示原始 {{变量}} 字符串（点击切换为替换生效）'
              }
              delayMs={300}
            >
              <button
                type="button"
                onClick={() => setResolveVariables((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition border select-none ${
                  resolveVariables
                    ? 'bg-accent/10 text-accent border-accent/40 font-medium'
                    : 'bg-subtle text-gray-400 border-line hover:text-foreground'
                }`}
              >
                <Sparkles className={`w-3 h-3 ${resolveVariables ? 'text-accent' : 'text-gray-400'}`} />
                <span>{resolveVariables ? '替换变量生效' : '保持原始占位符'}</span>
              </button>
            </Tooltip>
          </div>
          <div className="relative">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as SupportedLanguage)}
              className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-xs text-accent font-medium focus:outline-none focus:border-accent appearance-none cursor-pointer"
            >
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-surface text-foreground">
                  {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Code Snippet Area */}
        <div className="flex-1 p-3 overflow-y-auto flex flex-col min-h-0">
          <div className="flex-1 bg-subtle border border-line rounded-xl p-3.5 font-mono text-xs text-foreground leading-relaxed overflow-x-auto select-text shadow-inner">
            <pre className="m-0 font-mono">
              <code>{code}</code>
            </pre>
          </div>
          <div className="text-[10px] text-gray-400 mt-2 text-center shrink-0">
            {resolveVariables
              ? '已生效占位变量与环境变量替换，随着参数与配置实时动态响应'
              : '展示原始变量占位模板，随着参数与配置实时动态响应'}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
