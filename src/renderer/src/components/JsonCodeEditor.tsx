import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCode2,
  Copy,
  Check,
  Search,
  ChevronUp,
  ChevronDown,
  Replace,
  X,
  Code2,
  ListTree,
  WrapText,
  Minimize2,
  ChevronRight,
  Eye,
  ArrowRight,
} from 'lucide-react';

export interface JsonCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  defaultView?: 'code' | 'tree';
  showToolbar?: boolean;
  minHeight?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

interface JsonValidationResult {
  isValid: boolean;
  message: string;
  errorLine?: number;
  errorColumn?: number;
}

interface SearchMatch {
  index: number;
  length: number;
  line: number;
  col: number;
}

/**
 * Recursive Tree Node Component for Structured JSON Viewing
 */
interface JsonTreeNodeProps {
  name?: string;
  data: any;
  depth?: number;
  searchKeyword?: string;
  isLast?: boolean;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  name,
  data,
  depth = 0,
  searchKeyword = '',
  isLast = true,
}) => {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const [copiedField, setCopiedField] = useState(false);

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);

  // Check if this node or any descendants match the search keyword
  const matchesSearch = useMemo(() => {
    if (!searchKeyword.trim()) return false;
    const kw = searchKeyword.toLowerCase();
    if (name && name.toLowerCase().includes(kw)) return true;
    if (!isObject && String(data).toLowerCase().includes(kw)) return true;
    return false;
  }, [name, data, isObject, searchKeyword]);

  // Auto-expand if search matches inside
  useEffect(() => {
    if (searchKeyword.trim() && matchesSearch) {
      setCollapsed(false);
    }
  }, [searchKeyword, matchesSearch]);

  const handleCopyValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const strVal = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    navigator.clipboard.writeText(strVal);
    setCopiedField(true);
    setTimeout(() => setCopiedField(false), 1500);
  };

  const renderHighlightedText = (text: string) => {
    if (!searchKeyword.trim()) return text;
    const parts = text.split(new RegExp(`(${searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, idx) =>
      part.toLowerCase() === searchKeyword.toLowerCase() ? (
        <mark key={idx} className="bg-amber-400 text-black font-semibold rounded-xs px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isObject) {
    let typeClass = 'text-sky-400';
    if (typeof data === 'number') typeClass = 'text-amber-400';
    if (typeof data === 'boolean') typeClass = 'text-purple-400';
    if (data === null) typeClass = 'text-rose-400 italic';

    return (
      <div
        style={{ paddingLeft: `${depth * 14}px` }}
        className={`group flex items-center py-0.5 text-xs font-mono hover:bg-line/20 rounded px-1.5 transition-colors ${
          matchesSearch ? 'bg-amber-500/15 border-l-2 border-amber-400' : ''
        }`}
      >
        {name !== undefined && (
          <span className="text-indigo-400 font-semibold mr-1.5 shrink-0 select-text">
            "{renderHighlightedText(name)}":
          </span>
        )}
        <span className={`${typeClass} truncate select-text`}>
          {typeof data === 'string' ? `"${renderHighlightedText(data)}"` : renderHighlightedText(String(data))}
          {!isLast && <span className="text-gray-500">,</span>}
        </span>
        <button
          onClick={handleCopyValue}
          className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 rounded text-gray-500 hover:text-foreground text-[10px] transition cursor-pointer"
          title="复制值"
        >
          {copiedField ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
      </div>
    );
  }

  const keys = Object.keys(data);
  const count = keys.length;
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div className="select-text">
      <div
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => setCollapsed(!collapsed)}
        className={`group flex items-center py-0.5 text-xs font-mono hover:bg-line/20 rounded px-1.5 cursor-pointer transition-colors ${
          matchesSearch ? 'bg-amber-500/15 border-l-2 border-amber-400' : ''
        }`}
      >
        <span className="mr-1 text-gray-500 hover:text-foreground">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>

        {name !== undefined && (
          <span className="text-indigo-400 font-semibold mr-1.5">
            "{renderHighlightedText(name)}":
          </span>
        )}

        <span className="text-gray-400 font-bold">{openBracket}</span>

        {collapsed && (
          <span className="text-[10px] text-gray-500 mx-1.5 bg-subtle px-1.5 py-0.2 rounded border border-line select-none">
            {count} {isArray ? 'items' : 'keys'} ...
          </span>
        )}

        {collapsed && (
          <span className="text-gray-400 font-bold">
            {closeBracket}
            {!isLast && <span className="text-gray-500">,</span>}
          </span>
        )}

        <button
          onClick={handleCopyValue}
          className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 rounded text-gray-500 hover:text-foreground text-[10px] transition cursor-pointer"
          title="复制结构 JSON"
        >
          {copiedField ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="border-l border-line/30 ml-2">
          {keys.map((key, idx) => (
            <JsonTreeNode
              key={key}
              name={isArray ? undefined : key}
              data={data[key]}
              depth={depth + 1}
              searchKeyword={searchKeyword}
              isLast={idx === keys.length - 1}
            />
          ))}
          <div
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="text-xs font-mono text-gray-400 py-0.5 select-text"
          >
            {closeBracket}
            {!isLast && <span className="text-gray-500">,</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value = '',
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  className = '',
  readOnly = false,
  defaultView = 'code',
  showToolbar = true,
  minHeight = '180px',
  onKeyDown,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<'code' | 'tree'>(defaultView);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Search & Replace states
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showReplace, setShowReplace] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Split lines
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
    const trimmed = (value || '').trim();
    if (!trimmed) {
      return { isValid: true, message: 'JSON 内容为空' };
    }

    // Mask variable references like {{var}} or {{var.sub}} to valid string tokens
    const masked = trimmed.replace(/\{\{\s*[\w\.\-]+\s*\}\}/g, '"VAR_TOKEN"');

    try {
      JSON.parse(masked);
      return {
        isValid: true,
        message: 'JSON 结构合法有效',
      };
    } catch (err: any) {
      const msg: string = err.message || 'JSON 语法错误';
      let errorLine: number | undefined;
      let errorColumn: number | undefined;

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

  // Parsed object for Tree View
  const parsedTreeData = useMemo(() => {
    if (viewMode !== 'tree') return null;
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    try {
      const masked = trimmed.replace(/\{\{\s*[\w\.\-]+\s*\}\}/g, '"VAR_TOKEN"');
      return JSON.parse(masked);
    } catch {
      return null;
    }
  }, [value, viewMode]);

  // Calculate search matches across value
  const searchMatches = useMemo<SearchMatch[]>(() => {
    if (!searchQuery.trim()) return [];

    const matches: SearchMatch[] = [];
    const text = value || '';
    const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    const target = caseSensitive ? text : text.toLowerCase();

    let pos = 0;
    while (pos < target.length) {
      const foundIdx = target.indexOf(query, pos);
      if (foundIdx === -1) break;

      // Calculate line and col
      const textBefore = text.substring(0, foundIdx);
      const lineArr = textBefore.split('\n');
      const line = lineArr.length;
      const col = lineArr[lineArr.length - 1].length + 1;

      matches.push({
        index: foundIdx,
        length: query.length,
        line,
        col,
      });

      pos = foundIdx + query.length;
    }

    return matches;
  }, [value, searchQuery, caseSensitive]);

  // Keep active index in bounds
  useEffect(() => {
    if (searchMatches.length === 0) {
      setActiveMatchIndex(0);
    } else if (activeMatchIndex >= searchMatches.length) {
      setActiveMatchIndex(0);
    }
  }, [searchMatches.length, activeMatchIndex]);

  // Scroll and select active match in textarea
  const scrollToMatch = useCallback(
    (index: number) => {
      if (searchMatches.length === 0 || !textareaRef.current) return;
      const match = searchMatches[index];
      if (!match) return;

      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(match.index, match.index + match.length);

      // Scroll textarea to the matched line
      const lineHeight = 18;
      const targetScroll = Math.max(0, (match.line - 3) * lineHeight);
      textarea.scrollTop = targetScroll;
    },
    [searchMatches]
  );

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(nextIdx);
    scrollToMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prevIdx);
    scrollToMatch(prevIdx);
  };

  // Replace single match
  const handleReplaceCurrent = () => {
    if (readOnly || !onChange || searchMatches.length === 0) return;
    const match = searchMatches[activeMatchIndex];
    if (!match) return;

    const before = value.substring(0, match.index);
    const after = value.substring(match.index + match.length);
    const nextVal = before + replaceQuery + after;

    onChange(nextVal);
    // After replace, keep or navigate to next
    setTimeout(() => {
      scrollToMatch(activeMatchIndex % Math.max(1, searchMatches.length - 1));
    }, 50);
  };

  // Batch Replace All
  const handleReplaceAll = () => {
    if (readOnly || !onChange || searchMatches.length === 0 || !searchQuery) return;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    const nextVal = value.replace(regex, replaceQuery);
    onChange(nextVal);
  };

  // Global keydown within editor container for Ctrl+F and Ctrl+H
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopPropagation();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h' && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      setShowSearch(true);
      setShowReplace(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === 'Escape') {
      if (showSearch) {
        setShowSearch(false);
        setShowReplace(false);
        textareaRef.current?.focus();
      }
    }
  };

  // Auto-completion pairs for quotes, braces, brackets, and parenthesis
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }
    if (readOnly || !onChange) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const charAfter = value.charAt(start);

    // Double Quote Completion `"`
    if (e.key === '"') {
      e.preventDefault();
      if (start === end && charAfter === '"') {
        textarea.setSelectionRange(start + 1, start + 1);
        return;
      }
      const newText = value.substring(0, start) + `"${selectedText}"` + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.setSelectionRange(start + 1, end + 1);
      }, 0);
      return;
    }

    // Curly Braces `{}`
    if (e.key === '{') {
      e.preventDefault();
      const newText = value.substring(0, start) + `{${selectedText}}` + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.setSelectionRange(start + 1, end + 1);
      }, 0);
      return;
    }

    // Square Brackets `[]`
    if (e.key === '[') {
      e.preventDefault();
      const newText = value.substring(0, start) + `[${selectedText}]` + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.setSelectionRange(start + 1, end + 1);
      }, 0);
      return;
    }

    // Tab key: Indent 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: Dedent
        const linesBefore = value.substring(0, start).split('\n');
        const currentLineIdx = linesBefore.length - 1;
        const allLines = value.split('\n');
        const currentLine = allLines[currentLineIdx];
        if (currentLine.startsWith('  ')) {
          allLines[currentLineIdx] = currentLine.substring(2);
          const nextVal = allLines.join('\n');
          onChange(nextVal);
          setTimeout(() => {
            textarea.setSelectionRange(Math.max(0, start - 2), Math.max(0, end - 2));
          }, 0);
        }
      } else {
        // Tab: Insert 2 spaces
        const newText = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newText);
        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
      return;
    }

    // Enter key: Auto-indentation
    if (e.key === 'Enter') {
      e.preventDefault();
      const textBefore = value.substring(0, start);
      const currentLine = textBefore.split('\n').pop() || '';
      const indentMatch = currentLine.match(/^(\s*)/);
      let currentIndent = indentMatch ? indentMatch[1] : '';

      const lastChar = textBefore.trim().slice(-1);
      const nextChar = value.substring(start).trim().charAt(0);

      if ((lastChar === '{' && nextChar === '}') || (lastChar === '[' && nextChar === ']')) {
        const insertText = `\n${currentIndent}  \n${currentIndent}`;
        const newText = value.substring(0, start) + insertText + value.substring(end);
        onChange(newText);
        setTimeout(() => {
          const newPos = start + currentIndent.length + 3;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      } else if (lastChar === '{' || lastChar === '[') {
        const insertText = `\n${currentIndent}  `;
        const newText = value.substring(0, start) + insertText + value.substring(end);
        onChange(newText);
        setTimeout(() => {
          const newPos = start + insertText.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      } else {
        const insertText = `\n${currentIndent}`;
        const newText = value.substring(0, start) + insertText + value.substring(end);
        onChange(newText);
        setTimeout(() => {
          const newPos = start + insertText.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
    }
  };

  // Prettify / Format JSON
  const handleFormat = () => {
    if (readOnly || !onChange) return;
    const trimmed = (value || '').trim();
    if (!trimmed) return;

    // Mask {{var}} expressions
    const varMap = new Map<string, string>();
    let varIdx = 0;
    const masked = trimmed.replace(/\{\{\s*[\w\.\-]+\s*\}\}/g, (match) => {
      const placeholder = `__VAR_TOKEN_${varIdx++}__`;
      varMap.set(placeholder, match);
      return `"${placeholder}"`;
    });

    try {
      const parsed = JSON.parse(masked);
      let formatted = JSON.stringify(parsed, null, 2);

      // Restore {{var}} expressions
      varMap.forEach((orig, placeholder) => {
        formatted = formatted.replace(new RegExp(`"${placeholder}"`, 'g'), orig);
      });

      onChange(formatted);
    } catch {
      // Fallback
    }
  };

  // Minify JSON
  const handleMinify = () => {
    if (readOnly || !onChange) return;
    const trimmed = (value || '').trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      onChange(JSON.stringify(parsed));
    } catch {
      // Direct regex minify if parsing fails
      const minified = trimmed
        .replace(/\n\s*/g, ' ')
        .replace(/\s*([{}:[\],])\s*/g, '$1')
        .trim();
      onChange(minified);
    }
  };

  // Copy full content
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onKeyDown={handleContainerKeyDown}
      style={{ minHeight }}
      className={`flex flex-col bg-canvas border border-line rounded-lg overflow-hidden relative text-xs font-mono select-none ${className}`}
    >
      {/* Sleek Top Toolbar */}
      {showToolbar && (
        <div className="h-8 px-2.5 bg-subtle/50 border-b border-line flex items-center justify-between shrink-0">
          {/* Left: View Mode Toggle & Validation Indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface border border-line rounded p-0.5 text-[11px] font-sans">
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={`p-1 rounded flex items-center justify-center transition ${
                  viewMode === 'code'
                    ? 'bg-accent text-white font-medium shadow-xs'
                    : 'text-gray-400 hover:text-foreground'
                }`}
                title="代码文本模式"
                aria-label="代码文本模式"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`p-1 rounded flex items-center justify-center transition ${
                  viewMode === 'tree'
                    ? 'bg-accent text-white font-medium shadow-xs'
                    : 'text-gray-400 hover:text-foreground'
                }`}
                title="树状结构模式"
                aria-label="树状结构模式"
              >
                <ListTree className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Validation Indicator: Subtle Status Dot or Error Pill */}
            <div className="flex items-center text-[11px]">
              {validation.isValid ? (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400/90 ml-1"
                  title={validation.message || 'JSON 格式有效'}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('code');
                    if (validation.errorLine && textareaRef.current) {
                      const targetLine = validation.errorLine;
                      const textBefore = lines.slice(0, targetLine - 1).join('\n');
                      const pos = textBefore.length + (targetLine > 1 ? 1 : 0);
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(pos, pos);
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] text-rose-400 font-sans ml-1 hover:underline cursor-pointer"
                  title={`${validation.message} (点击定位)`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  <span>语法错误{validation.errorLine ? ` :${validation.errorLine}` : ''}</span>
                </button>
              )}
            </div>

            {/* Faint line count */}
            <span className="text-[10px] text-gray-500/80 font-mono ml-1 hidden sm:inline select-none">
              {lines.length} 行
            </span>
          </div>

          {/* Right: Consolidated Tools */}
          <div className="flex items-center gap-1">
            {/* Format (Pretty) */}
            {!readOnly && (
              <button
                type="button"
                onClick={handleFormat}
                className="p-1.5 rounded hover:bg-hover text-gray-400 hover:text-foreground transition flex items-center justify-center"
                title="美化 JSON 结构"
                aria-label="美化 JSON"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}

            {/* Search (Ctrl+F) */}
            <button
              type="button"
              onClick={() => {
                setShowSearch(!showSearch);
                if (!showSearch) {
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }
              }}
              className={`p-1.5 rounded hover:bg-hover transition flex items-center justify-center ${
                showSearch
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-400 hover:text-foreground'
              }`}
              title="搜索 (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Wrap Lines Toggle (Code view only) */}
            {viewMode === 'code' && (
              <button
                type="button"
                onClick={() => setWrapLines(!wrapLines)}
                className={`p-1.5 rounded hover:bg-hover transition flex items-center justify-center ${
                  wrapLines
                    ? 'text-accent'
                    : 'text-gray-400 hover:text-foreground'
                }`}
                title={wrapLines ? '关闭自动换行' : '开启自动换行'}
              >
                <WrapText className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Copy Content */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-hover text-gray-400 hover:text-foreground transition flex items-center justify-center"
              title="复制全部内容"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Modern Search & Replace Card */}
      {showSearch && (
        <div className="absolute top-9 right-3 z-30 bg-surface/95 backdrop-blur-md border border-line shadow-2xl rounded-lg p-2 flex flex-col gap-1.5 min-w-[310px] max-w-[90%] text-xs font-sans">
          {/* Row 1: Search */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  } else if (e.key === 'Escape') {
                    setShowSearch(false);
                  }
                }}
                placeholder="搜索内容..."
                className="w-full bg-subtle border border-line rounded pl-7 pr-14 py-1 text-xs text-foreground placeholder:text-gray-500 focus:outline-none focus:border-accent font-mono"
              />
              <span className="absolute right-2 text-[10px] font-mono text-gray-400 select-none">
                {searchMatches.length > 0
                  ? `${activeMatchIndex + 1}/${searchMatches.length}`
                  : searchQuery
                  ? '0/0'
                  : ''}
              </span>
            </div>

            {/* Case Sensitive Toggle */}
            <button
              type="button"
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                caseSensitive
                  ? 'bg-accent/20 border-accent/40 text-accent'
                  : 'bg-subtle border-line text-gray-400 hover:text-foreground'
              }`}
              title="区分大小写"
            >
              Aa
            </button>

            {/* Prev & Next Match Buttons */}
            <button
              type="button"
              onClick={handlePrevMatch}
              disabled={searchMatches.length === 0}
              className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground disabled:opacity-30"
              title="上一个匹配"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextMatch}
              disabled={searchMatches.length === 0}
              className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground disabled:opacity-30"
              title="下一个匹配"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Replace */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowReplace(!showReplace)}
                className={`p-1 rounded hover:bg-hover transition ${
                  showReplace ? 'text-accent bg-accent/15' : 'text-gray-400 hover:text-foreground'
                }`}
                title="展开/折叠替换"
              >
                <Replace className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Close Search */}
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                setShowReplace(false);
              }}
              className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground"
              title="关闭搜索"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 2: Replace */}
          {showReplace && !readOnly && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-line/50">
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReplaceCurrent();
                }}
                placeholder="替换为..."
                className="flex-1 bg-subtle border border-line rounded px-2.5 py-1 text-xs text-foreground placeholder:text-gray-500 focus:outline-none focus:border-accent font-mono"
              />
              <button
                type="button"
                onClick={handleReplaceCurrent}
                disabled={searchMatches.length === 0}
                className="px-2 py-0.5 rounded bg-surface hover:bg-hover border border-line text-[11px] text-gray-200 disabled:opacity-30"
                title="替换当前匹配项"
              >
                替换
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={searchMatches.length === 0}
                className="px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/30 border border-accent/40 text-[11px] text-accent disabled:opacity-30"
                title="替换全部匹配项"
              >
                全部
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Body: Code View or Tree View */}
      <div className="flex-1 flex overflow-hidden relative">
        {viewMode === 'tree' ? (
          <div className="flex-1 p-2.5 overflow-auto bg-surface">
            {parsedTreeData ? (
              <JsonTreeNode data={parsedTreeData} searchKeyword={searchQuery} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-1.5 py-6">
                <AlertCircle className="w-4 h-4 text-amber-500/70" />
                <span className="text-[11px]">JSON 格式有语法错误或为空，无法解析树状结构</span>
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className="text-[11px] text-accent underline hover:opacity-80 cursor-pointer"
                >
                  返回代码视图修正
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Code View with Subtle Line Numbers Gutter */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Minimalist Line Numbers Gutter */}
            <div
              ref={lineNumbersRef}
              className="w-8 sm:w-9 bg-transparent border-r border-line/40 py-2.5 text-right text-gray-500/40 select-none overflow-hidden shrink-0 font-mono text-[11px] leading-[18px]"
            >
              {lines.map((_, i) => {
                const lineNum = i + 1;
                const isErrorLine = validation.errorLine === lineNum;
                return (
                  <div
                    key={i}
                    className={`px-1.5 h-[18px] ${
                      isErrorLine ? 'bg-rose-500/20 text-rose-400 font-bold' : ''
                    }`}
                  >
                    {lineNum}
                  </div>
                );
              })}
            </div>

            {/* Textarea Editor / Viewer */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleEditorKeyDown}
              readOnly={readOnly}
              placeholder={placeholder}
              spellCheck={false}
              className={`flex-1 bg-surface p-2.5 text-xs font-mono text-text-main focus:outline-none resize-none leading-[18px] select-text ${
                wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
              } ${readOnly ? 'cursor-default' : ''}`}
            />
          </div>
        )}
      </div>
    </div>
  );
};
