import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Code2, ChevronDown } from 'lucide-react';
import { ApiDetail } from '../../../common/types';
import { CodeGenerator, SupportedLanguage } from '../../../common/codeGenerator';
import { Tooltip } from './Tooltip';

interface CodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  api: ApiDetail;
  preUrl?: string;
}

const LANGUAGES: { id: SupportedLanguage; name: string }[] = [
  { id: 'curl', name: 'cURL' },
  { id: 'javascript-fetch', name: 'JavaScript (Fetch)' },
  { id: 'javascript-axios', name: 'JavaScript (Axios)' },
  { id: 'python-requests', name: 'Python (Requests)' },
  { id: 'go', name: 'Go (net/http)' },
  { id: 'java-okhttp', name: 'Java (OkHttp)' },
  { id: 'php-curl', name: 'PHP (cURL)' },
];

export const CodeDrawer: React.FC<CodeDrawerProps> = ({
  isOpen,
  onClose,
  api,
  preUrl = '',
}) => {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('curl');
  const [copied, setCopied] = useState(false);

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

  if (!isOpen) return null;

  const code = CodeGenerator.generate(api, selectedLang, preUrl);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-xs text-foreground">生成代码</span>
            <span className="text-[10px] text-gray-400 font-mono bg-surface px-1.5 py-0.5 rounded border border-line">
              {api.method || 'GET'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip content={copied ? '已复制到剪贴板' : '复制代码片段'} delayMs={300}>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-200 transition"
                aria-label="复制代码"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
            </Tooltip>

            <Tooltip content="关闭侧边栏 (Esc)" delayMs={300}>
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

        {/* Language Selector */}
        <div className="p-3 border-b border-line bg-surface shrink-0">
          <label className="text-[10px] text-gray-400 font-semibold block mb-1.5 uppercase tracking-wider">
            选择目标编程语言 / 客户端
          </label>
          <div className="relative">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as SupportedLanguage)}
              className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-xs text-indigo-300 font-medium focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id} className="bg-surface text-gray-200">
                  {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Code Snippet Area */}
        <div className="flex-1 p-3 overflow-y-auto flex flex-col min-h-0">
          <div className="flex-1 bg-subtle border border-line rounded-xl p-3.5 font-mono text-xs text-gray-300 leading-relaxed overflow-x-auto select-text shadow-inner">
            <pre className="m-0 font-mono">
              <code>{code}</code>
            </pre>
          </div>
          <div className="text-[10px] text-gray-500 mt-2 text-center shrink-0">
            随着接口参数与请求体实时动态更新
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
