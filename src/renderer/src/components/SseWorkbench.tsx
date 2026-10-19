import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  Save,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowDownToLine,
  Activity,
  Share2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Download,
  Code2,
  FileText,
  WrapText,
} from 'lucide-react';
import { ApiDetail, HttpMethod, KeyValueItem } from '../../../common/types';
import { VariableItem, VariableInput } from './VariableInput';
import { KeyValueTable } from './KeyValueTable';
import { Tooltip } from './Tooltip';
import { useFeedback } from './FeedbackContext';

export interface SseEventItem {
  id: string;
  seq?: number;
  eventId?: string;
  event: string;
  data: string;
  prettyData?: string;
  timestamp: number;
  timeStr: string;
  size: number;
  raw: string;
  isJson: boolean;
}

/**
 * Format an SSE event into standard wire protocol block format:
 * event: <name>
 * data: <payload>
 * id: <id>
 */
export const formatEventRawBlock = (ev: SseEventItem): string => {
  if (ev.raw && ev.raw.trim()) {
    return ev.raw.trim().replace(/\r\n/g, '\n');
  }
  const lines: string[] = [];
  if (ev.event) {
    lines.push(`event: ${ev.event}`);
  }
  if (ev.data !== undefined) {
    const dLines = ev.data.split(/\r?\n/);
    for (const dl of dLines) {
      lines.push(`data: ${dl}`);
    }
  }
  if (ev.eventId) {
    lines.push(`id: ${ev.eventId}`);
  }
  return lines.join('\n');
};

/**
 * Lightweight JSON syntax colorizer that returns React nodes
 */
const highlightJson = (json: string): React.ReactNode => {
  if (!json) return null;

  const tokenRegex =
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?)|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      elements.push(json.substring(lastIndex, match.index));
    }
    const token = match[0];
    const keyMatch = match[1];
    const boolNullMatch = match[2];
    const numMatch = match[3];
    const punctMatch = match[4];

    if (keyMatch) {
      if (token.endsWith(':')) {
        const colonIdx = token.lastIndexOf(':');
        const keyPart = token.substring(0, colonIdx);
        const colonPart = token.substring(colonIdx);
        elements.push(
          <span key={`k-${match.index}`} className="text-sky-300 font-semibold">
            {keyPart}
          </span>,
          <span key={`c-${match.index}`} className="text-gray-400">
            {colonPart}
          </span>
        );
      } else {
        elements.push(
          <span key={`s-${match.index}`} className="text-emerald-300">
            {token}
          </span>
        );
      }
    } else if (boolNullMatch) {
      if (token === 'null') {
        elements.push(
          <span key={`nl-${match.index}`} className="text-rose-400 font-medium">
            {token}
          </span>
        );
      } else {
        elements.push(
          <span key={`b-${match.index}`} className="text-purple-400 font-medium">
            {token}
          </span>
        );
      }
    } else if (numMatch) {
      elements.push(
        <span key={`n-${match.index}`} className="text-amber-300 font-medium">
          {token}
        </span>
      );
    } else if (punctMatch) {
      elements.push(
        <span key={`p-${match.index}`} className="text-gray-400 font-bold">
          {token}
        </span>
      );
    } else {
      elements.push(token);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < json.length) {
    elements.push(json.substring(lastIndex));
  }

  return elements;
};

/**
 * Render a single line in SSE wire protocol format with keyword highlighting
 */
const renderHighlightedRawLine = (line: string, lineIdx: number): React.ReactNode => {
  if (line.startsWith('event:')) {
    const val = line.slice(6);
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-sky-400 font-semibold">event:</span>
        <span className="text-sky-200">{val}</span>
      </div>
    );
  }
  if (line.startsWith('data:')) {
    const val = line.slice(5);
    const trimmed = val.trim();
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-emerald-400 font-semibold">data:</span>
        {trimmed === '[DONE]' ? (
          <span className="text-amber-400 font-bold ml-1.5 px-1 py-0.2 rounded bg-amber-500/15 border border-amber-500/25 text-[10px]">
            [DONE]
          </span>
        ) : (
          <span className="text-gray-200">{val}</span>
        )}
      </div>
    );
  }
  if (line.startsWith('id:')) {
    const val = line.slice(3);
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-amber-400 font-semibold">id:</span>
        <span className="text-amber-200">{val}</span>
      </div>
    );
  }
  if (line.startsWith('retry:')) {
    const val = line.slice(6);
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-purple-400 font-semibold">retry:</span>
        <span className="text-purple-200">{val}</span>
      </div>
    );
  }
  if (line.startsWith(':')) {
    return (
      <div key={lineIdx} className="leading-5 text-gray-500 italic">
        {line}
      </div>
    );
  }
  return (
    <div key={lineIdx} className="leading-5 text-gray-300">
      {line}
    </div>
  );
};

