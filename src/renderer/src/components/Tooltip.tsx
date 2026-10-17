import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  shortcut?: string;
  delayMs?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  maxWidth?: number | string;
  onlyIfTruncated?: boolean;
  noWrap?: boolean;
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  delayMs = 250,
  placement = 'bottom',
  className = '',
  maxWidth,
  onlyIfTruncated = false,
  noWrap = true,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<any>(null);

  const checkIsTruncated = (): boolean => {
    if (!triggerRef.current) return true;
    const target = (triggerRef.current.firstElementChild as HTMLElement) || triggerRef.current;
    return (
      target.scrollWidth > target.clientWidth + 1 ||
      triggerRef.current.scrollWidth > triggerRef.current.clientWidth + 1
    );
  };

  const handleMouseEnter = () => {
    if (!content) return;
    if (onlyIfTruncated && !checkIsTruncated()) {
      return;
    }
    timeoutRef.current = setTimeout(() => {
      if (onlyIfTruncated && !checkIsTruncated()) {
        return;
      }
      setVisible(true);
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
    setCoords(null);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Adaptive positioning & boundary clamping
  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current || !triggerRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const padding = 8;
    const gap = 6;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let effectivePlacement = placement;

    // 1. Vertical flip check (上下自适应反转)
    if (placement === 'bottom') {
      const wouldOverflowBottom = triggerRect.bottom + tooltipRect.height + gap > viewportHeight - padding;
      const hasRoomTop = triggerRect.top - tooltipRect.height - gap >= padding;
      if (wouldOverflowBottom && hasRoomTop) {
        effectivePlacement = 'top';
      }
    } else if (placement === 'top') {
      const wouldOverflowTop = triggerRect.top - tooltipRect.height - gap < padding;
      const hasRoomBottom = triggerRect.bottom + tooltipRect.height + gap <= viewportHeight - padding;
      if (wouldOverflowTop && hasRoomBottom) {
        effectivePlacement = 'bottom';
      }
    } else if (placement === 'left') {
      const wouldOverflowLeft = triggerRect.left - tooltipRect.width - gap < padding;
      const hasRoomRight = triggerRect.right + tooltipRect.width + gap <= viewportWidth - padding;
      if (wouldOverflowLeft && hasRoomRight) {
        effectivePlacement = 'right';
      }
    } else if (placement === 'right') {
      const wouldOverflowRight = triggerRect.right + tooltipRect.width + gap > viewportWidth - padding;
      const hasRoomLeft = triggerRect.left - tooltipRect.width - gap >= padding;
      if (wouldOverflowRight && hasRoomLeft) {
        effectivePlacement = 'left';
      }
    }

    let top = 0;
    let left = 0;

    if (effectivePlacement === 'top') {
      top = triggerRect.top - tooltipRect.height - gap;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    } else if (effectivePlacement === 'bottom') {
      top = triggerRect.bottom + gap;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    } else if (effectivePlacement === 'left') {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - gap;
    } else if (effectivePlacement === 'right') {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + gap;
    }

    // 2. Horizontal viewport clamping (左右自适应贴边，防止超出视口)
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - padding - tooltipRect.width);
    }

    // 3. Vertical viewport clamping
    if (top < padding) {
      top = padding;
    } else if (top + tooltipRect.height > viewportHeight - padding) {
      top = Math.max(padding, viewportHeight - padding - tooltipRect.height);
    }

    setCoords({ top, left });
  }, [visible, placement, content]);

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              opacity: coords ? 1 : 0,
              zIndex: 9999,
              maxWidth: maxWidth ?? 'none',
            }}
            className={`pointer-events-none px-2 py-1 rounded-md bg-subtle text-gray-200 text-[11px] border border-line shadow-2xl flex items-center gap-1.5 ${
              noWrap ? 'whitespace-nowrap' : 'whitespace-normal'
            } leading-tight transition-opacity duration-100 select-none`}
          >
            <span>{content}</span>
            {shortcut && (
              <kbd className="px-1.5 py-0.5 rounded bg-surface text-[10px] text-gray-400 font-mono border border-line shrink-0">
                {shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
