import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Variable, Check, Sparkles, Copy, AlertCircle } from 'lucide-react';

export interface VariableItem {
  value: string;
  source: 'env' | 'global';
}

interface VariableInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  availableVars?: Record<string, VariableItem>;
  type?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}

interface TokenPart {
  isVar: boolean;
  text: string;
  key?: string;
  startIndex: number;
  endIndex: number;
}

export const VariableInput: React.FC<VariableInputProps> = ({
  value = '',
  onChange,
  placeholder = '',
  className = '',
  availableVars = {},
  type = 'text',
  onKeyDown,
  onPaste,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [isFocused, setIsFocused] = useState(false);

  // Hover card state for inspecting matched variables (Postman style)
  const [hoveredVar, setHoveredVar] = useState<{
    key: string;
    item?: VariableItem;
    rect: DOMRect;
  } | null>(null);
  const [copiedValue, setCopiedValue] = useState(false);

  // Dropdown portal coordinates
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    bottom?: number;
    left: number;
    width: number;
    placeAbove: boolean;
  }>({
    top: 0,
    left: 0,
    width: 280,
    placeAbove: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const strValue = typeof value === 'string' ? value : '';

  // Parse value into normal text and variable tokens with character offsets
  const tokenParts = useMemo(() => {
    const parts: TokenPart[] = [];
    let lastIndex = 0;
    const regex = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(strValue)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          isVar: false,
          text: strValue.slice(lastIndex, match.index),
          startIndex: lastIndex,
          endIndex: match.index,
        });
      }
      parts.push({
        isVar: true,
        text: match[0],
        key: match[1],
        startIndex: match.index,
        endIndex: regex.lastIndex,
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < strValue.length) {
      parts.push({
        isVar: false,
        text: strValue.slice(lastIndex),
        startIndex: lastIndex,
        endIndex: strValue.length,
      });
    }
    return parts;
  }, [strValue]);

  const hasVariables = tokenParts.some((p) => p.isVar);

  // Sync horizontal scrolling between input and mirror
  const handleScroll = () => {
    if (inputRef.current && mirrorRef.current) {
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
    // Dismiss hover tooltip on scroll to prevent detached overlays
    if (hoveredVar) {
      setHoveredVar(null);
    }
  };

  // Filter available variables for autocomplete
  const varList = useMemo(() => Object.entries(availableVars || {}), [availableVars]);
  const filteredList = useMemo(() => {
    return varList.filter(([key]) =>
      key.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [varList, filterQuery]);

  // Keep selectedIndex within valid bounds whenever filteredList changes
  useEffect(() => {
    if (filteredList.length > 0 && selectedIndex >= filteredList.length) {
      setSelectedIndex(filteredList.length - 1);
    }
  }, [filteredList.length, selectedIndex]);

  // Auto-scroll the active candidate element into view inside the dropdown list
  useEffect(() => {
    if (showDropdown && listRef.current) {
      const activeElem = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      if (activeElem && typeof activeElem.scrollIntoView === 'function') {
        activeElem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showDropdown]);

  // Update dropdown portal position based on container bounding client rect
  const updateDropdownPos = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const placeAbove = rect.bottom + 220 > window.innerHeight && rect.top > 220;
      const top = rect.bottom + 6;
      const bottom = window.innerHeight - rect.top + 6;
      const left = Math.max(10, Math.min(rect.left, window.innerWidth - 300));
      const width = Math.max(rect.width, 280);

      setDropdownPos((prev) => {
        if (
          prev.top === top &&
          prev.bottom === bottom &&
          prev.left === left &&
          prev.width === width &&
          prev.placeAbove === placeAbove
        ) {
          return prev;
        }
        return { top, bottom, left, width, placeAbove };
      });
    }
  }, []);

  // Check if dropdown candidates should trigger based on unclosed "{{"
  const checkDropdownTrigger = useCallback((val: string, pos: number) => {
    const textBeforeCursor = val.slice(0, pos);
    const lastOpenIndex = textBeforeCursor.lastIndexOf('{{');
    const lastCloseIndex = textBeforeCursor.lastIndexOf('}}');

    if (lastOpenIndex !== -1 && lastOpenIndex > lastCloseIndex) {
      const query = textBeforeCursor.slice(lastOpenIndex + 2).trim();
      setFilterQuery((prevQuery) => {
        // Only reset selectedIndex when the actual query filter string has changed
        if (prevQuery !== query) {
          setSelectedIndex(0);
        }
        return query;
      });
      setShowDropdown(true);
      updateDropdownPos();
    } else {
      setShowDropdown(false);
    }
  }, [updateDropdownPos]);

  // Handle typing & trigger candidates on "{{"
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    onChange(val);
    checkDropdownTrigger(val, pos);
  };

  const handleInputClickOrSelect = () => {
    if (inputRef.current) {
      const pos = inputRef.current.selectionStart || 0;
      setCursorPos(pos);
      checkDropdownTrigger(strValue, pos);
    }
  };

  const handleSelectVar = (varKey: string) => {
    const text = strValue;
    const currentCursor = inputRef.current?.selectionStart ?? cursorPos;
    const textBeforeCursor = text.slice(0, currentCursor);
    const textAfterCursor = text.slice(currentCursor);
    const lastOpenIndex = textBeforeCursor.lastIndexOf('{{');

    const prefix = lastOpenIndex !== -1 ? textBeforeCursor.slice(0, lastOpenIndex) : textBeforeCursor;
    const closeIndexInSuffix = textAfterCursor.indexOf('}}');
    const nextOpenInSuffix = textAfterCursor.indexOf('{{');
    let cleanSuffix = textAfterCursor;
    if (closeIndexInSuffix !== -1 && (nextOpenInSuffix === -1 || closeIndexInSuffix < nextOpenInSuffix)) {
      cleanSuffix = textAfterCursor.slice(closeIndexInSuffix + 2);
    }

    const newVal = `${prefix}{{${varKey}}}${cleanSuffix}`;
    onChange(newVal);
    setShowDropdown(false);

    setTimeout(() => {
      if (inputRef.current) {
        const nextPos = prefix.length + varKey.length + 4;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  // Keyboard navigation inside dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredList.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filteredList.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredList.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + filteredList.length) % filteredList.length);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredList.length > 0 && filteredList[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          handleSelectVar(filteredList[selectedIndex][0]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowDropdown(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Prevent navigation & functional keys from disrupting dropdown selection on keyup
  const handleInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'Enter',
        'Tab',
        'Escape',
        'Shift',
        'Control',
        'Alt',
        'Meta',
      ].includes(e.key)
    ) {
      return;
    }
    handleInputClickOrSelect();
  };

  // Hover management for variable placeholder pills
  const handleTokenMouseEnter = (e: React.MouseEvent<HTMLSpanElement>, varKey: string) => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const item = availableVars[varKey];
    setHoveredVar({ key: varKey, item, rect });
  };

  const handleTokenMouseLeave = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoveredVar(null);
    }, 180);
  };

  const handleHoverCardMouseEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const handleHoverCardMouseLeave = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoveredVar(null);
    }, 150);
  };

  const handleCopyValue = (val: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(val);
    setCopiedValue(true);
    setTimeout(() => setCopiedValue(false), 1500);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update positions and dismiss tooltips on scroll or window resize
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (showDropdown) {
        updateDropdownPos();
      }
      setHoveredVar(null);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showDropdown, updateDropdownPos]);

  return (
    <div ref={containerRef} className="relative w-full flex items-center group">
      {/* Background/Foreground Highlight Mirror
          - Container has pointer-events-none so mouse passes straight to <input> for normal text
          - Variable badges have pointer-events-auto & z-20 so user can hover to inspect value or click to position cursor */}
      {hasVariables && (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute inset-0 z-20 pointer-events-none px-2 py-1 font-mono text-xs leading-5 whitespace-pre overflow-x-hidden select-none"
        >
          {tokenParts.map((part, i) => {
            if (part.isVar && part.key) {
              const item = availableVars[part.key];
              const isDefined = Boolean(item);
              return (
                <span
                  key={i}
                  onMouseEnter={(e) => handleTokenMouseEnter(e, part.key!)}
                  onMouseLeave={handleTokenMouseLeave}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inputRef.current) {
                      inputRef.current.focus();
                      inputRef.current.setSelectionRange(part.startIndex, part.endIndex);
                    }
                  }}
                  className={`inline rounded-sm font-semibold text-xs leading-5 ring-1 transition pointer-events-auto cursor-pointer ${
                    isDefined
                      ? 'bg-accent/20 text-accent ring-accent/60 hover:bg-accent/30'
                      : 'bg-rose-500/20 text-rose-300 ring-rose-500/60 hover:bg-rose-500/30'
                  }`}
                  title={isDefined ? `当前变量: {{${part.key}}} (点击聚焦并选中)` : `变量 {{${part.key}}} 未定义 (点击聚焦并选中)`}
                >
                  {part.text}
                </span>
              );
            }
            return (
              <span key={i} className="text-gray-200">
                {part.text}
              </span>
            );
          })}
        </div>
      )}

      {/* Actual Input: when no variables are present, renders crisp text directly with zero ghosting */}
      <input
        ref={inputRef}
        type={type}
        value={strValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onPaste={onPaste}
        onScroll={handleScroll}
        onClick={handleInputClickOrSelect}
        onKeyUp={handleInputKeyUp}
        onFocus={() => {
          setIsFocused(true);
          checkDropdownTrigger(strValue, inputRef.current?.selectionStart || 0);
        }}
        onBlur={() => {
          setIsFocused(false);
          // slight delay so click on dropdown works
          setTimeout(() => setShowDropdown(false), 200);
        }}
        placeholder={placeholder}
        className={`w-full font-mono text-xs leading-5 px-2 py-1 bg-transparent caret-foreground selection:bg-accent/40 relative z-10 focus:outline-none ${className} ${
          hasVariables ? 'text-transparent' : 'text-gray-200'
        }`}
      />

      {/* Autocomplete Candidate Dropdown (Rendered via createPortal to prevent table/card overflow clipping) */}
      {showDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            onMouseDown={(e) => {
              // Prevent input from blurring when interacting with dropdown or its scrollbar
              e.preventDefault();
            }}
            style={{
              position: 'fixed',
              top: dropdownPos.placeAbove ? undefined : `${dropdownPos.top}px`,
              bottom: dropdownPos.placeAbove ? `${dropdownPos.bottom}px` : undefined,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              zIndex: 99999,
            }}
            className="bg-surface/95 backdrop-blur-md border border-line rounded-xl shadow-2xl py-1.5 text-xs select-none"
          >
            <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold border-b border-line flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-200">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>环境变量候选</span>
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                &#123;&#123;{filterQuery}&#125;&#125;
              </span>
            </div>

            {filteredList.length > 0 ? (
              <div ref={listRef} className="max-h-52 overflow-y-auto divide-y divide-line/60">
                {filteredList.map(([key, item], idx) => (
                  <button
                    key={key}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectVar(key);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between group transition-colors duration-75 cursor-pointer ${
                      idx === selectedIndex
                        ? 'bg-accent/20 text-foreground font-medium'
                        : 'hover:bg-hover/60 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <span className="font-mono text-amber-300 font-bold shrink-0">
                        &#123;&#123;{key}&#125;&#125;
                      </span>
                      <span className="text-gray-400 truncate text-[11px] max-w-[130px]">
                        = {item.value || '(空)'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0 ${
                        item.source === 'env'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {item.source === 'env' ? '环境变量' : '全局变量'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-gray-500 text-[11px]">
                {varList.length === 0 ? (
                  <span>暂无可用环境变量或全局变量，可在环境管理中添加</span>
                ) : (
                  <span>未匹配到符合 &quot;{filterQuery}&quot; 的变量</span>
                )}
              </div>
            )}

            <div className="px-3 py-1 bg-subtle/50 border-t border-line/60 text-[10px] text-gray-400 flex items-center justify-between">
              <span>↑↓ 导航 · Enter / Tab 选择</span>
              <span>Esc 关闭</span>
            </div>
          </div>,
          document.body
        )}

      {/* Matched Variable Hover Inspection Tooltip (Postman Style) */}
      {hoveredVar &&
        createPortal(
          <div
            ref={hoverCardRef}
            onMouseEnter={handleHoverCardMouseEnter}
            onMouseLeave={handleHoverCardMouseLeave}
            style={{
              position: 'fixed',
              left: `${Math.max(12, Math.min(hoveredVar.rect.left, window.innerWidth - 320))}px`,
              ...(hoveredVar.rect.top > 170
                ? { bottom: `${window.innerHeight - hoveredVar.rect.top + 6}px` }
                : { top: `${hoveredVar.rect.bottom + 6}px` }),
              width: '300px',
              zIndex: 99999,
            }}
            className="bg-surface/95 backdrop-blur-md border border-line rounded-xl shadow-2xl p-3 text-xs animate-in fade-in zoom-in-95 duration-100 select-none pointer-events-auto text-left"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-line mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Variable className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-mono font-bold text-foreground truncate">
                  &#123;&#123;{hoveredVar.key}&#125;&#125;
                </span>
              </div>
              {hoveredVar.item ? (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 uppercase ${
                    hoveredVar.item.source === 'env'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  }`}
                >
                  {hoveredVar.item.source === 'env' ? '环境变量' : '全局变量'}
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  未定义变量
                </span>
              )}
            </div>

            {/* Body */}
            {hoveredVar.item ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>当前变量值 (Current Value)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyValue(hoveredVar.item?.value || '')}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-accent transition cursor-pointer"
                    title="复制变量值到剪贴板"
                  >
                    {copiedValue ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-canvas/80 border border-line rounded-lg p-2 font-mono text-[11px] text-gray-200 break-all select-text max-h-32 overflow-y-auto leading-relaxed">
                  {hoveredVar.item.value ? (
                    hoveredVar.item.value
                  ) : (
                    <span className="text-gray-500 italic select-none">(空字符串)</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-start gap-1.5 text-rose-300/90 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    该变量在当前环境和全局变量中未定义。发起请求时将无法解析，请检查拼写或在右上角「环境变量」中添加。
                  </span>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
