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
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Filter,
  AlertCircle,
  Download,
  Code2,
  FileText,
  WrapText,
  ListTree,
  X,
} from 'lucide-react';
import { ApiDetail, ApiTreeNode, HttpMethod, HttpResponseResult, KeyValueItem } from '../../../common/types';
import { ParamUtils } from '../../../common/paramUtils';
import { UrlUtils } from '../../../common/urlUtils';
import { DataImporters } from '../../../common/importers';
import { VariableItem, VariableInput } from './VariableInput';
import { RequestEditor } from './RequestEditor';
import { ResponseViewer } from './ResponseViewer';
import { Tooltip } from './Tooltip';
import { useFeedback } from './FeedbackContext';
import { JsonCodeEditor } from './JsonCodeEditor';

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
 * Text highlighter for search query matches
 */
const renderHighlightedText = (text: string, query: string): React.ReactNode => {
  if (!query || !query.trim() || !text) return text;
  const q = query.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-amber-400/35 text-amber-200 px-0.5 rounded font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch {
    return text;
  }
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
const renderHighlightedRawLine = (line: string, lineIdx: number, query?: string): React.ReactNode => {
  if (line.startsWith('event:')) {
    const val = line.slice(6);
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-sky-400 font-semibold">event:</span>
        <span className="text-sky-200">{renderHighlightedText(val, query || '')}</span>
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
          <span className="text-gray-200">{renderHighlightedText(val, query || '')}</span>
        )}
      </div>
    );
  }
  if (line.startsWith('id:')) {
    const val = line.slice(3);
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-amber-400 font-semibold">id:</span>
        <span className="text-amber-200">{renderHighlightedText(val, query || '')}</span>
      </div>
    );
  }
  if (line.startsWith('retry:')) {
    const val = line.slice(6);
    return (
      <div key={lineIdx} className="leading-5">
        <span className="text-purple-400 font-semibold">retry:</span>
        <span className="text-purple-200">{renderHighlightedText(val, query || '')}</span>
      </div>
    );
  }
  if (line.startsWith(':')) {
    return (
      <div key={lineIdx} className="leading-5 text-gray-500 italic">
        {renderHighlightedText(line, query || '')}
      </div>
    );
  }
  return (
    <div key={lineIdx} className="leading-5 text-gray-300">
      {renderHighlightedText(line, query || '')}
    </div>
  );
};

