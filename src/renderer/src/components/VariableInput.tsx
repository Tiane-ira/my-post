import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Variable, Check, Sparkles } from 'lucide-react';

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

  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value into normal text and variable tokens
  const tokenParts = useMemo(() => {
    const parts: { isVar: boolean; text: string; key?: string }[] = [];
    let lastIndex = 0;
    const regex = /\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ isVar: false, text: value.slice(lastIndex, match.index) });
      }
      parts.push({
        isVar: true,
        text: match[0],
        key: match[1],
      });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < value.length) {
      parts.push({ isVar: false, text: value.slice(lastIndex) });
    }
    return parts;
  }, [value]);

  const hasVariables = tokenParts.some((p) => p.isVar);

  // Sync horizontal scrolling between input and mirror
  const handleScroll = () => {
    if (inputRef.current && mirrorRef.current) {
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  // Filter available variables for autocomplete
  const varList = useMemo(() => Object.entries(availableVars), [availableVars]);
  const filteredList = useMemo(() => {
    return varList.filter(([key]) =>
      key.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [varList, filterQuery]);

  // Handle typing & trigger candidates on "{{"
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    onChange(val);

    const textBeforeCursor = val.slice(0, pos);
    const lastOpenIndex = textBeforeCursor.lastIndexOf('{{');
    const lastCloseIndex = textBeforeCursor.lastIndexOf('}}');

    if (lastOpenIndex !== -1 && lastOpenIndex > lastCloseIndex) {
      const query = textBeforeCursor.slice(lastOpenIndex + 2).trim();
      setFilterQuery(query);
      setSelectedIndex(0);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelectVar = (varKey: string) => {
    const text = value;
    const textBeforeCursor = text.slice(0, cursorPos);
    const textAfterCursor = text.slice(cursorPos);
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
    if (showDropdown && filteredList.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredList.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredList.length) % filteredList.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredList[selectedIndex]) {
          handleSelectVar(filteredList[selectedIndex][0]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full flex items-center group">
      {/* Background Highlight Mirror (Only rendered when variables need syntax highlighting to avoid text ghosting) */}
      {hasVariables && (
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none px-2 py-1 font-mono text-xs leading-5 whitespace-pre overflow-x-hidden select-none"
        >
          {tokenParts.map((part, i) => {
            if (part.isVar && part.key) {
              const item = availableVars[part.key];
              const isDefined = Boolean(item);
              return (
                <span
                  key={i}
                  className={`inline rounded-sm font-semibold text-xs leading-5 ring-1 transition ${
                    isDefined
                      ? 'bg-accent/20 text-accent ring-accent/60'
                      : 'bg-rose-500/20 text-rose-300 ring-rose-500/60'
                  }`}
                  title={isDefined ? `当前变量值: ${item?.value || '(空)'} (${item?.source === 'env' ? '环境' : '全局'})` : `变量未在当前环境定义`}
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
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onPaste={onPaste}
        onScroll={handleScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          // slight delay so click on dropdown works
          setTimeout(() => setShowDropdown(false), 150);
        }}
        placeholder={placeholder}
        className={`w-full font-mono text-xs leading-5 px-2 py-1 bg-transparent caret-foreground selection:bg-accent/40 relative z-10 focus:outline-none ${className} ${
          hasVariables ? 'text-transparent' : 'text-gray-200'
        }`}
      />


      {/* Autocomplete Candidate Dropdown (Triggered on typing "{{") */}
      {showDropdown && filteredList.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-surface border border-line rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
          <div className="px-3 py-1 text-[10px] text-gray-400 font-semibold border-b border-line flex items-center justify-between">
            <span className="flex items-center gap-1 text-gray-300">
              <Sparkles className="w-3 h-3 text-accent" />
              <span>选择环境变量候选</span>
            </span>
            <span className="text-[10px] text-amber-400 font-mono">&#123;&#123;{filterQuery}&#125;&#125;</span>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-line">
            {filteredList.map(([key, item], idx) => (
              <button
                key={key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectVar(key);
                }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between transition group ${
                  idx === selectedIndex ? 'bg-accent/15 text-foreground' : 'hover:bg-hover text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-amber-300 font-bold">&#123;&#123;{key}&#125;&#125;</span>
                  <span className="text-gray-400 truncate text-[11px] max-w-[110px]">
                    = {item.value || '(空)'}
                  </span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
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
        </div>
      )}
    </div>
  );
};
