import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plug,
  Unplug,
  Send,
  Save,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowDownToLine,
  Zap,
  Share2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Radio,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { ApiDetail, KeyValueItem, WebSocketConfig } from '../../../common/types';
import { VariableItem, VariableInput } from './VariableInput';
import { KeyValueTable } from './KeyValueTable';
import { Tooltip } from './Tooltip';
import { useFeedback } from './FeedbackContext';

export interface WsMessageItem {
  id: string;
  seq?: number;
  direction: 'send' | 'receive' | 'system';
  data: string;
  timestamp: number;
  timeStr: string;
  size: number;
  isJson: boolean;
  systemType?: 'connect' | 'disconnect' | 'error' | 'info';
}

interface WebSocketWorkbenchProps {
  api: ApiDetail;
  availableVars?: Record<string, VariableItem>;
  onChange: (updated: ApiDetail) => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onOpenShare?: () => void;
  isDirty?: boolean;
  preUrl?: string;
  envVars?: Record<string, string>;
  globalVars?: Record<string, string>;
}

export const WebSocketWorkbench: React.FC<WebSocketWorkbenchProps> = ({
  api,
  availableVars = {},
  onChange,
  onSave,
  onSaveAs,
  onOpenShare,
  isDirty = false,
  preUrl = '',
  envVars = {},
  globalVars = {},
}) => {
  const { toast } = useFeedback();

  // Connection State
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<WsMessageItem[]>([]);
  const [bufferLimit, setBufferLimit] = useState<number>(500); // Max retained messages (FIFO eviction to prevent memory explosion)
  const [cumulativeStats, setCumulativeStats] = useState({ sent: 0, recv: 0, total: 0 });
  const [connectedTime, setConnectedTime] = useState<number | null>(null);
  const [elapsedDuration, setElapsedDuration] = useState('00:00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Protocols & Heartbeat configuration (persisted to api.websocket)
  const [protocolsInput, setProtocolsInput] = useState<string>(api.websocket?.protocols || '');
  const [heartbeatEnabled, setHeartbeatEnabled] = useState<boolean>(api.websocket?.heartbeat?.enabled ?? false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<number>(api.websocket?.heartbeat?.interval ?? 30);
  const [heartbeatMsg, setHeartbeatMsg] = useState<string>(api.websocket?.heartbeat?.message ?? 'ping');

  // Draft Message State (persisted to api.websocket)
  const [inputMessage, setInputMessage] = useState<string>(
    api.websocket?.messageDraft ?? '{\n  "action": "ping"\n}'
  );
  const [messageMode, setMessageMode] = useState<'json' | 'text'>(api.websocket?.messageMode ?? 'json');

  // Synchronize state when switching APIs
  useEffect(() => {
    setProtocolsInput(api.websocket?.protocols || '');
    setHeartbeatEnabled(api.websocket?.heartbeat?.enabled ?? false);
    setHeartbeatInterval(api.websocket?.heartbeat?.interval ?? 30);
    setHeartbeatMsg(api.websocket?.heartbeat?.message ?? 'ping');
    if (api.websocket?.messageDraft !== undefined) {
      setInputMessage(api.websocket.messageDraft);
    }
    if (api.websocket?.messageMode) {
      setMessageMode(api.websocket.messageMode);
    }
  }, [api.target_id]);

  // Helper to persist websocket config to api
  const updateWsConfig = (updates: Partial<WebSocketConfig>) => {
    const nextWs: WebSocketConfig = {
      protocols: protocolsInput,
      heartbeat: {
        enabled: heartbeatEnabled,
        interval: heartbeatInterval,
        message: heartbeatMsg,
      },
      messageDraft: inputMessage,
      messageMode,
      ...updates,
    };
    onChange({
      ...api,
      websocket: nextWs,
    });
  };

  const handleProtocolsChange = (val: string) => {
    setProtocolsInput(val);
    updateWsConfig({ protocols: val });
  };

  const handleHeartbeatToggle = (checked: boolean) => {
    setHeartbeatEnabled(checked);
    updateWsConfig({
      heartbeat: {
        enabled: checked,
        interval: heartbeatInterval,
        message: heartbeatMsg,
      },
    });
  };

  const handleHeartbeatIntervalChange = (val: number) => {
    setHeartbeatInterval(val);
    updateWsConfig({
      heartbeat: {
        enabled: heartbeatEnabled,
        interval: val,
        message: heartbeatMsg,
      },
    });
  };

  const handleHeartbeatMsgChange = (val: string) => {
    setHeartbeatMsg(val);
    updateWsConfig({
      heartbeat: {
        enabled: heartbeatEnabled,
        interval: heartbeatInterval,
        message: val,
      },
    });
  };

  const handleInputMessageChange = (val: string) => {
    setInputMessage(val);
    updateWsConfig({ messageDraft: val });
  };

  const handleMessageModeChange = (mode: 'json' | 'text') => {
    setMessageMode(mode);
    updateWsConfig({ messageMode: mode });
  };

  const handleSave = () => {
    updateWsConfig({
      protocols: protocolsInput,
      heartbeat: {
        enabled: heartbeatEnabled,
        interval: heartbeatInterval,
        message: heartbeatMsg,
      },
      messageDraft: inputMessage,
      messageMode,
    });
    onSave();
  };

  // UI & Filters
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'protocols' | 'heartbeat'>('params');
  const [filterText, setFilterText] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'send' | 'receive' | 'system'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Response Timeline Visibility State (Toggled via single icon + tooltip button)
  const [showTimeline, setShowTimeline] = useState<boolean>(true);

  // Left Panel Vertical Split Resizer State (handshake config vs composer)
  const [configHeightPercent, setConfigHeightPercent] = useState<number>(45);
  const [isDraggingV, setIsDraggingV] = useState<boolean>(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDraggingV) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!leftPanelRef.current) return;
      const rect = leftPanelRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalH = rect.height;
      if (totalH > 0) {
        const minTopPercent = Math.max((110 / totalH) * 100, 15);
        const maxTopPercent = Math.min(((totalH - 120 - 6) / totalH) * 100, 85);
        if (maxTopPercent >= minTopPercent) {
          const percent = Math.min(Math.max((relativeY / totalH) * 100, minTopPercent), maxTopPercent);
          setConfigHeightPercent(percent);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingV(false);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingV]);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const heartbeatTimerRef = useRef<any>(null);

  // Performance & Capacity Refs
  const msgSeqRef = useRef<number>(0);
  const incomingQueueRef = useRef<WsMessageItem[]>([]);
  const rafIdRef = useRef<number | null>(null);

  // Trim messages when bufferLimit changes
  useEffect(() => {
    if (bufferLimit > 0) {
      setMessages((prev) => (prev.length > bufferLimit ? prev.slice(prev.length - bufferLimit) : prev));
    }
  }, [bufferLimit]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Auto scroll
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Elapsed duration timer
  useEffect(() => {
    if (status === 'connected' && connectedTime) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - connectedTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        setElapsedDuration(`${mins}:${secs}`);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, connectedTime]);

  // Heartbeat loop
  useEffect(() => {
    if (status === 'connected' && heartbeatEnabled && heartbeatInterval > 0) {
      heartbeatTimerRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(heartbeatMsg);
            appendMessage('send', heartbeatMsg);
          } catch (e) {
            console.error('Heartbeat send failed:', e);
          }
        }
      }, heartbeatInterval * 1000);
    } else {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    }
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [status, heartbeatEnabled, heartbeatInterval, heartbeatMsg]);

  // Clean up on unmount or api change
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [api.target_id]);

  const wsPreUrl = useMemo(() => {
    if (!preUrl) return '';
    let base = preUrl.trim().replace(/\/+$/, '');
    if (base.startsWith('http://')) return 'ws://' + base.slice(7);
    if (base.startsWith('https://')) return 'wss://' + base.slice(8);
    if (!base.startsWith('ws://') && !base.startsWith('wss://')) return 'ws://' + base;
    return base;
  }, [preUrl]);

  const resolveWsUrl = (rawUrl: string): string => {
    let finalUrl = (rawUrl || '').trim();
    if (!finalUrl) return '';

    const allVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(availableVars || {})) {
      allVars[k] = v.value;
    }
    for (const [k, v] of Object.entries(globalVars || {})) {
      allVars[k] = v;
    }
    for (const [k, v] of Object.entries(envVars || {})) {
      allVars[k] = v;
    }
    finalUrl = finalUrl.replace(/\{\{([^{}]+)\}\}/g, (_, key) => allVars[key.trim()] || `{{${key}}}`);

    if (finalUrl.startsWith('ws://') || finalUrl.startsWith('wss://')) {
      return finalUrl;
    }
    if (finalUrl.startsWith('http://')) {
      return 'ws://' + finalUrl.slice(7);
    }
    if (finalUrl.startsWith('https://')) {
      return 'wss://' + finalUrl.slice(8);
    }
    if (wsPreUrl) {
      return `${wsPreUrl}/${finalUrl.replace(/^\/+/, '')}`;
    }
    return 'ws://' + finalUrl.replace(/^\/+/, '');
  };

  // Flush queued incoming messages into React state in a bounded batch
  const flushIncomingQueue = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (incomingQueueRef.current.length === 0) return;

    const batch = incomingQueueRef.current;
    incomingQueueRef.current = [];

    setMessages((prev) => {
      const merged = [...prev, ...batch];
      if (bufferLimit > 0 && merged.length > bufferLimit) {
        return merged.slice(merged.length - bufferLimit);
      }
      return merged;
    });
  };

  const appendMessage = (
    direction: 'send' | 'receive' | 'system',
    data: string,
    systemType?: 'connect' | 'disconnect' | 'error' | 'info'
  ) => {
    let isJson = false;
    try {
      JSON.parse(data);
      isJson = true;
    } catch {
      isJson = false;
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    let seq: number | undefined = undefined;
    if (direction !== 'system') {
      msgSeqRef.current += 1;
      seq = msgSeqRef.current;
      setCumulativeStats((prev) => ({
        sent: direction === 'send' ? prev.sent + 1 : prev.sent,
        recv: direction === 'receive' ? prev.recv + 1 : prev.recv,
        total: prev.total + 1,
      }));
    }

    const msg: WsMessageItem = {
      id: `ws-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      seq,
      direction,
      data,
      timestamp: Date.now(),
      timeStr,
      size: new TextEncoder().encode(data).length,
      isJson,
      systemType,
    };

    if (direction === 'send') {
      // Immediate flush for user-initiated sends
      flushIncomingQueue();
      setMessages((prev) => {
        const merged = [...prev, msg];
        if (bufferLimit > 0 && merged.length > bufferLimit) {
          return merged.slice(merged.length - bufferLimit);
        }
        return merged;
      });
    } else {
      // High-throughput incoming & system notices: batched via RAF
      incomingQueueRef.current.push(msg);
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(flushIncomingQueue);
      }
    }
  };

  const handleConnect = () => {
    if (status === 'connected' || status === 'connecting') {
      if (wsRef.current) {
        wsRef.current.close(1000, 'User clicked disconnect');
        wsRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    setErrorMessage(null);
    let resolved = resolveWsUrl(api.url);
    if (!resolved || (!resolved.startsWith('ws://') && !resolved.startsWith('wss://'))) {
      toast.error('请输入有效的 WebSocket 地址 (ws:// 或 wss://)');
      return;
    }

    try {
      const urlObj = new URL(resolved);
      const queryParams = api.request?.query?.parameter || [];
      for (const p of queryParams) {
        if (p.is_checked === 1 && p.key) {
          urlObj.searchParams.append(p.key, p.value || '');
        }
      }
      resolved = urlObj.toString();
    } catch {
      // If URL parsing fails, keep resolved string
    }

    setStatus('connecting');
    appendMessage('system', `正在尝试连接至 ${resolved}...`, 'info');

    try {
      const protocols = protocolsInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const ws = protocols.length > 0 ? new WebSocket(resolved, protocols) : new WebSocket(resolved);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setConnectedTime(Date.now());
        appendMessage('system', `WebSocket 连接建立成功: ${resolved}`, 'connect');
        toast.success('WebSocket 已连接');
      };

      ws.onmessage = (event) => {
        const text = typeof event.data === 'string' ? event.data : String(event.data);
        appendMessage('receive', text);
      };

      ws.onerror = (err) => {
        setStatus('error');
        setErrorMessage('连接出现异常');
        appendMessage('system', 'WebSocket 连接发生错误', 'error');
        toast.error('WebSocket 连接异常');
      };

      ws.onclose = (event) => {
        setStatus('disconnected');
        appendMessage(
          'system',
          `WebSocket 连接已关闭 (代码: ${event.code}${event.reason ? `, 原因: ${event.reason}` : ''})`,
          'disconnect'
        );
        wsRef.current = null;
      };
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || '连接失败');
      appendMessage('system', `初始化连接失败: ${err.message || err}`, 'error');
      toast.error(`连接失败: ${err.message || err}`);
    }
  };

  const handleSendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('当前 WebSocket 未连接，无法发送消息');
      return;
    }
    if (!inputMessage.trim()) {
      toast.error('发送内容不能为空');
      return;
    }

    try {
      wsRef.current.send(inputMessage);
      appendMessage('send', inputMessage);
    } catch (err: any) {
      toast.error(`发送失败: ${err.message || err}`);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(inputMessage);
      setInputMessage(JSON.stringify(parsed, null, 2));
      toast.success('JSON 已美化');
    } catch {
      toast.error('当前内容不是有效的 JSON 格式');
    }
  };

  const handleClearMessages = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    incomingQueueRef.current = [];
    setMessages([]);
    setCumulativeStats({ sent: 0, recv: 0, total: 0 });
    msgSeqRef.current = 0;
    toast.success('已清空所有消息与统计');
  };

  const handleCopyMessage = (msg: WsMessageItem) => {
    navigator.clipboard.writeText(msg.data);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
    toast.success('已复制消息');
  };

  const handleExportMessages = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      url: api.url,
      stats: {
        retainedCount: messages.length,
        cumulativeSent: cumulativeStats.sent,
        cumulativeRecv: cumulativeStats.recv,
        cumulativeTotal: cumulativeStats.total,
      },
      messages,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `websocket-messages-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出消息记录');
  };

  // Metrics (Data stream only: send and receive)
  const sentCount = useMemo(() => messages.filter((m) => m.direction === 'send').length, [messages]);
  const recvCount = useMemo(() => messages.filter((m) => m.direction === 'receive').length, [messages]);
  const totalDataCount = sentCount + recvCount;
  const systemCount = useMemo(() => messages.filter((m) => m.direction === 'system').length, [messages]);
  const isTrimmed = cumulativeStats.total > totalDataCount;

  // Chronological frame numbering map fallback (starts at #1)
  const dataMessageIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;
    for (const m of messages) {
      if (m.direction !== 'system') {
        count++;
        map.set(m.id, count);
      }
    }
    return map;
  }, [messages]);

  // Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (directionFilter !== 'all' && m.direction !== directionFilter) {
        return false;
      }
      if (!filterText.trim()) return true;
      return m.data.toLowerCase().includes(filterText.toLowerCase());
    });
  }, [messages, directionFilter, filterText]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas select-none">
      {/* Top Bar: Name & Actions */}
      <div className="h-11 px-4 border-b border-line flex items-center justify-between bg-subtle shrink-0">
        <div className="flex items-center gap-3 w-1/2">
          <input
            type="text"
            value={api.name || ''}
            onChange={(e) => onChange({ ...api, name: e.target.value })}
            placeholder="WebSocket 接口名称"
            className="bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500 px-2 py-0.5 rounded flex-1"
          />
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="h-12 border-b border-line bg-subtle/50 px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Protocol Badge */}
          <div className="h-8 px-3 rounded bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold flex items-center gap-1 shrink-0">
            <Radio className="w-3.5 h-3.5" />
            <span>WS</span>
          </div>

          {/* URL Input */}
          <div className="flex-1 min-w-0 flex items-center bg-subtle border border-line rounded px-2.5 focus-within:border-teal-500 transition shadow-inner">
            <Zap className="w-3.5 h-3.5 text-teal-400 mr-2 shrink-0" />
            {wsPreUrl && (
              <span className="text-gray-500 text-xs font-mono select-none mr-1.5 shrink-0">
                {wsPreUrl}
              </span>
            )}
            <VariableInput
              value={api.url || ''}
              onChange={(newUrl) => onChange({ ...api, url: newUrl })}
              availableVars={availableVars}
              placeholder="/ws 或 wss://echo.websocket.events"
              className="w-full h-8 bg-transparent text-xs text-foreground placeholder-gray-500 font-mono focus:outline-none"
            />
          </div>

          {/* Connect / Disconnect Button */}
          <button
            type="button"
            onClick={handleConnect}
            className={`h-8 px-4 rounded font-medium text-xs flex items-center gap-1.5 transition shadow-sm shrink-0 ${
              status === 'connected' || status === 'connecting'
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
          >
            {status === 'connecting' ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>连接中...</span>
              </>
            ) : status === 'connected' ? (
              <>
                <Unplug className="w-3.5 h-3.5" />
                <span>断开连接</span>
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5" />
                <span>连接</span>
              </>
            )}
          </button>

          {/* Save Button (Icon + Tooltip) */}
          <Tooltip content="保存">
            <button
              type="button"
              onClick={handleSave}
              className="h-8 px-2.5 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-200 hover:text-white flex items-center gap-1.5 transition shrink-0"
            >
              <Save className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">保存</span>
            </button>
          </Tooltip>

          {/* Share Button (Icon + Tooltip) */}
          {onOpenShare && (
            <Tooltip content="分享">
              <button
                type="button"
                onClick={onOpenShare}
                className="h-8 px-2 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-teal-400 flex items-center justify-center transition shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}

          {/* Toggle Response Message Stream (Icon + Tooltip) */}
          <Tooltip content={showTimeline ? "隐藏消息流" : "展示消息流"}>
            <button
              type="button"
              onClick={() => setShowTimeline(!showTimeline)}
              className={`h-8 px-2.5 rounded border text-xs flex items-center justify-center transition shrink-0 ${
                showTimeline
                  ? 'bg-subtle hover:bg-hover border-line text-gray-300 hover:text-teal-400'
                  : 'bg-teal-500/15 border-teal-500/30 text-teal-400 hover:bg-teal-500/25'
              }`}
            >
              {showTimeline ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
            </button>
          </Tooltip>
        </div>

        {/* Status indicator & stats */}
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle border border-line">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : status === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : status === 'error'
                  ? 'bg-rose-500'
                  : 'bg-gray-500'
              }`}
            />
            <span className="text-[11px] font-medium text-gray-300">
              {status === 'connected'
                ? `已连接 (${elapsedDuration})`
                : status === 'connecting'
                ? '连接中'
                : status === 'error'
                ? '连接失败'
                : '未连接'}
            </span>
          </div>

          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
            <span className="text-emerald-400">↑ {sentCount}</span>
            <span className="text-sky-400">↓ {recvCount}</span>
          </div>
        </div>
      </div>

      {/* Main Split Body: Left Handshake Config & Message Composer, Right Live Feed */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Panel: Handshake Config & Message Sender (Auto fills 100% width when timeline is hidden) */}
        <div
          ref={leftPanelRef}
          className={`flex flex-col min-h-0 bg-sidebar overflow-hidden transition-all duration-200 relative ${
            showTimeline
              ? 'w-[480px] min-w-[340px] max-w-[50%] border-r border-line shrink-0'
              : 'flex-1 w-full'
          } ${isDraggingV ? 'select-none' : ''}`}
        >
          {/* Top Block: Handshake Configuration (resizable height) */}
          <div
            style={{ height: `${configHeightPercent}%` }}
            className="flex flex-col min-h-[110px] shrink-0 overflow-hidden"
          >
            {/* Config Tabs Header */}
            <div className="flex items-center border-b border-line px-3 bg-subtle/30 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('params')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'params'
                    ? 'border-teal-400 text-teal-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Params {api.request?.query?.parameter?.length ? `(${api.request.query.parameter.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('headers')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'headers'
                    ? 'border-teal-400 text-teal-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Headers {api.request?.header?.parameter?.length ? `(${api.request.header.parameter.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('protocols')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'protocols'
                    ? 'border-teal-400 text-teal-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Protocols
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('heartbeat')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                  activeTab === 'heartbeat'
                    ? 'border-teal-400 text-teal-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                心跳保活 {heartbeatEnabled ? '🟢' : ''}
              </button>
            </div>

            {/* Config Tab Body */}
            <div className="flex-1 p-2 overflow-y-auto">
              {activeTab === 'params' && (
                <KeyValueTable
                  items={api.request?.query?.parameter || []}
                  onChange={(items) =>
                    onChange({
                      ...api,
                      request: {
                        ...api.request,
                        query: { ...api.request?.query, parameter: items },
                      },
                    })
                  }
                  keyPlaceholder="参数名 (Key)"
                  valuePlaceholder="参数值 (Value)"
                  availableVars={availableVars}
                />
              )}

              {activeTab === 'headers' && (
                <KeyValueTable
                  items={api.request?.header?.parameter || []}
                  onChange={(items) =>
                    onChange({
                      ...api,
                      request: {
                        ...api.request,
                        header: { ...api.request?.header, parameter: items },
                      },
                    })
                  }
                  keyPlaceholder="请求头 (Header)"
                  valuePlaceholder="值 (Value)"
                  availableVars={availableVars}
                />
              )}

              {activeTab === 'protocols' && (
                <div className="space-y-2 p-2">
                  <span className="text-xs text-gray-400">
                    Sec-WebSocket-Protocol 子协议列表（多个子协议请用英文逗号分隔）：
                  </span>
                  <input
                    type="text"
                    value={protocolsInput}
                    onChange={(e) => handleProtocolsChange(e.target.value)}
                    placeholder="graphql-transport-ws, v1.proto"
                    className="w-full bg-subtle border border-line rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              )}

              {activeTab === 'heartbeat' && (
                <div className="space-y-3 p-2 text-xs bg-canvas/30 rounded border border-line/40">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={heartbeatEnabled}
                      onChange={(e) => handleHeartbeatToggle(e.target.checked)}
                      className="rounded border-line text-teal-500 focus:ring-0"
                    />
                    <span className="text-gray-200 font-medium">启用定时心跳保活包 (Heartbeat Ping)</span>
                  </label>

                  {heartbeatEnabled && (
                        <div className="space-y-2.5 pl-6 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-24 shrink-0">发送间隔 (秒):</span>
                            <input
                              type="number"
                              min="1"
                              max="3600"
                              value={heartbeatInterval}
                              onChange={(e) => handleHeartbeatIntervalChange(Number(e.target.value) || 1)}
                              className="w-24 bg-subtle border border-line rounded px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-24 shrink-0">心跳载荷:</span>
                            <input
                              type="text"
                              value={heartbeatMsg}
                              onChange={(e) => handleHeartbeatMsgChange(e.target.value)}
                              placeholder="ping 或 {type: 'ping'}"
                              className="flex-1 bg-subtle border border-line rounded px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-teal-500 font-mono"
                            />
                          </div>
                          <div className="text-[11px] text-teal-400/80 bg-teal-500/10 border border-teal-500/20 rounded p-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>心跳保活配置会自动保存，连接成功后将按指定周期定时发送。</span>
                          </div>
                        </div>
                      )}
                </div>
              )}
            </div>
          </div>

          {/* Vertical Drag Resizer Bar between Config and Message Composer */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingV(true);
            }}
            onDoubleClick={() => setConfigHeightPercent(45)}
            className={`h-1.5 hover:h-2 bg-subtle hover:bg-teal-500/40 border-y border-line cursor-row-resize transition-all flex items-center justify-center select-none group z-10 shrink-0 ${
              isDraggingV ? 'bg-teal-500/50 h-2' : ''
            }`}
            title="上下拖动调整握手配置与消息发送区域高度 (双击恢复默认 45%)"
          >
            <div className="w-8 h-1 rounded-full bg-gray-400/40 group-hover:bg-teal-400 transition" />
          </div>

          {/* Bottom Block: Message Composer Section (resizable height) */}
          <div
            style={{ height: `calc(${100 - configHeightPercent}% - 6px)` }}
            className="flex-1 flex flex-col min-h-[120px] p-3 bg-canvas/30 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">发送消息</span>

                {/* Mode Select Dropdown (Themed styled with proper text & background) */}
                <div className="relative shrink-0 flex items-center">
                  <select
                    value={messageMode}
                    onChange={(e) => handleMessageModeChange(e.target.value as 'json' | 'text')}
                    className="appearance-none bg-subtle hover:bg-hover border border-line text-foreground font-mono text-xs font-semibold pl-2.5 pr-6 py-1 rounded cursor-pointer focus:outline-none focus:border-teal-500 transition shadow-sm"
                    title="选择消息格式"
                  >
                    <option value="json" className="bg-surface text-foreground font-mono font-medium">
                      JSON
                    </option>
                    <option value="text" className="bg-surface text-foreground font-mono font-medium">
                      Text
                    </option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
                </div>

                {/* Format JSON Button */}
                {messageMode === 'json' && (
                  <Tooltip content="美化格式">
                    <button
                      type="button"
                      onClick={handleFormatJson}
                      className="p-1 hover:bg-hover rounded text-amber-400 hover:text-amber-300 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            <textarea
              value={inputMessage}
              onChange={(e) => handleInputMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="输入要发送的 WebSocket 文本或 JSON 内容... (支持 Ctrl+Enter 快捷发送)"
              className="flex-1 w-full bg-subtle border border-line rounded-lg p-2.5 text-xs font-mono text-foreground placeholder-gray-500 focus:outline-none focus:border-teal-500 resize-none leading-relaxed shadow-inner"
            />

            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[11px] text-gray-500 font-mono">
                快捷键: <kbd className="px-1 py-0.5 bg-subtle rounded border border-line text-[10px]">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-subtle rounded border border-line text-[10px]">Enter</kbd>
              </span>

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={status !== 'connected'}
                className="h-8 px-4 rounded-md bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>发送消息</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Live WebSocket Message Timeline */}
        {showTimeline && (
          <div className="flex-1 flex flex-col min-h-0 bg-canvas overflow-hidden min-w-[280px]">
            {/* Stream Toolbar */}
            <div className="h-10 border-b border-line px-3 flex items-center justify-between gap-2 bg-subtle/30 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative w-40 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-2.5" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="搜索消息内容..."
                    className="w-full bg-subtle border border-line rounded pl-7 pr-2 py-1 text-xs text-foreground placeholder-gray-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Direction Filter Dropdown */}
                <div className="relative shrink-0 flex items-center">
                  <select
                    value={directionFilter}
                    onChange={(e) => setDirectionFilter(e.target.value as any)}
                    className="appearance-none bg-subtle hover:bg-hover border border-line text-foreground text-xs pl-2.5 pr-6 py-1 rounded cursor-pointer focus:outline-none focus:border-teal-500 transition shadow-sm"
                    title="筛选消息方向"
                  >
                    <option value="all" className="bg-surface text-foreground">
                      全部消息 ({isTrimmed ? `${totalDataCount} / 累计 ${cumulativeStats.total}` : totalDataCount})
                    </option>
                    <option value="send" className="bg-surface text-foreground">
                      仅发送 ({isTrimmed ? `${sentCount} / 累计 ${cumulativeStats.sent}` : sentCount})
                    </option>
                    <option value="receive" className="bg-surface text-foreground">
                      仅接收 ({isTrimmed ? `${recvCount} / 累计 ${cumulativeStats.recv}` : recvCount})
                    </option>
                    {systemCount > 0 && (
                      <option value="system" className="bg-surface text-foreground">系统日志 ({systemCount})</option>
                    )}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
                </div>

                {/* Buffer Capacity Limit Dropdown */}
                <div className="relative shrink-0 flex items-center">
                  <select
                    value={bufferLimit}
                    onChange={(e) => setBufferLimit(Number(e.target.value))}
                    className="appearance-none bg-subtle hover:bg-hover border border-line text-foreground text-xs pl-2.5 pr-6 py-1 rounded cursor-pointer focus:outline-none focus:border-teal-500 transition shadow-sm font-mono"
                    title="消息缓冲区上限 (自动修剪最早的历史消息，防止长期连接导致页面卡顿)"
                  >
                    <option value={200} className="bg-surface text-foreground">上限: 200 条</option>
                    <option value={500} className="bg-surface text-foreground">上限: 500 条 (推荐)</option>
                    <option value={1000} className="bg-surface text-foreground">上限: 1000 条</option>
                    <option value={2000} className="bg-surface text-foreground">上限: 2000 条</option>
                    <option value={0} className="bg-surface text-foreground">无限制 (可能卡顿)</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
                </div>

                {/* Trimmed Badge */}
                {isTrimmed && (
                  <Tooltip content={`已累计传输 ${cumulativeStats.total} 条消息。为保障页面流畅，仅保留最新 ${totalDataCount} 条。`}>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono hidden xl:inline-flex items-center gap-1 cursor-help shrink-0">
                      <span>已修剪 {cumulativeStats.total - totalDataCount} 条</span>
                    </span>
                  </Tooltip>
                )}
              </div>

              {/* Action Buttons with Icon + Tooltips */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip content={autoScroll ? "暂停滚动" : "自动滚动"}>
                  <button
                    type="button"
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`p-1.5 rounded border text-xs flex items-center transition ${
                      autoScroll
                        ? 'bg-teal-500/15 border-teal-500/30 text-teal-400 hover:bg-teal-500/25'
                        : 'bg-subtle border-line text-gray-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>

                <Tooltip content="导出记录">
                  <button
                    type="button"
                    onClick={handleExportMessages}
                    disabled={messages.length === 0}
                    className="p-1.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-white text-xs flex items-center disabled:opacity-40 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>

                <Tooltip content="清空消息">
                  <button
                    type="button"
                    onClick={handleClearMessages}
                    disabled={messages.length === 0}
                    className="p-1.5 rounded bg-subtle hover:bg-rose-500/20 border border-line text-gray-300 hover:text-rose-400 text-xs flex items-center disabled:opacity-40 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Timeline Message Feed */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-12">
                  <Zap className="w-10 h-10 text-gray-600 stroke-1" />
                  <div className="text-xs font-medium text-gray-400">
                    {status === 'connected'
                      ? '已建立 WebSocket 连接，可以在左侧编写并发送消息'
                      : '暂无消息记录，请在顶部输入 ws:// 或 wss:// 地址并点击“连接”'}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    支持实时全双工通信、心跳保活、JSON/Text 消息高亮解析与协议过滤
                  </div>
                </div>
              ) : (
                filteredMessages.map((m, index) => {
                  if (m.direction === 'system') {
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-center gap-2 py-1 text-[11px] text-gray-500 font-mono"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        <span>{m.data}</span>
                        <span className="text-gray-600 text-[10px]">({m.timeStr})</span>
                      </div>
                    );
                  }

                  const isSend = m.direction === 'send';

                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border transition overflow-hidden text-xs ${
                        isSend
                          ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
                          : 'border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10'
                      }`}
                    >
                      {/* Message Header */}
                      <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-line/30 bg-subtle/40">
                        <div className="flex items-center gap-2">
                          {isSend ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1 font-mono">
                              <ArrowUpRight className="w-3 h-3" />
                              <span>发送</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 flex items-center gap-1 font-mono">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>接收</span>
                            </span>
                          )}

                          <span className="text-[11px] text-gray-500 font-mono">
                            #{m.seq ?? dataMessageIndexMap.get(m.id) ?? index + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-gray-500 font-mono">{m.timeStr}</span>
                          <span className="text-[11px] text-gray-500 font-mono">{m.size} B</span>

                          <Tooltip content={copiedId === m.id ? "已复制" : "复制"}>
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m)}
                              className="p-1 hover:bg-hover rounded text-gray-400 hover:text-white transition"
                            >
                              {copiedId === m.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Message Body */}
                      <div className="p-3 bg-canvas/30">
                        <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap break-all leading-relaxed max-h-80 overflow-y-auto">
                          {m.data}
                        </pre>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
