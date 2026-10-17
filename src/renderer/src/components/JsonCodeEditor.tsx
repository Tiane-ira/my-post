import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Sparkles, FileCode2, Copy, Check } from 'lucide-react';

interface JsonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface JsonValidationResult {
  isValid: boolean;
  message: string;
  errorLine?: number;
  errorColumn?: number;
}

export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value = '',
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Line count
  const lines = useMemo(() => {
    return (value || '').split('\n');
  }, [value]);

  // Synchronize scroll between line numbers gutter and textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Real-time JSON validation (safely handling {{var}} variable expressions)
  const validation: JsonValidationResult = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return { isValid: true, message: 'JSON 内容为空' };
    }

    // Mask variable references like {{var}} or {{var.sub}} to valid string tokens
    const masked = trimmed.replace(/\{\{\s*[\w\.\-]+\s*\}\}/g, '"VAR_TOKEN"');

    try {
      JSON.parse(masked);
      return {
        isValid: true,
        message: 'JSON 格式合法有效',
      };
    } catch (err: any) {
      const msg: string = err.message || 'JSON 语法错误';
      let errorLine: number | undefined;
      let errorColumn: number | undefined;

      // Extract line and column numbers if provided by engine (e.g., "at line 2 column 5")
      const lineMatch = msg.match(/line\s+(\d+)/i) || msg.match(/position\s+(\d+)/i);
      const colMatch = msg.match(/column\s+(\d+)/i);

      if (lineMatch && msg.includes('line')) {
        errorLine = parseInt(lineMatch[1], 10);
      } else if (lineMatch && msg.includes('position')) {
        const pos = parseInt(lineMatch[1], 10);
        const textBeforePos = masked.slice(0, pos);
        errorLine = textBeforePos.split('\n').length;
        errorColumn = textBeforePos.split('\n').pop()?.length || 1;
      }

      if (colMatch) {
        errorColumn = parseInt(colMatch[1], 10);
      }

      return {
        isValid: false,
        message: msg,
        errorLine,
        errorColumn,
      };
    }
  }, [value]);

  // Auto-completion pairs for quotes, braces, brackets, and parenthesis
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const charBefore = value.charAt(start - 1);
    const charAfter = value.charAt(start);

    // 1. Double Quote Completion `"`
    if (e.key === '"') {
      e.preventDefault();
      if (selectedText.length > 0) {
        // Wrap selection in quotes
        const nextValue = value.substring(0, start) + `"${selectedText}"` + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
      } else if (charAfter === '"') {
        // Overtype existing closing quote
        textarea.setSelectionRange(start + 1, start + 1);
      } else {
        // Auto-insert pair `""` with cursor in-between
        const nextValue = value.substring(0, start) + '""' + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
      return;
    }

    // 2. Single Quote Completion `'`
    if (e.key === "'") {
      e.preventDefault();
      if (selectedText.length > 0) {
        const nextValue = value.substring(0, start) + `'${selectedText}'` + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
      } else if (charAfter === "'") {
        textarea.setSelectionRange(start + 1, start + 1);
      } else {
        const nextValue = value.substring(0, start) + "''" + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
      return;
    }

    // 3. Curly Braces `{`
    if (e.key === '{') {
      e.preventDefault();
      if (selectedText.length > 0) {
        const nextValue = value.substring(0, start) + `{${selectedText}}` + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
      } else {
        const nextValue = value.substring(0, start) + '{}' + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
      return;
    }

    // Overtype `}`
    if (e.key === '}' && charAfter === '}') {
      e.preventDefault();
      textarea.setSelectionRange(start + 1, start + 1);
      return;
    }

    // 4. Square Brackets `[`
    if (e.key === '[') {
      e.preventDefault();
      if (selectedText.length > 0) {
        const nextValue = value.substring(0, start) + `[${selectedText}]` + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, end + 1);
        }, 0);
      } else {
        const nextValue = value.substring(0, start) + '[]' + value.substring(end);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start + 1, start + 1);
        }, 0);
      }
      return;
    }

    // Overtype `]`
    if (e.key === ']' && charAfter === ']') {
      e.preventDefault();
      textarea.setSelectionRange(start + 1, start + 1);
      return;
    }

    // 5. Backspace pair deletion (e.g. between `""`, `''`, `{}`, `[]`)
    if (e.key === 'Backspace' && start === end) {
      const isPair =
        (charBefore === '"' && charAfter === '"') ||
        (charBefore === "'" && charAfter === "'") ||
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '[' && charAfter === ']');

      if (isPair) {
        e.preventDefault();
        const nextValue = value.substring(0, start - 1) + value.substring(start + 1);
        onChange(nextValue);
        setTimeout(() => {
          textarea.setSelectionRange(start - 1, start - 1);
        }, 0);
        return;
      }
    }

    // 6. Enter inside `{}` or `[]` with smart 2-space indentation
    if (e.key === 'Enter' && start === end) {
      const isBetweenBraces =
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '[' && charAfter === ']');

      if (isBetweenBraces) {
        e.preventDefault();
        // Calculate indentation of current line
        const currentLine = value.substring(0, start).split('\n').pop() || '';
        const baseIndent = currentLine.match(/^\s*/)?.[0] || '';
        const innerIndent = baseIndent + '  ';

        const nextValue =
          value.substring(0, start) +
          '\n' +
          innerIndent +
          '\n' +
          baseIndent +
          value.substring(end);

        onChange(nextValue);
        setTimeout(() => {
          const newPos = start + 1 + innerIndent.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }
    }

    // 7. Tab key for 2 spaces indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(nextValue);
      setTimeout(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
      return;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`flex flex-col h-full bg-surface border border-line rounded-lg overflow-hidden focus-within:border-accent transition ${className}`}>
      {/* Editor Body with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative font-mono text-xs leading-relaxed">
        {/* Line Numbers Gutter */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="w-10 bg-subtle text-gray-600 select-none text-right pr-2 py-3 border-r border-line overflow-hidden shrink-0 font-mono text-[11px]"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isErrorLine = validation.errorLine === lineNum;
            return (
              <div
                key={idx}
                className={`h-[21px] flex items-center justify-end ${
                  isErrorLine ? 'text-rose-400 font-bold bg-rose-500/20' : ''
                }`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          spellCheck={false}
          className="flex-1 w-full bg-transparent p-3 text-gray-200 placeholder-gray-600 focus:outline-none resize-none leading-[21px] selection:bg-accent/30"
        />

        {/* Floating Quick Action */}
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-3 top-3 p-1.5 rounded bg-subtle/80 hover:bg-hover text-gray-400 hover:text-foreground border border-line transition shadow-md"
          title="复制 JSON 内容"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Real-time JSON Validation Footer Status Bar */}
      <div className="h-7 px-3 bg-subtle border-t border-line flex items-center justify-between text-[11px] select-none shrink-0 font-mono">
        <div className="flex items-center gap-2 truncate">
          {validation.isValid ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{value.trim() ? 'JSON 格式正确 (有效)' : '空 JSON 内容'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400 font-medium truncate" title={validation.message}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span className="truncate">
                JSON 语法错误: {validation.message}
                {validation.errorLine ? ` (第 ${validation.errorLine} 行)` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-gray-500 shrink-0 text-[10px]">
          <span>{lines.length} 行</span>
          <span>{value.length} 字符</span>
          <span className="text-gray-600">双引号/括号自动补全已启用</span>
        </div>
      </div>
    </div>
  );
};