const methodColors: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  DELETE: 'text-rose-400',
  PATCH: 'text-purple-400',
  HEAD: 'text-teal-400',
  OPTIONS: 'text-pink-400',
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
  treeItems?: ApiTreeNode[];
  folderDetails?: Record<string, any>;
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
  treeItems = [],
  folderDetails = {},
}) => {
  const { toast } = useFeedback();

  // Connection & Stream State
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [events, setEvents] = useState<SseEventItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedTime, setConnectedTime] = useState<number | null>(null);
  const [elapsedDuration, setElapsedDuration] = useState('00:00');
  const [totalBytes, setTotalBytes] = useState(0);
  const [cumulativeEventsCount, setCumulativeEventsCount] = useState<number>(0);

  // Response snapshot for unified ResponseViewer tabs (headers, actual, console, examples)
  const [sseResponse, setSseResponse] = useState<HttpResponseResult | null>(null);

  // Compute all implicit / inherited parameters from parent folders, Auth, and SSE system defaults
  const { headers: inheritedHeaders, query: inheritedQuery } = React.useMemo(() => {
    return ParamUtils.computeImplicitParams(api, treeItems, folderDetails, { isSse: true });
  }, [api, treeItems, folderDetails]);

  // Streaming real-time area UI state
  const [filterText, setFilterText] = useState('');
  const [filterOnly, setFilterOnly] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const sseSearchInputRef = useRef<HTMLInputElement>(null);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [treeEventIds, setTreeEventIds] = useState<Record<string, boolean>>({});

  // View mode inside streaming response body: 'pretty' (美化响应) vs 'raw' (原始报文)
  const [responseViewMode, setResponseViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [wrapRawLines, setWrapRawLines] = useState<boolean>(true);
  const [allExpanded, setAllExpanded] = useState<boolean>(true);

  // Vertical split resizer state between RequestEditor and ResponseViewer
  const [reqHeightPercent, setReqHeightPercent] = useState<number>(42);
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

  // Flush queued events into React state in a high-efficiency RAF batch without frame limit
  const flushPendingSseEvents = () => {
    if (sseRafIdRef.current) {
      cancelAnimationFrame(sseRafIdRef.current);
      sseRafIdRef.current = null;
    }
    if (pendingEventsRef.current.length === 0) return;

    const batch = pendingEventsRef.current;
    pendingEventsRef.current = [];

    setEvents((prev) => [...prev, ...batch]);
  };

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
  // Clean up and reset stream state on unmount or api change: avoids cross-talk
  useEffect(() => {
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    sseSeqRef.current++;
    setEvents([]);
    pendingEventsRef.current = [];
    setSseResponse(null);
    setStatus('idle');
    setTotalBytes(0);
    setFilterText('');
    setActiveMatchIndex(0);

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

  const methodColors: Record<HttpMethod, string> = {
    GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    POST: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    PUT: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    HEAD: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    OPTIONS: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  // Keyboard shortcut Ctrl+Enter to connect/disconnect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleStartStream();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, api]);

  // Interpolate URL with variables and ensure valid protocol
  const resolveUrl = (rawUrl: string): string => {
    let finalUrl = (rawUrl || '').trim();
    if (!finalUrl) return '';

    const envs: Record<string, string> = {};
    const globals: Record<string, string> = {};
    for (const [k, v] of Object.entries(availableVars || {})) {
      if (v.source === 'env') envs[k] = v.value;
      else globals[k] = v.value;
    }
    const allVars = { ...globals, ...envs };
    finalUrl = finalUrl.replace(/\{\{([^{}]+)\}\}/g, (_, key) => allVars[key.trim()] || `{{${key}}}`);

    return UrlUtils.buildRequestUrl(finalUrl, preUrl);
  };

  // URL input handler with automatic cURL command detection & URL -> Query & Path parameter sync
  const handleUrlChange = (newUrl: string) => {
    if (DataImporters.isCurl(newUrl)) {
      try {
        const parsedApi = DataImporters.curlToApiDetail(newUrl, api, preUrl);
        onChange(parsedApi);
        return;
      } catch (err: any) {
        console.error('Failed to parse curl from input:', err);
      }
    }

    const currentQuery = api.request?.query?.parameter || [];
    const currentPath = api.request?.path?.parameter || [];
    const { queryParams } = UrlUtils.syncUrlToParams(newUrl, currentQuery);
    const pathParams = UrlUtils.extractPathParams(newUrl, currentPath);

    onChange({
      ...api,
      url: newUrl,
      request: {
        ...api.request,
        query: { parameter: queryParams },
        path: { parameter: pathParams },
      },
    });
  };

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (DataImporters.isCurl(pastedText)) {
      e.preventDefault();
      try {
        const parsedApi = DataImporters.curlToApiDetail(pastedText, api, preUrl);
        onChange(parsedApi);
      } catch (err: any) {
        console.error('Failed to parse pasted curl:', err);
      }
    }
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
    setSseResponse((prev) =>
      prev
        ? {
            ...prev,
            logs: [...(prev.logs || []), `[${new Date().toLocaleTimeString()}] 已断开 SSE 连接`],
          }
        : prev
    );
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

    // Reset previous connection state cleanly so only current request data is shown
    setEvents([]);
    pendingEventsRef.current = [];
    sseSeqRef.current = 0;
    setTotalBytes(0);
    setCumulativeEventsCount(0);
    setFilterText('');
    setActiveMatchIndex(0);
    setSelectedEventType('all');

    setStatus('connecting');

    try {
      // Construct URL with query parameters (including inherited query params)
      const urlObj = new URL(resolvedUrl);
      const queryRecord: Record<string, string> = {};

      for (const inh of inheritedQuery) {
        if (!inh.overridden && inh.key) {
          urlObj.searchParams.append(inh.key, inh.value || '');
          queryRecord[inh.key] = inh.value || '';
        }
      }

      const queryParams = api.request?.query?.parameter || [];
      for (const p of queryParams) {
        if (p.is_checked === 1 && p.key) {
          urlObj.searchParams.append(p.key, p.value || '');
          queryRecord[p.key] = p.value || '';
        }
      }

      // Path parameters
      const pathParams = api.request?.path?.parameter || [];
      const pathRecord: Record<string, string> = {};
      for (const p of pathParams) {
        if (p.is_checked === 1 && p.key) {
          pathRecord[p.key] = p.value || '';
        }
      }

      // Construct headers (including inherited headers)
      const headers: Record<string, string> = {};
      for (const inh of inheritedHeaders) {
        if (!inh.overridden && inh.key) {
          headers[inh.key] = inh.value || '';
        }
      }
      headers['Accept'] = headers['Accept'] || 'text/event-stream, text/*, */*';
      headers['Cache-Control'] = headers['Cache-Control'] || 'no-cache';

      const headerParams = api.request?.header?.parameter || [];
      for (const h of headerParams) {
        if (h.is_checked === 1 && h.key) {
          headers[h.key] = h.value || '';
        }
      }

      // Cookies
      const cookieParams = api.request?.cookie?.parameter || [];
      const cookieStrings = cookieParams
        .filter((c) => c.is_checked === 1 && c.key)
        .map((c) => `${c.key}=${encodeURIComponent(c.value || '')}`);
      if (cookieStrings.length > 0) {
        headers['Cookie'] = cookieStrings.join('; ');
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

      // Request Body (for POST/PUT/PATCH/DELETE)
      const method = api.method || 'GET';
      let body: string | undefined = undefined;
      const bodyMode = api.request?.body?.mode || 'none';
      if (method !== 'GET' && method !== 'HEAD') {
        if (bodyMode === 'raw') {
          body = api.request?.body?.raw || '';
          if (!headers['Content-Type']) {
            const rawType = api.request?.body?.raw_type || 'json';
            headers['Content-Type'] =
              rawType === 'json'
                ? 'application/json'
                : rawType === 'xml'
                ? 'application/xml'
                : 'text/plain';
          }
        } else if (bodyMode === 'urlencoded') {
          const urlencodedParams = api.request?.body?.parameter || [];
          const searchParams = new URLSearchParams();
          for (const item of urlencodedParams) {
            if (item.is_checked === 1 && item.key) {
              searchParams.append(item.key, item.value || '');
            }
          }
          body = searchParams.toString();
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
          }
        } else if (bodyMode === 'form-data') {
          const formParams = api.request?.body?.parameter || [];
          const searchParams = new URLSearchParams();
          for (const item of formParams) {
            if (item.is_checked === 1 && item.key) {
              searchParams.append(item.key, item.value || '');
            }
          }
          body = searchParams.toString();
        }
      }

      const reqTimeStr = new Date().toLocaleTimeString();
      const initialLogs: string[] = [
        `[${reqTimeStr}] [REQ] 发起 SSE 连接: ${method} ${urlObj.toString()}`,
      ];
      if (Object.keys(headers).length > 0) {
        initialLogs.push(`[${reqTimeStr}] [REQ-HEADER] ${JSON.stringify(headers)}`);
      }
      if (Object.keys(queryRecord).length > 0) {
        initialLogs.push(`[${reqTimeStr}] [REQ-QUERY] ${JSON.stringify(queryRecord)}`);
      }
      if (Object.keys(pathRecord).length > 0) {
        initialLogs.push(`[${reqTimeStr}] [REQ-PATH] ${JSON.stringify(pathRecord)}`);
      }
      if (bodyMode !== 'none' && body) {
        initialLogs.push(`[${reqTimeStr}] [REQ-BODY] (mode: ${bodyMode}) ${body}`);
      }

      // Initial response state with actual request snapshot
      const initialResponse: HttpResponseResult = {
        statusCode: 0,
        statusText: 'Connecting...',
        timeMs: 0,
        sizeBytes: 0,
        headers: {},
        cookies: [],
        data: null,
        rawText: '',
        actualRequest: {
          url: api.url,
          fullUrl: urlObj.toString(),
          method,
          headers,
          queryParams: queryRecord,
          pathParams: pathRecord,
          bodyMode,
          bodyData: body,
        },
        logs: initialLogs,
      };
      setSseResponse(initialResponse);

      // Prefer Node.js native streaming IPC bridge (bypasses CORS, preflight & browser limits)
      if (window.mypostAPI?.startSseStream) {
        const streamId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        currentStreamIdRef.current = streamId;
        const parserState = { buffer: '' };

        const unsubs: Array<() => void> = [];

        unsubs.push(
          window.mypostAPI.onSseConnected(streamId, (info: { statusCode: number; headers: any }) => {
            const resTime = new Date().toLocaleTimeString();
            setStatus('connected');
            setConnectedTime(Date.now());
            setSseResponse((prev) => ({
              ...(prev || initialResponse),
              statusCode: info?.statusCode || 200,
              statusText: 'OK (EventStream)',
              headers: info?.headers || {},
              logs: [
                ...(prev?.logs || []),
                `[${resTime}] [RES] SSE 连接成功建立 (HTTP ${info?.statusCode || 200})`,
                ...(info?.headers && Object.keys(info.headers).length > 0
                  ? [`[${resTime}] [RES-HEADER] ${JSON.stringify(info.headers)}`]
                  : []),
              ],
            }));
            toast.success('已成功连接 SSE 事件流');
          })
        );

        unsubs.push(
          window.mypostAPI.onSseChunk(streamId, (chunk: string) => {
            const chunkBytes = new TextEncoder().encode(chunk).length;
            setTotalBytes((prev) => {
              const next = prev + chunkBytes;
              setSseResponse((r) => (r ? { ...r, sizeBytes: next } : r));
              return next;
            });
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
            setSseResponse((prev) =>
              prev
                ? {
                    ...prev,
                    logs: [...(prev.logs || []), `[${new Date().toLocaleTimeString()}] SSE 事件流已结束`],
                  }
                : prev
            );
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
            const errTime = new Date().toLocaleTimeString();
            setStatus('error');
            setErrorMessage(err);
            setSseResponse((prev) =>
              prev
                ? {
                    ...prev,
                    statusCode: prev.statusCode || 500,
                    statusText: 'Error',
                    error: err,
                    logs: [...(prev.logs || []), `[${errTime}] [ERROR] SSE 连接异常: ${err}`],
                  }
                : prev
            );
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
        const resHeaders: Record<string, string> = {};
        response.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });

        const resTime = new Date().toLocaleTimeString();
        setSseResponse((prev) => ({
          ...(prev || initialResponse),
          statusCode: response.status,
          statusText: response.statusText || 'OK',
          headers: resHeaders,
          logs: [
            ...(prev?.logs || []),
            `[${resTime}] [RES] SSE 连接成功建立 (HTTP ${response.status})`,
            ...(Object.keys(resHeaders).length > 0
              ? [`[${resTime}] [RES-HEADER] ${JSON.stringify(resHeaders)}`]
              : []),
          ],
        }));
        toast.success('已成功连接 SSE 事件流');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parserState = { buffer: '' };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const chunkBytes = value.length;
          setTotalBytes((prev) => {
            const next = prev + chunkBytes;
            setSseResponse((r) => (r ? { ...r, sizeBytes: next } : r));
            return next;
          });

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
        setSseResponse((prev) =>
          prev
            ? {
                ...prev,
                logs: [...(prev.logs || []), `[${new Date().toLocaleTimeString()}] SSE 事件流已结束`],
              }
            : prev
        );
        toast.info('SSE 事件流已正常结束');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
      } else {
        const errTime = new Date().toLocaleTimeString();
        setStatus('error');
        setErrorMessage(err.message || '连接失败');
        setSseResponse((prev) =>
          prev
            ? {
                ...prev,
                statusCode: prev.statusCode || 500,
                statusText: 'Error',
                error: err.message || '连接失败',
                logs: [...(prev.logs || []), `[${errTime}] [ERROR] SSE 连接失败: ${err.message || err}`],
              }
            : prev
        );
        toast.error(`SSE 连接失败: ${err.message || err}`);
      }
    } finally {
      abortControllerRef.current = null;
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
    setSseResponse((prev) => (prev ? { ...prev, sizeBytes: 0 } : null));
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

  // Search matching predicate covering all SSE event content (event name, event ID, data, timeStr, seq, raw)
  const sseEventMatchesQuery = (ev: SseEventItem, query: string): boolean => {
    if (!query) return false;
    const q = query.toLowerCase();
    if (ev.data && ev.data.toLowerCase().includes(q)) return true;
    if (ev.event && ev.event.toLowerCase().includes(q)) return true;
    if (ev.eventId && ev.eventId.toLowerCase().includes(q)) return true;
    if (ev.timeStr && ev.timeStr.toLowerCase().includes(q)) return true;
    if (ev.seq !== undefined && String(ev.seq).includes(q)) return true;
    if (ev.raw && ev.raw.toLowerCase().includes(q)) return true;
    return false;
  };

  // Visible events depending on event type filter and filterOnly mode
  const visibleEvents = useMemo(() => {
    const trimmed = filterText.trim();
    return events.filter((ev) => {
      if (selectedEventType !== 'all' && ev.event !== selectedEventType) {
        return false;
      }
      if (filterOnly && trimmed) {
        return sseEventMatchesQuery(ev, trimmed);
      }
      return true;
    });
  }, [events, selectedEventType, filterOnly, filterText]);

  // Matching event IDs within currently visible events
  const matchedEventIds = useMemo(() => {
    const trimmed = filterText.trim();
    if (!trimmed) return [];
    return visibleEvents.filter((ev) => sseEventMatchesQuery(ev, trimmed)).map((ev) => ev.id);
  }, [visibleEvents, filterText]);

  const currentMatchEventId = matchedEventIds[activeMatchIndex] || null;

  const scrollToEvent = (evId: string) => {
    const el = document.getElementById(`sse-ev-${evId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleNextSseMatch = () => {
    if (matchedEventIds.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matchedEventIds.length;
    setActiveMatchIndex(nextIdx);
    scrollToEvent(matchedEventIds[nextIdx]);
  };

  const handlePrevSseMatch = () => {
    if (matchedEventIds.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matchedEventIds.length) % matchedEventIds.length;
    setActiveMatchIndex(prevIdx);
    scrollToEvent(matchedEventIds[prevIdx]);
  };

  // Full raw text representation in standard SSE format (event / data / id)
  const fullRawText = useMemo(() => {
    return visibleEvents.map((ev) => formatEventRawBlock(ev)).join('\n\n');
  }, [visibleEvents]);

  const handleCopyAll = () => {
    if (responseViewMode === 'raw') {
      navigator.clipboard.writeText(fullRawText);
      toast.success('已复制全部原始流式报文');
    } else {
      const all = visibleEvents
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

  // Customized Real-time Streaming Body Component (for ResponseViewer's streamingBodySlot)
  const streamingBodySlot = (
    <div className="h-full flex flex-col min-h-0 bg-canvas overflow-hidden">
      {/* Stream Sub-Toolbar */}
      <div className="h-10 border-b border-line px-3 flex items-center justify-between gap-2.5 bg-subtle/30 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Response Display Mode Switch: 美化响应 vs 原始报文 */}
          <div className="flex items-center bg-subtle border border-line rounded-md p-0.5 shrink-0 text-xs select-none">
            <button
              type="button"
              onClick={() => setResponseViewMode('pretty')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                responseViewMode === 'pretty'
                  ? 'bg-surface text-accent font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="美化结构展示"
            >
              <Code2 className="w-3 h-3" />
              <span>美化</span>
            </button>
            <button
              type="button"
              onClick={() => setResponseViewMode('raw')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                responseViewMode === 'raw'
                  ? 'bg-surface text-accent font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="原始网络报文"
            >
              <FileText className="w-3 h-3" />
              <span>原始</span>
            </button>
          </div>

          {/* Search Box with match navigation & clear */}
          <div className="relative flex items-center w-52 sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
            <input
              ref={sseSearchInputRef}
              type="text"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setActiveMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevSseMatch();
                  } else {
                    handleNextSseMatch();
                  }
                } else if (e.key === 'Escape') {
                  setFilterText('');
                  setActiveMatchIndex(0);
                }
              }}
              placeholder="搜索事件、数据、ID..."
              className="w-full bg-subtle border border-line focus:border-accent rounded-lg pl-8 pr-16 py-1 text-xs text-foreground placeholder-gray-500 focus:outline-none transition shadow-inner font-sans"
            />

            {/* Match counter & navigation controls inside search box */}
            {filterText.trim() && (
              <div className="absolute right-1.5 flex items-center gap-0.5">
                <span className="text-[10px] font-mono text-gray-400 px-1 select-none">
                  {matchedEventIds.length > 0 ? `${activeMatchIndex + 1}/${matchedEventIds.length}` : '0/0'}
                </span>
                <button
                  type="button"
                  onClick={handlePrevSseMatch}
                  disabled={matchedEventIds.length === 0}
                  className="p-0.5 hover:bg-hover rounded text-gray-400 hover:text-white disabled:opacity-30 transition"
                  title="上一个匹配 (Shift+Enter)"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleNextSseMatch}
                  disabled={matchedEventIds.length === 0}
                  className="p-0.5 hover:bg-hover rounded text-gray-400 hover:text-white disabled:opacity-30 transition"
                  title="下一个匹配 (Enter)"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterText('');
                    setActiveMatchIndex(0);
                  }}
                  className="p-0.5 hover:bg-hover rounded text-gray-400 hover:text-white transition"
                  title="清空搜索"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Filter Only Toggle */}
          <button
            type="button"
            onClick={() => setFilterOnly(!filterOnly)}
            className={`h-7 px-2 rounded-md border text-xs flex items-center gap-1 transition shrink-0 select-none ${
              filterOnly
                ? 'bg-accent/20 border-accent/40 text-accent font-medium'
                : 'bg-subtle hover:bg-hover border-line text-gray-400 hover:text-gray-200'
            }`}
            title={filterOnly ? "当前为仅展示匹配项模式，点击切换回全量展示" : "点击仅展示匹配项"}
          >
            <Filter className="w-3 h-3" />
            <span>仅匹配</span>
          </button>

          {/* Filter by Event Type */}
          {distinctEventTypes.length > 1 && (
            <div className="relative shrink-0 flex items-center">
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="appearance-none bg-subtle hover:bg-hover border border-line text-gray-300 text-xs pl-2.5 pr-6 py-1 rounded cursor-pointer focus:outline-none focus:border-accent transition shadow-sm"
                title="筛选事件类型"
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
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
            </div>
          )}

          <span className="text-[11px] text-gray-500 font-mono shrink-0 hidden lg:inline">
            {events.length} 个事件
          </span>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
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
                    ? 'bg-accent/20 border-accent/40 text-accent shadow-sm'
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
                  ? 'bg-accent/15 border-accent/30 text-accent shadow-sm'
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

      {/* Response Display Box (Cards Timeline or Raw Wire Protocol Stream) */}
      {responseViewMode === 'pretty' ? (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {visibleEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-12">
              <Activity className="w-10 h-10 text-gray-600 stroke-1" />
              <div className="text-xs font-medium text-gray-400">
                {filterText.trim() && filterOnly
                  ? '没有找到匹配搜索条件的 SSE 事件'
                  : status === 'connecting'
                  ? '正在连接 SSE 服务器，请稍候...'
                  : status === 'connected'
                  ? '已建立连接，等待服务器推送事件流...'
                  : '暂无事件流，请在顶部配置 URL 并点击“发起流式请求”'}
              </div>
              <div className="text-[11px] text-gray-600">
                支持各类符合 Server-Sent Events (SSE) 协议规范的流式服务与全文字段搜索
              </div>
            </div>
          ) : (
            visibleEvents.map((ev, index) => {
              const isExpanded = expandedEvents[ev.id] ?? true;
              const isDone = ev.data.trim() === '[DONE]';
              const isMatch = matchedEventIds.includes(ev.id);
              const isCurrentMatch = ev.id === currentMatchEventId;

              return (
                <div
                  id={`sse-ev-${ev.id}`}
                  key={ev.id}
                  className={`stream-item-perf rounded-lg border transition-all duration-150 overflow-hidden text-xs ${
                    isCurrentMatch
                      ? 'ring-2 ring-accent/90 shadow-lg shadow-accent/10 border-accent/50'
                      : isMatch
                      ? 'ring-1 ring-accent/40 border-accent/30'
                      : 'border-line'
                  } bg-subtle/40 hover:bg-subtle/70`}
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

                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/15 text-accent border border-accent/20 font-mono">
                        {renderHighlightedText(ev.event, filterText)}
                      </span>

                      {ev.eventId && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20">
                          id: {renderHighlightedText(ev.eventId, filterText)}
                        </span>
                      )}

                      {isDone && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          [DONE]
                        </span>
                      )}

                      {ev.isJson && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTreeEventIds((prev) => ({
                              ...prev,
                              [ev.id]: !prev[ev.id],
                            }));
                          }}
                          className={`p-1 rounded transition flex items-center justify-center ${
                            treeEventIds[ev.id]
                              ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30'
                              : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                          title={treeEventIds[ev.id] ? "切换回代码文本视图" : "结构化 JSON 树状视图"}
                          aria-label={treeEventIds[ev.id] ? "代码视图" : "树状视图"}
                        >
                          {treeEventIds[ev.id] ? (
                            <Code2 className="w-3 h-3 text-amber-400" />
                          ) : (
                            <ListTree className="w-3 h-3 text-emerald-400" />
                          )}
                        </button>
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
                      ) : ev.isJson && treeEventIds[ev.id] ? (
                        <div className="rounded border border-line/60 bg-surface/50 overflow-hidden max-h-96 p-1">
                          <JsonCodeEditor
                            value={ev.prettyData || ev.data}
                            readOnly={true}
                            defaultView="tree"
                            showToolbar={false}
                            minHeight="80px"
                            className="border-none rounded-none bg-transparent"
                          />
                        </div>
                      ) : ev.isJson && ev.prettyData ? (
                        filterText.trim() ? (
                          <pre className="font-mono text-xs leading-relaxed max-h-96 overflow-y-auto select-text whitespace-pre-wrap break-all text-gray-200">
                            {renderHighlightedText(ev.prettyData, filterText)}
                          </pre>
                        ) : (
                          <pre className="font-mono text-xs leading-relaxed max-h-96 overflow-y-auto select-text whitespace-pre-wrap break-all">
                            {highlightJson(ev.prettyData)}
                          </pre>
                        )
                      ) : (
                        <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap break-all leading-relaxed max-h-96 overflow-y-auto select-text">
                          {renderHighlightedText(ev.data, filterText)}
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
        /* Raw Wire Protocol Stream */
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

          {visibleEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-12">
              <Activity className="w-10 h-10 text-gray-600 stroke-1" />
              <div className="text-xs font-medium text-gray-400">
                {filterText.trim() && filterOnly
                  ? '没有找到匹配搜索条件的 SSE 报文'
                  : status === 'connecting'
                  ? '正在连接 SSE 服务器，请稍候...'
                  : status === 'connected'
                  ? '已建立连接，等待服务器推送事件流...'
                  : '暂无事件流，请在顶部配置 URL 并点击“发起流式请求”'}
              </div>
              <div className="text-[11px] text-gray-600">
                原始报文模式将直接展示 event: / data: / id: 协议数据与匹配高亮
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {visibleEvents.map((ev, index) => {
                const rawBlock = formatEventRawBlock(ev);
                const isMatch = matchedEventIds.includes(ev.id);
                const isCurrentMatch = ev.id === currentMatchEventId;

                return (
                  <div
                    id={`sse-ev-${ev.id}`}
                    key={ev.id}
                    className={`stream-item-perf p-3 rounded-lg bg-subtle/25 border transition-all duration-150 group relative ${
                      isCurrentMatch
                        ? 'ring-2 ring-accent/90 shadow-lg shadow-accent/10 border-accent/50 bg-subtle/50'
                        : isMatch
                        ? 'ring-1 ring-accent/40 border-accent/30'
                        : 'border-line/50 hover:border-accent/40 hover:bg-subtle/40'
                    }`}
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
                      {rawBlock.split('\n').map((line, idx) => renderHighlightedRawLine(line, idx, filterText))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas select-none">
      {/* Top Bar: Name & Actions */}
      <div className="h-11 px-4 border-b border-line flex items-center justify-between bg-subtle shrink-0">
        <div className="flex items-center gap-3 w-1/2">
          <input
            type="text"
            value={api.name || ''}
            onChange={(e) => onChange({ ...api, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
                onSave();
              }
            }}
            placeholder="SSE 接口名称"
            className="bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent px-2 py-0.5 rounded flex-1"
          />
        </div>
      </div>

      {/* URL & Connect Bar (Layout & styling identical to HTTP ApiWorkbench) */}
      <div className="p-3 bg-surface border-b border-line flex items-center gap-2 shrink-0">
        {/* Unified HTTP Method selector */}
        <select
          value={api.method || 'GET'}
          onChange={(e) => onChange({ ...api, method: e.target.value as HttpMethod })}
          className={`h-9 w-[86px] px-1 rounded-lg font-bold font-mono text-xs border appearance-none text-center focus:outline-none focus:ring-1 focus:ring-accent transition cursor-pointer shrink-0 select-none ${
            methodColors[api.method || 'GET'] || 'text-gray-300 bg-subtle border-line'
          }`}
          title="切换请求方法"
        >
          {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const).map((m) => (
            <option
              key={m}
              value={m}
              className="bg-surface text-foreground font-mono font-bold text-xs py-1"
            >
              {m}
            </option>
          ))}
        </select>

        {/* URL Input with preUrl, VariableInput, Enter key shortcut */}
        <div className="flex-1 flex items-center bg-surface border border-line focus-within:border-accent rounded-lg px-3 h-9 transition">
          {preUrl && (
            <span className="text-gray-500 text-xs font-mono select-none mr-1.5 shrink-0">
              {preUrl}
            </span>
          )}
          <VariableInput
            value={api.url || ''}
            onChange={handleUrlChange}
            onPaste={handleUrlPaste}
            availableVars={availableVars}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleStartStream();
              }
            }}
            placeholder="/api/stream 或 {{baseUrl}}/stream"
            className="w-full bg-transparent border-none text-xs text-gray-100 placeholder-gray-500 font-mono focus:outline-none"
          />
        </div>

        {/* Send / Stop Button */}
        <button
          type="button"
          onClick={handleStartStream}
          className={`h-9 px-4 rounded-lg font-bold text-xs flex items-center gap-2 transition shrink-0 select-none ${
            status === 'connected'
              ? 'bg-rose-500 hover:bg-rose-600 text-white'
              : status === 'connecting'
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/10'
          }`}
          title="发起流式请求 (Ctrl+Enter)"
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

        {/* Save Button (Identical to HTTP) */}
        <button
          type="button"
          onClick={onSave}
          className={`h-9 px-4 rounded-lg border bg-transparent hover:bg-hover font-bold text-xs flex items-center gap-2 transition shrink-0 select-none ${
            isDirty
              ? 'border-accent text-accent hover:bg-accent/10 shadow-sm'
              : 'border-line hover:border-gray-400/60 text-foreground'
          }`}
          title="保存当前配置 (Ctrl+S)"
          aria-label="保存修改"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存</span>
          {isDirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5"
              title="有未保存修改"
            />
          )}
        </button>

      </div>

      {/* Main Split Area: Request Configuration (top) & Response Viewer (bottom) */}
      <div ref={splitContainerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Upper Area: Reusable HTTP Request Editor */}
        <div
          style={{ height: `${reqHeightPercent}%` }}
          className="flex flex-col bg-surface shrink-0 min-h-[90px] overflow-hidden"
        >
          <RequestEditor
            api={api}
            onChange={onChange}
            availableVars={availableVars}
            accentColor="accent"
            showScripts={false}
            treeItems={treeItems}
            folderDetails={folderDetails}
            isSse={true}
          />
        </div>

        {/* Vertical Drag Resizer Bar */}
        <div
          onMouseDown={() => setIsDragging(true)}
          onDoubleClick={() => setReqHeightPercent(42)}
          className={`h-1.5 hover:h-2 bg-subtle hover:bg-accent/40 border-y border-line cursor-row-resize transition-all flex items-center justify-center select-none group z-10 shrink-0 ${
            isDragging ? 'bg-accent/50 h-2' : ''
          }`}
          title="上下拖动调整请求配置与响应展示区域大小 (双击恢复默认 42%)"
        >
          <div className="w-8 h-1 rounded-full bg-gray-400/40 group-hover:bg-accent transition" />
        </div>

        {/* Lower Area: Reusable ResponseViewer with customized real-time streaming body slot */}
        <div
          style={{ height: `calc(${100 - reqHeightPercent}% - 6px)` }}
          className="flex-1 flex flex-col min-h-[120px] bg-canvas overflow-hidden"
        >
          <ResponseViewer
            response={sseResponse}
            loading={false}
            isStreaming={true}
            streamStats={{
              status,
              elapsedDuration,
              totalBytes,
              eventsCount: events.length,
              errorMessage,
            }}
            activeApi={api}
            streamingBodySlot={streamingBodySlot}
          />
        </div>
      </div>
    </div>
  );
};