interface SseWorkbenchProps {
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

export const SseWorkbench: React.FC<SseWorkbenchProps> = ({
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

  // Connection & Stream State
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [events, setEvents] = useState<SseEventItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedTime, setConnectedTime] = useState<number | null>(null);
  const [elapsedDuration, setElapsedDuration] = useState('00:00');
  const [totalBytes, setTotalBytes] = useState(0);
  const [bufferLimit, setBufferLimit] = useState<number>(500); // Max retained events (FIFO eviction to prevent memory explosion)
  const [cumulativeEventsCount, setCumulativeEventsCount] = useState<number>(0);

  // UI state
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
  const [filterText, setFilterText] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  // Response View Mode: 'pretty' (美化响应 - 默认) vs 'raw' (原始报文)
  const [responseViewMode, setResponseViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [wrapRawLines, setWrapRawLines] = useState<boolean>(true);
  const [allExpanded, setAllExpanded] = useState<boolean>(true);

  // Vertical split resizer state between request configuration and event stream viewer
  const [reqHeightPercent, setReqHeightPercent] = useState<number>(36);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalH = rect.height;
      if (totalH > 0) {
        const percent = Math.min(Math.max((relativeY / totalH) * 100, 15), 85);
        setReqHeightPercent(percent);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const currentStreamIdRef = useRef<string | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  // Performance & Capacity Refs
  const sseSeqRef = useRef<number>(0);
  const pendingEventsRef = useRef<SseEventItem[]>([]);
  const sseRafIdRef = useRef<number | null>(null);

  // Flush queued events into React state in a bounded batch
  const flushPendingSseEvents = () => {
    if (sseRafIdRef.current) {
      cancelAnimationFrame(sseRafIdRef.current);
      sseRafIdRef.current = null;
    }
    if (pendingEventsRef.current.length === 0) return;

    const batch = pendingEventsRef.current;
    pendingEventsRef.current = [];

    setEvents((prev) => {
      const merged = [...prev, ...batch];
      if (bufferLimit > 0 && merged.length > bufferLimit) {
        return merged.slice(merged.length - bufferLimit);
      }
      return merged;
    });
  };

  // Trim events when bufferLimit changes
  useEffect(() => {
    if (bufferLimit > 0) {
      setEvents((prev) => (prev.length > bufferLimit ? prev.slice(prev.length - bufferLimit) : prev));
    }
  }, [bufferLimit]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (sseRafIdRef.current) {
        cancelAnimationFrame(sseRafIdRef.current);
      }
    };
  }, []);

  // Auto scroll effect
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

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

  // Clean up on unmount or api change
  useEffect(() => {
    return () => {
      if (currentStreamIdRef.current && window.mypostAPI?.stopSseStream) {
        window.mypostAPI.stopSseStream(currentStreamIdRef.current);
      }
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [api.target_id]);

  // Interpolate URL with variables and ensure valid protocol, reading environment preUrl by default
  const resolveUrl = (rawUrl: string): string => {
    let finalUrl = (rawUrl || '').trim();
    if (!finalUrl) return '';

    const envVars: Record<string, string> = {};
    const globalVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(availableVars || {})) {
      if (v.source === 'env') envVars[k] = v.value;
      else globalVars[k] = v.value;
    }
    const allVars = { ...globalVars, ...envVars };
    finalUrl = finalUrl.replace(/\{\{([^{}]+)\}\}/g, (_, key) => allVars[key.trim()] || `{{${key}}}`);

    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      if (preUrl) {
        const cleanPreUrl = preUrl.replace(/\/+$/, '');
        finalUrl = `${cleanPreUrl}/${finalUrl.replace(/^\/+/, '')}`;
      } else {
        if (finalUrl.startsWith('/')) {
          finalUrl = `http://localhost:3000${finalUrl}`;
        } else {
          finalUrl = `http://${finalUrl}`;
        }
      }
    }
    return finalUrl;
  };

  const processSseChunk = (
    chunk: string,
    state: { buffer: string }
  ): SseEventItem[] => {
    state.buffer += chunk;
    const messages = state.buffer.split(/\r?\n\r?\n/);
    state.buffer = messages.pop() || '';

    const newItems: SseEventItem[] = [];
    for (const msg of messages) {
      if (!msg.trim()) continue;

      let currentEvent = 'message';
      let currentId: string | undefined = undefined;
      const dataLines: string[] = [];

      const lines = msg.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith(':')) {
          continue;
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        } else if (line.startsWith('id:')) {
          currentId = line.slice(3).trim();
        }
      }

      // Skip pure heartbeat / comment frames (e.g. :ok)
      if (dataLines.length === 0 && !currentId && currentEvent === 'message') {
        continue;
      }

      const rawData = dataLines.join('\n');
      let isJson = false;
      let prettyData = rawData;
      try {
        const parsed = JSON.parse(rawData);
        isJson = true;
        prettyData = JSON.stringify(parsed, null, 2);
      } catch {
        isJson = false;
        prettyData = rawData;
      }

      const now = new Date();
      const timeStr =
        now.toTimeString().split(' ')[0] +
        '.' +
        String(now.getMilliseconds()).padStart(3, '0');

      sseSeqRef.current += 1;

      newItems.push({
        id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        seq: sseSeqRef.current,
        eventId: currentId,
        event: currentEvent,
        data: rawData,
        prettyData,
        timestamp: Date.now(),
        timeStr,
        size: new TextEncoder().encode(msg).length,
        raw: msg,
        isJson,
      });
    }
    return newItems;
  };

  const handleDisconnect = () => {
    flushPendingSseEvents();
    if (currentStreamIdRef.current && window.mypostAPI?.stopSseStream) {
      window.mypostAPI.stopSseStream(currentStreamIdRef.current);
      currentStreamIdRef.current = null;
    }
    if (cleanupListenersRef.current) {
      cleanupListenersRef.current();
      cleanupListenersRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    toast.info('已主动断开 SSE 连接');
  };

  const handleStartStream = async () => {
    if (status === 'connecting' || status === 'connected') {
      handleDisconnect();
      return;
    }

    setErrorMessage(null);
    const resolvedUrl = resolveUrl(api.url);
    if (!resolvedUrl) {
      toast.error('请输入有效的 SSE 请求 URL 地址');
      return;
    }

    setStatus('connecting');

    try {
      // Construct URL with query parameters
      const urlObj = new URL(resolvedUrl);
      const queryParams = api.request?.query?.parameter || [];
      for (const p of queryParams) {
        if (p.is_checked === 1 && p.key) {
          urlObj.searchParams.append(p.key, p.value || '');
        }
      }

      // Construct headers
      const hasUserAgent = (api.request?.header?.parameter || []).some(
        (h) => h.is_checked === 1 && h.key && h.key.toLowerCase() === 'user-agent'
      );
      const headers: Record<string, string> = {
        Accept: 'text/event-stream, text/*, */*',
        'Cache-Control': 'no-cache',
      };
      if (!hasUserAgent) {
        headers['User-Agent'] =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MyPost/1.0';
      }
      const headerParams = api.request?.header?.parameter || [];
      for (const h of headerParams) {
        if (h.is_checked === 1 && h.key) {
          headers[h.key] = h.value || '';
        }
      }

      // Auth headers
      const auth = api.request?.auth;
      if (auth?.type === 'bearer' && auth.bearer?.token) {
        headers['Authorization'] = `Bearer ${auth.bearer.token}`;
      } else if (auth?.type === 'basic' && auth.basic?.username) {
        const creds = btoa(`${auth.basic.username}:${auth.basic.password || ''}`);
        headers['Authorization'] = `Basic ${creds}`;
      } else if (auth?.type === 'apikey' && auth.apikey?.key && auth.apikey?.value) {
        if (auth.apikey.in === 'header') {
          headers[auth.apikey.key] = auth.apikey.value;
        } else {
          urlObj.searchParams.append(auth.apikey.key, auth.apikey.value);
        }
      }

      // Request Body (for POST/PUT/PATCH)
      const method = api.method || 'GET';
      let body: string | undefined = undefined;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const bodyMode = api.request?.body?.mode;
        if (bodyMode === 'json' || bodyMode === 'raw') {
          body = api.request?.body?.raw || '';
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
          }
        }
      }

      // Prefer Node.js native streaming IPC bridge (bypasses CORS, preflight & browser limits)
      if (window.mypostAPI?.startSseStream) {
        const streamId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        currentStreamIdRef.current = streamId;
        const parserState = { buffer: '' };

        const unsubs: Array<() => void> = [];

        unsubs.push(
          window.mypostAPI.onSseConnected(streamId, () => {
            setStatus('connected');
            setConnectedTime(Date.now());
            toast.success('已成功连接 SSE 事件流');
          })
        );

        unsubs.push(
          window.mypostAPI.onSseChunk(streamId, (chunk: string) => {
            setTotalBytes((prev) => prev + new TextEncoder().encode(chunk).length);
            const newEvents = processSseChunk(chunk, parserState);
            if (newEvents.length > 0) {
              setCumulativeEventsCount((prev) => prev + newEvents.length);
              pendingEventsRef.current.push(...newEvents);
              if (!sseRafIdRef.current) {
                sseRafIdRef.current = requestAnimationFrame(flushPendingSseEvents);
              }
            }
          })
        );

        unsubs.push(
          window.mypostAPI.onSseEnd(streamId, () => {
            flushPendingSseEvents();
            if (cleanupListenersRef.current) {
              cleanupListenersRef.current();
              cleanupListenersRef.current = null;
            }
            currentStreamIdRef.current = null;
            setStatus('idle');
            toast.info('SSE 事件流已结束');
          })
        );

        unsubs.push(
          window.mypostAPI.onSseError(streamId, (err: string) => {
            flushPendingSseEvents();
            if (cleanupListenersRef.current) {
              cleanupListenersRef.current();
              cleanupListenersRef.current = null;
            }
            currentStreamIdRef.current = null;
            setStatus('error');
            setErrorMessage(err);
            toast.error(`SSE 连接失败: ${err}`);
          })
        );

        cleanupListenersRef.current = () => {
          unsubs.forEach((fn) => fn());
        };

        const started = await window.mypostAPI.startSseStream(streamId, {
          url: urlObj.toString(),
          method,
          headers,
          body,
        });

        if (!started) {
          throw new Error('启动 SSE 连接失败');
        }
      } else {
        // Fallback for non-Electron / web environments
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const response = await fetch(urlObj.toString(), {
          method,
          headers,
          body,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('服务器未返回可读取的流式响应体 (response.body is null)');
        }

        setStatus('connected');
        setConnectedTime(Date.now());
        toast.success('已成功连接 SSE 事件流');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parserState = { buffer: '' };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setTotalBytes((prev) => prev + value.length);

          const newEvents = processSseChunk(chunk, parserState);
          if (newEvents.length > 0) {
            setCumulativeEventsCount((prev) => prev + newEvents.length);
            pendingEventsRef.current.push(...newEvents);
            if (!sseRafIdRef.current) {
              sseRafIdRef.current = requestAnimationFrame(flushPendingSseEvents);
            }
          }
        }

        flushPendingSseEvents();
        setStatus('idle');
        toast.info('SSE 事件流已正常结束');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        setStatus('error');
        setErrorMessage(err.message || '连接失败');
        toast.error(`SSE 连接失败: ${err.message || err}`);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleFormatBodyJson = () => {
    const raw = api.request?.body?.raw || '';
    if (!raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange({
        ...api,
        request: {
          ...api.request,
          body: { ...api.request?.body, mode: 'raw', raw: formatted },
        },
      });
      toast.success('已美化请求体 JSON 格式');
    } catch (e: any) {
      toast.error(`JSON 格式错误，无法美化: ${e.message}`);
    }
  };

  const toggleAllExpanded = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const newMap: Record<string, boolean> = {};
    for (const ev of events) {
      newMap[ev.id] = nextState;
    }
    setExpandedEvents(newMap);
  };

  const handleClearEvents = () => {
    if (sseRafIdRef.current) {
      cancelAnimationFrame(sseRafIdRef.current);
      sseRafIdRef.current = null;
    }
    pendingEventsRef.current = [];
    setEvents([]);
    setTotalBytes(0);
    setCumulativeEventsCount(0);
    sseSeqRef.current = 0;
    setExpandedEvents({});
    toast.success('已清空事件列表与统计');
  };

  const handleCopyEvent = (ev: SseEventItem) => {
    const textToCopy = ev.prettyData || ev.data;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(ev.id);
    setTimeout(() => setCopiedId(null), 1500);
    toast.success('已复制事件数据');
  };

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Distinct event types
  const distinctEventTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.event);
    return Array.from(set);
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedEventType !== 'all' && ev.event !== selectedEventType) {
        return false;
      }
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase();
      return (
        ev.event.toLowerCase().includes(q) ||
        ev.data.toLowerCase().includes(q) ||
        (ev.eventId && ev.eventId.toLowerCase().includes(q))
      );
    });
  }, [events, filterText, selectedEventType]);

  // Full raw text representation in standard SSE format (event / data / id)
  const fullRawText = useMemo(() => {
    return filteredEvents.map((ev) => formatEventRawBlock(ev)).join('\n\n');
  }, [filteredEvents]);

  const handleCopyAll = () => {
    if (responseViewMode === 'raw') {
      navigator.clipboard.writeText(fullRawText);
      toast.success('已复制全部原始流式报文');
    } else {
      const all = filteredEvents
        .map((e) => `[${e.timeStr}] event: ${e.event}\ndata: ${e.prettyData || e.data}`)
        .join('\n\n');
      navigator.clipboard.writeText(all);
      toast.success('已复制全部美化事件流');
    }
  };

  const handleExportJson = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      url: api.url,
      stats: {
        retainedCount: events.length,
        cumulativeEventsCount,
        totalBytes,
      },
      events,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sse-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出事件数据');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas select-none">
      {/* Top Bar: Name & Actions */}
      <div className="h-11 px-4 border-b border-line flex items-center justify-between bg-subtle shrink-0">
        <div className="flex items-center gap-3 w-1/2">
          <input
            type="text"
            value={api.name || ''}
            onChange={(e) => onChange({ ...api, name: e.target.value })}
            placeholder="SSE 接口名称"
            className="bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 px-2 py-0.5 rounded flex-1"
          />
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="h-12 border-b border-line bg-subtle/50 px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Method selector: GET / POST */}
          <select
            value={api.method || 'GET'}
            onChange={(e) => onChange({ ...api, method: e.target.value as HttpMethod })}
            className="h-8 bg-subtle border border-line rounded px-2.5 text-xs font-bold text-sky-400 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          {/* URL Input */}
          <div className="flex-1 min-w-0 flex items-center bg-subtle border border-line rounded px-2.5 focus-within:border-sky-500 transition shadow-inner">
            <Activity className="w-3.5 h-3.5 text-sky-400 mr-2 shrink-0" />
            {preUrl && (
              <span className="text-gray-500 text-xs font-mono select-none mr-1.5 shrink-0">
                {preUrl}
              </span>
            )}
            <VariableInput
              value={api.url || ''}
              onChange={(newUrl) => onChange({ ...api, url: newUrl })}
              availableVars={availableVars}
              placeholder="/api/stream 或 {{baseUrl}}/stream"
              className="w-full h-8 bg-transparent text-xs text-foreground placeholder-gray-500 font-mono focus:outline-none"
            />
          </div>

          {/* Send / Stop Button */}
          <button
            type="button"
            onClick={handleStartStream}
            className={`h-8 px-4 rounded font-medium text-xs flex items-center gap-1.5 transition shadow-sm ${status === 'connected' || status === 'connecting'
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
          >
            {status === 'connecting' ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>连接中...</span>
              </>
            ) : status === 'connected' ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>停止连接</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>发起流式请求</span>
              </>
            )}
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={onSave}
            className="h-8 px-3 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-200 hover:text-white flex items-center gap-1.5 transition"
            title="保存当前配置"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存</span>
          </button>

          {onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              className="h-8 px-2.5 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-sky-400 flex items-center gap-1 transition"
              title="分享此流式接口"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle border border-line">
            <span
              className={`w-2 h-2 rounded-full ${status === 'connected'
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
                    ? '连接异常'
                    : '未连接'}
            </span>
          </div>

          <div className="text-[11px] text-gray-400 font-mono">
            {events.length} 事件 · {(totalBytes / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>

      {/* Main Content Area: Split Top (Config) and Bottom (Stream Feed) */}
      <div ref={splitContainerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Request Configuration Panel (resizable) */}
        <div
          style={{ height: `${reqHeightPercent}%` }}
          className="flex flex-col bg-sidebar shrink-0 min-h-[90px] overflow-hidden"
        >
          {/* Config Tabs */}
          <div className="flex items-center border-b border-line px-3 bg-subtle/30">
            <button
              type="button"
              onClick={() => setActiveTab('params')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${activeTab === 'params'
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
            >
              Params {api.request?.query?.parameter?.length ? `(${api.request.query.parameter.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${activeTab === 'headers'
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
            >
              Headers {api.request?.header?.parameter?.length ? `(${api.request.header.parameter.length})` : ''}
            </button>
            {api.method === 'POST' && (
              <button
                type="button"
                onClick={() => setActiveTab('body')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${activeTab === 'body'
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
              >
                Body
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${activeTab === 'auth'
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
            >
              Auth
            </button>
          </div>

          {/* Config Content */}
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

            {activeTab === 'body' && (
              <div className="h-full flex flex-col">
                <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-between">
                  <span>POST 请求体 (JSON / Raw 格式，常用于 AI 补全等流式请求)</span>
                  <button
                    type="button"
                    onClick={handleFormatBodyJson}
                    className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition"
                    title="美化请求体 JSON 格式"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>美化格式</span>
                  </button>
                </div>
                <textarea
                  value={api.request?.body?.raw || ''}
                  onChange={(e) =>
                    onChange({
                      ...api,
                      request: {
                        ...api.request,
                        body: { ...api.request?.body, mode: 'raw', raw: e.target.value },
                      },
                    })
                  }
                  placeholder='{\n  "model": "deepseek-chat",\n  "stream": true,\n  "messages": [{"role": "user", "content": "你好"}]\n}'
                  className="flex-1 w-full bg-subtle border border-line rounded p-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
                />
              </div>
            )}

            {activeTab === 'auth' && (
              <div className="max-w-md space-y-3 p-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-20">认证类型:</span>
                  <select
                    value={api.request?.auth?.type || 'none'}
                    onChange={(e) =>
                      onChange({
                        ...api,
                        request: {
                          ...api.request,
                          auth: { ...api.request?.auth, type: e.target.value as any },
                        },
                      })
                    }
                    className="bg-subtle border border-line rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                  >
                    <option value="none">No Auth (无需认证)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="apikey">API Key</option>
                  </select>
                </div>

                {api.request?.auth?.type === 'bearer' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-20">Token:</span>
                    <input
                      type="text"
                      value={api.request?.auth?.bearer?.token || ''}
                      onChange={(e) =>
                        onChange({
                          ...api,
                          request: {
                            ...api.request,
                            auth: { ...api.request?.auth, type: 'bearer', bearer: { token: e.target.value } },
                          },
                        })
                      }
                      placeholder="sk-..."
                      className="flex-1 bg-subtle border border-line rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vertical Drag Resizer Bar between Config and Response Display */}
        <div
          onMouseDown={() => setIsDragging(true)}
          onDoubleClick={() => setReqHeightPercent(36)}
          className={`h-1.5 hover:h-2 bg-subtle hover:bg-sky-500/40 border-y border-line cursor-row-resize transition-all flex items-center justify-center select-none group z-10 shrink-0 ${
            isDragging ? 'bg-sky-500/50 h-2' : ''
          }`}
          title="上下拖动调整配置区域与响应展示区域大小 (双击恢复默认 36%)"
        >
          <div className="w-8 h-1 rounded-full bg-gray-400/40 group-hover:bg-sky-400 transition" />
        </div>

        {/* Real-time Event Stream Viewer (resizable) */}
        <div
          style={{ height: `calc(${100 - reqHeightPercent}% - 6px)` }}
          className="flex-1 flex flex-col min-h-[120px] bg-canvas overflow-hidden"
        >
          {/* Stream Toolbar */}
          <div className="h-10 border-b border-line px-3 flex items-center justify-between gap-2.5 bg-subtle/30 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Response Display Mode Switch: 下拉选切换 (美化响应 vs 原始报文) */}
              <div className="flex items-center gap-1.5 shrink-0 bg-subtle border border-line rounded px-2 py-1">
                {responseViewMode === 'pretty' ? (
                  <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                )}
                <select
                  value={responseViewMode}
                  onChange={(e) => setResponseViewMode(e.target.value as 'pretty' | 'raw')}
                  className="bg-transparent text-xs text-gray-200 focus:outline-none cursor-pointer font-medium pr-1"
                  title="切换响应展示模式"
                >
                  <option value="pretty" className="bg-surface text-gray-200">
                    美化响应
                  </option>
                  <option value="raw" className="bg-surface text-gray-200">
                    原始报文
                  </option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative w-36 sm:w-44 shrink-0">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-2" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="搜索报文内容..."
                  className="w-full bg-subtle border border-line rounded pl-7 pr-2 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Filter by Event Type */}
              {distinctEventTypes.length > 1 && (
                <div className="flex items-center gap-1 text-xs shrink-0">
                  <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <select
                    value={selectedEventType}
                    onChange={(e) => setSelectedEventType(e.target.value)}
                    className="bg-subtle border border-line rounded px-2 py-1 text-xs text-gray-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-surface text-gray-200">
                      所有事件 ({distinctEventTypes.length})
                    </option>
                    {distinctEventTypes.map((t) => (
                      <option key={t} value={t} className="bg-surface text-gray-200">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Buffer Capacity Limit Dropdown */}
              <div className="relative shrink-0 flex items-center">
                <select
                  value={bufferLimit}
                  onChange={(e) => setBufferLimit(Number(e.target.value))}
                  className="appearance-none bg-subtle hover:bg-hover border border-line text-foreground text-xs pl-2.5 pr-6 py-1 rounded cursor-pointer focus:outline-none focus:border-sky-500 transition shadow-sm font-mono"
                  title="事件缓冲区上限 (自动修剪早期历史事件，防止长期连接导致页面卡顿)"
                >
                  <option value={200} className="bg-surface text-foreground">上限: 200 条</option>
                  <option value={500} className="bg-surface text-foreground">上限: 500 条 (默认)</option>
                  <option value={1000} className="bg-surface text-foreground">上限: 1000 条</option>
                  <option value={2000} className="bg-surface text-foreground">上限: 2000 条</option>
                  <option value={0} className="bg-surface text-foreground">无限制 (可能卡顿)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
              </div>

              <span className="text-[11px] text-gray-500 font-mono shrink-0 hidden xl:inline">
                {cumulativeEventsCount > events.length
                  ? `${filteredEvents.length} 个事件 (累计 ${cumulativeEventsCount})`
                  : `${filteredEvents.length} 个事件`}
              </span>

              {/* Trimmed Badge */}
              {cumulativeEventsCount > events.length && (
                <Tooltip content={`已累计接收 ${cumulativeEventsCount} 个事件。为保障页面流畅，仅保留最新 ${events.length} 个。`}>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono hidden md:inline-flex items-center gap-1 cursor-help shrink-0">
                    <span>已修剪 {cumulativeEventsCount - events.length} 条</span>
                  </span>
                </Tooltip>
              )}
            </div>

            {/* Right Action Buttons: 图标 + Tooltip (极简提示、自适应位置、禁止换行) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Mode Specific: Wrap Text (raw) or Expand/Collapse all (pretty) */}
              {responseViewMode === 'pretty' ? (
                <Tooltip content={allExpanded ? '折叠全部' : '展开全部'} placement="bottom">
                  <button
                    type="button"
                    onClick={toggleAllExpanded}
                    disabled={events.length === 0}
                    className="w-7 h-7 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-white flex items-center justify-center disabled:opacity-40 transition"
                  >
                    {allExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                </Tooltip>
              ) : (
                <Tooltip content={wrapRawLines ? '关闭换行' : '自动换行'} placement="bottom">
                  <button
                    type="button"
                    onClick={() => setWrapRawLines(!wrapRawLines)}
                    className={`w-7 h-7 rounded flex items-center justify-center border transition ${
                      wrapRawLines
                        ? 'bg-sky-500/20 border-sky-500/40 text-sky-400 shadow-sm'
                        : 'bg-subtle hover:bg-hover border-line text-gray-400 hover:text-white'
                    }`}
                  >
                    <WrapText className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}

              {/* Auto Scroll */}
              <Tooltip content={autoScroll ? '暂停滚动' : '自动滚动'} placement="bottom">
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`w-7 h-7 rounded flex items-center justify-center border transition ${
                    autoScroll
                      ? 'bg-sky-500/20 border-sky-500/40 text-sky-400 shadow-sm'
                      : 'bg-subtle hover:bg-hover border-line text-gray-400 hover:text-white'
                  }`}
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <div className="w-[1px] h-3.5 bg-line mx-0.5 shrink-0" />

              {/* Copy All */}
              <Tooltip content={responseViewMode === 'raw' ? '复制报文' : '复制全部'} placement="bottom">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  disabled={events.length === 0}
                  className="w-7 h-7 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-white flex items-center justify-center disabled:opacity-40 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              {/* Export JSON */}
              <Tooltip content="导出 JSON" placement="bottom">
                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={events.length === 0}
                  className="w-7 h-7 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-white flex items-center justify-center disabled:opacity-40 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              {/* Clear */}
              <Tooltip content="清空" placement="bottom">
                <button
                  type="button"
                  onClick={handleClearEvents}
                  disabled={events.length === 0}
                  className="w-7 h-7 rounded bg-subtle hover:bg-rose-500/20 border border-line text-gray-400 hover:text-rose-400 flex items-center justify-center disabled:opacity-40 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Response Display Box (Entire container switches between Pretty Cards and Raw Wire Protocol Stream) */}
          {responseViewMode === 'pretty' ? (
            /* Pretty Mode: Structured Cards Timeline */
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {filteredEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-12">
                  <Activity className="w-10 h-10 text-gray-600 stroke-1" />
                  <div className="text-xs font-medium text-gray-400">
                    {status === 'connecting'
                      ? '正在连接 SSE 服务器，请稍候...'
                      : status === 'connected'
                        ? '已建立连接，等待服务器推送事件流...'
                        : '暂无事件流，请在顶部配置 URL 并点击“发起流式请求”'}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    支持 OpenAI / Claude / Ollama / 业务端推送等各类 Server-Sent Events 流式服务
                  </div>
                </div>
              ) : (
                filteredEvents.map((ev, index) => {
                  const isExpanded = expandedEvents[ev.id] ?? true;
                  const isDone = ev.data.trim() === '[DONE]';
                  return (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-line bg-subtle/40 hover:bg-subtle/70 transition overflow-hidden text-xs"
                    >
                      {/* Event Header */}
                      <div
                        onClick={() => toggleExpand(ev.id)}
                        className="px-3 py-1.5 flex items-center justify-between gap-2 bg-subtle/60 border-b border-line/40 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}

                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/20 font-mono">
                            {ev.event}
                          </span>

                          {ev.eventId && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20">
                              id: {ev.eventId}
                            </span>
                          )}

                          {isDone && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              [DONE]
                            </span>
                          )}

                          {ev.isJson && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              JSON
                            </span>
                          )}

                          <span className="text-[11px] text-gray-500 font-mono">#{ev.seq ?? index + 1}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-gray-500 font-mono">{ev.timeStr}</span>
                          <span className="text-[11px] text-gray-500 font-mono">{ev.size} B</span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyEvent(ev);
                            }}
                            className="p-1 hover:bg-hover rounded text-gray-400 hover:text-white transition"
                            title="复制"
                          >
                            {copiedId === ev.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Event Body */}
                      {isExpanded && (
                        <div className="p-3 bg-canvas/40">
                          {isDone ? (
                            <div className="flex items-center gap-2 py-1 px-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs w-fit">
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span>[DONE] 流式响应传输结束</span>
                            </div>
                          ) : ev.isJson && ev.prettyData ? (
                            <pre className="font-mono text-xs leading-relaxed max-h-96 overflow-y-auto select-text whitespace-pre-wrap break-all">
                              {highlightJson(ev.prettyData)}
                            </pre>
                          ) : (
                            <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap break-all leading-relaxed max-h-96 overflow-y-auto select-text">
                              {ev.data}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Raw Mode: Continuous Wire Protocol Stream (event: / data: / id:) */
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto bg-canvas/60 font-mono text-xs select-text"
            >
              {errorMessage && (
                <div className="m-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {filteredEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-12">
                  <Activity className="w-10 h-10 text-gray-600 stroke-1" />
                  <div className="text-xs font-medium text-gray-400">
                    {status === 'connecting'
                      ? '正在连接 SSE 服务器，请稍候...'
                      : status === 'connected'
                        ? '已建立连接，等待服务器推送事件流...'
                        : '暂无事件流，请在顶部配置 URL 并点击“发起流式请求”'}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    原始报文模式将直接展示 event: / data: / id: 协议数据
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-3">
                  {filteredEvents.map((ev, index) => {
                    const rawBlock = formatEventRawBlock(ev);
                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-lg bg-subtle/25 border border-line/50 hover:border-sky-500/40 hover:bg-subtle/40 transition group relative"
                      >
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2 pb-1.5 border-b border-line/30 select-none">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-400 font-medium">#{ev.seq ?? index + 1}</span>
                            <span className="text-gray-600">•</span>
                            <span className="font-mono text-gray-400">{ev.timeStr}</span>
                            <span className="text-gray-600">•</span>
                            <span className="font-mono text-gray-500">{ev.size} B</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(rawBlock);
                              setCopiedId(ev.id);
                              setTimeout(() => setCopiedId(null), 1500);
                              toast.success(`已复制第 #${ev.seq ?? index + 1} 条原始报文`);
                            }}
                            className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-white flex items-center gap-1 transition text-[11px]"
                            title="复制"
                          >
                            {copiedId === ev.id ? (
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
                        <div
                          className={`font-mono text-xs select-text ${
                            wrapRawLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
                          }`}
                        >
                          {rawBlock.split('\n').map((line, idx) => renderHighlightedRawLine(line, idx))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
