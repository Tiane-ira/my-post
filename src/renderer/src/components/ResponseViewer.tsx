import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  HardDrive,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Code2,
  FileText,
  Eye,
  Terminal,
  Zap,
  X,
  Globe,
  Download,
  Table as TableIcon,
  Search,
  Activity,
} from 'lucide-react';
import { HttpResponseResult, ResponseExample, ApiDetail } from '../../../common/types';
import { Tooltip } from './Tooltip';
import { JsonCodeEditor } from './JsonCodeEditor';

export interface StreamStats {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  elapsedDuration?: string;
  totalBytes?: number;
  eventsCount?: number;
  errorMessage?: string | null;
}

export interface ResponseViewerProps {
  response: HttpResponseResult | null;
  loading: boolean;
  activeApi?: ApiDetail;
  isStreaming?: boolean;
  streamStats?: StreamStats;
  streamingBodySlot?: React.ReactNode;
  onCancel?: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  loading,
  activeApi,
  isStreaming = false,
  streamStats,
  streamingBodySlot,
  onCancel,
}) => {
  // Response tabs (removed examples)
  const [activeTab, setActiveTab] = useState<
    'body' | 'headers' | 'cookies' | 'actual' | 'console'
  >('body');

  // Actual request sub-tab (Header | Query | Path | Body)
  const [actualSubTab, setActualSubTab] = useState<'headers' | 'query' | 'path' | 'body'>('headers');

  const [bodyMode, setBodyMode] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [copied, setCopied] = useState(false);
  const [copiedActualTable, setCopiedActualTable] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Live timer for request duration when waiting without timeout limit
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!loading) {
      setElapsedSec(0);
      return;
    }
    setActiveTab('body');
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 100) / 10);
    }, 100);
    return () => clearInterval(timer);
  }, [loading]);

  const prettyJsonText = useMemo(() => {
    if (!response) return '';
    if (typeof response.data === 'object' && response.data !== null) {
      try {
        return JSON.stringify(response.data, null, 2);
      } catch {
        return response.rawText || '';
      }
    }
    if (response.rawText) {
      try {
        const parsed = JSON.parse(response.rawText);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return response.rawText;
      }
    }
    return '';
  }, [response]);

  const getStatusBadge = (code: number, text: string) => {
    if (text === 'Canceled' || (code === 0 && text.toLowerCase().includes('cancel'))) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          已取消 (Canceled)
        </span>
      );
    }
    if (code >= 200 && code < 300) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {code} {text}
        </span>
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-bold border border-blue-500/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          {code} {text}
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          {code} {text}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
        {code || 'ERROR'} {text}
      </span>
    );
  };

  const handleCopy = () => {
    if (!response?.rawText) return;
    navigator.clipboard.writeText(response.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };


  const headersCount = Object.keys(response?.headers || {}).length;
  const cookiesList = response?.cookies || [];
  const actualReq = response?.actualRequest;

  // Actual request params helper
  const actualHeaders = actualReq?.headers || {};
  const actualQuery = actualReq?.queryParams || {};
  const actualPath = actualReq?.pathParams || {};
  const actualForm = actualReq?.formParams || {};

  const handleCopyActualTable = () => {
    let text = '';
    if (actualSubTab === 'headers') {
      text = Object.entries(actualHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    } else if (actualSubTab === 'query') {
      text = Object.entries(actualQuery)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    } else if (actualSubTab === 'path') {
      text = Object.entries(actualPath)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    } else {
      if (Object.keys(actualForm).length > 0) {
        text = Object.entries(actualForm)
          .map(([k, item]) => `${k}: ${item.value}`)
          .join('\n');
      } else {
        text = actualReq?.bodyData || '';
      }
    }
    navigator.clipboard.writeText(text);
    setCopiedActualTable(true);
    setTimeout(() => setCopiedActualTable(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-subtle overflow-hidden relative">
      {/* Response Header / Stats Bar */}
      <div className="h-10 px-3 bg-surface border-b border-line flex items-center justify-between text-xs select-none">
        {/* Left Tabs (实时响应, 响应头, Cookie, 实际请求, 控制台) */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('body')}
            className={`px-3 py-1.5 rounded-md transition font-medium text-xs whitespace-nowrap ${
              activeTab === 'body'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            实时响应
          </button>

          <button
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-1.5 rounded-md transition font-medium text-xs whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'headers'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>响应头</span>
            {headersCount > 0 && (
              <span className="text-[10px] text-gray-500">({headersCount})</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cookies')}
            className={`px-3 py-1.5 rounded-md transition font-medium text-xs whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'cookies'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Cookie</span>
            {cookiesList.length > 0 && (
              <span className="text-[10px] text-gray-500">({cookiesList.length})</span>
            )}
          </button>

          {/* 实际请求 */}
          <button
            onClick={() => setActiveTab('actual')}
            className={`px-3 py-1.5 rounded-md transition font-medium text-xs whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'actual'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>实际请求</span>
            {actualReq && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`px-3 py-1.5 rounded-md transition font-medium text-xs whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'console'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>控制台</span>
            {response?.logs && response.logs.length > 0 && (
              <span className="text-[10px] text-gray-500">({response.logs.length})</span>
            )}
          </button>
        </div>

        {/* Right Stats & Indicators (Status, Time, Size, Globe icon, Download icon) */}
        <div className="flex items-center gap-2.5 text-xs">
          {isStreaming && streamStats ? (
            <>
              {streamStats.status === 'connected' ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  已连接 ({streamStats.elapsedDuration || '00:00'})
                </span>
              ) : streamStats.status === 'connecting' ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  连接中...
                </span>
              ) : streamStats.status === 'error' ? (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  连接异常
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-500/15 text-gray-400 font-medium border border-line text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                  未连接
                </span>
              )}

              {streamStats.eventsCount !== undefined && (
                <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1">
                  <Activity className="w-3 h-3 text-sky-400" />
                  {streamStats.eventsCount} 事件
                </span>
              )}

              <span className="text-gray-400 font-mono text-[11px] flex items-center gap-0.5">
                <HardDrive className="w-3 h-3 text-gray-500" />
                {formatSize(streamStats.totalBytes || response?.sizeBytes || 0)}
              </span>

              <Tooltip
                content={
                  streamStats.status === 'connected'
                    ? '网络连接状态: 已建立 SSE 事件流连接'
                    : streamStats.status === 'connecting'
                    ? '网络连接状态: 正在建立连接'
                    : '网络连接状态: 未连接'
                }
                delayMs={400}
              >
                <button
                  type="button"
                  className="p-1 rounded text-gray-400 hover:text-gray-200 transition"
                  aria-label="网络状态"
                >
                  <Globe
                    className={`w-3.5 h-3.5 ${
                      streamStats.status === 'connected'
                        ? 'text-emerald-400'
                        : streamStats.status === 'connecting'
                        ? 'text-amber-400 animate-pulse'
                        : 'text-gray-500'
                    }`}
                  />
                </button>
              </Tooltip>
            </>
          ) : loading ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 text-accent font-bold border border-accent/30 text-xs">
                <div className="w-2.5 h-2.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                请求中...
              </span>
              <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-accent animate-pulse" />
                {elapsedSec.toFixed(1)}s
              </span>
            </div>
          ) : response ? (
            <>
              {getStatusBadge(response.statusCode, response.statusText)}

              <span className="text-gray-400 font-mono text-[11px] flex items-center gap-0.5">
                <Clock className="w-3 h-3 text-gray-500" />
                {response.timeMs}ms
              </span>

              <span className="text-gray-400 font-mono text-[11px] flex items-center gap-0.5">
                <HardDrive className="w-3 h-3 text-gray-500" />
                {formatSize(response.sizeBytes)}
              </span>

              <Tooltip content="网络连接状态: 已建立并返回" delayMs={400}>
                <button
                  type="button"
                  className="p-1 rounded text-gray-400 hover:text-gray-200 transition"
                  aria-label="网络状态"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </Tooltip>

              <Tooltip content="导出并下载响应内容" delayMs={400}>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([response.rawText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `response-${response.statusCode}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="p-1 rounded text-gray-400 hover:text-gray-200 transition"
                  aria-label="下载响应"
                >
                  <Download className="w-3.5 h-3.5 text-gray-400 hover:text-foreground" />
                </button>
              </Tooltip>
            </>
          ) : (
            <div className="flex items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-subtle border border-line text-gray-400 font-medium text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                未发送
              </span>

              <span className="text-gray-500 font-mono text-[11px] flex items-center gap-0.5">
                <Clock className="w-3 h-3 text-gray-600" />
                - ms
              </span>

              <span className="text-gray-500 font-mono text-[11px] flex items-center gap-0.5">
                <HardDrive className="w-3 h-3 text-gray-600" />
                - B
              </span>

              <Tooltip content="网络连接状态: 尚未发送请求" delayMs={400}>
                <div className="p-1 text-gray-600 cursor-default" aria-label="网络状态">
                  <Globe className="w-3.5 h-3.5" />
                </div>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-3 bg-surface">
        {/* 1. 实时响应 (Live Response Body) */}
        {activeTab === 'body' && (
          streamingBodySlot ? (
            <div className="h-full flex flex-col -m-3">
              {streamingBodySlot}
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center p-6 select-none">
              <div className="flex flex-col items-center gap-3.5 px-8 py-6 rounded-2xl bg-subtle/40 border border-line shadow-xs text-center max-w-xs w-full animate-in fade-in zoom-in-95 duration-200">
                {/* 动态进行中指示器 */}
                <div className="relative flex items-center justify-center w-10 h-10">
                  <div className="w-10 h-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse absolute" />
                </div>

                {/* 状态信息与耗时 */}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-foreground tracking-wide flex items-center justify-center gap-1.5">
                    <span>请求进行中</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span>已耗时 {elapsedSec.toFixed(1)}s</span>
                  </div>
                </div>

                {/* 取消请求按钮 (参考开源常用样式: 极简边框按钮，Hover 平滑微红) */}
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="mt-1 px-4 py-1.5 rounded-lg bg-surface hover:bg-rose-500/10 text-gray-300 hover:text-rose-400 border border-line hover:border-rose-500/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs group"
                    title="取消本次请求"
                  >
                    <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                    <span>取消请求</span>
                  </button>
                )}
              </div>
            </div>
          ) : !response ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 select-none py-12">
              <div className="w-12 h-12 rounded-xl bg-subtle border border-line flex items-center justify-center text-gray-400">
                <Code2 className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="text-center space-y-1">
                <div className="text-xs font-semibold text-gray-300">
                  点击上方「发送」按钮，即可在此查看实时响应
                </div>
                <div className="text-[11px] text-gray-500">
                  支持快速解析 Header、Cookie、耗时与各类数据格式
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Body Mode Selector & Tools Toolbar */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center bg-subtle border border-line rounded p-0.5 text-xs">
                  <button
                    onClick={() => setBodyMode('pretty')}
                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition ${
                      bodyMode === 'pretty'
                        ? 'bg-accent text-white font-medium'
                        : 'text-gray-400 hover:text-foreground'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Pretty</span>
                  </button>
                  <button
                    onClick={() => setBodyMode('raw')}
                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition ${
                      bodyMode === 'raw'
                        ? 'bg-accent text-white font-medium'
                        : 'text-gray-400 hover:text-foreground'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>Raw</span>
                  </button>
                  <button
                    onClick={() => setBodyMode('preview')}
                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition ${
                      bodyMode === 'preview'
                        ? 'bg-accent text-white font-medium'
                        : 'text-gray-400 hover:text-foreground'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>

                {bodyMode === 'preview' && (
                  <div className="flex items-center gap-2">
                    <Tooltip content={copied ? '已复制响应内容' : '复制响应内容'} delayMs={400}>
                      <button
                        onClick={handleCopy}
                        className="p-1 rounded bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground transition"
                        aria-label="复制"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Viewer Body */}
              <div className="flex-1 min-h-0 border border-line rounded-lg bg-surface overflow-hidden flex flex-col font-mono text-xs">
                {response.statusText === 'Canceled' || response.error === '请求已被手动取消' ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 select-none p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                      <XCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-200">请求已手动取消</div>
                      <div className="text-xs text-gray-400">
                        已终止本次连接，等待耗时 {response.timeMs}ms
                      </div>
                    </div>
                  </div>
                ) : response.error ? (
                  <div className="p-3 text-rose-400 whitespace-pre-wrap overflow-auto">{response.error}</div>
                ) : bodyMode === 'pretty' ? (
                  <JsonCodeEditor
                    value={prettyJsonText}
                    readOnly={true}
                    defaultView="code"
                    className="h-full border-none rounded-none"
                  />
                ) : bodyMode === 'raw' ? (
                  <JsonCodeEditor
                    value={response.rawText || ''}
                    readOnly={true}
                    defaultView="code"
                    className="h-full border-none rounded-none"
                  />
                ) : (
                  <iframe
                    srcDoc={response.rawText}
                    sandbox="allow-same-origin"
                    className="w-full h-full bg-white rounded"
                    title="HTML Preview"
                  />
                )}
              </div>
            </div>
          )
        )}

        {/* 2. 实际请求 */}
        {activeTab === 'actual' && (
          <div className="space-y-4 text-xs">
            {/* Section 1: 请求URL */}
            <div className="space-y-1.5">
              <div className="font-semibold text-gray-300 text-xs">请求URL</div>
              <div className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-2">
                <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {actualReq?.method || activeApi?.method || 'POST'}
                </span>
                <span className="font-mono text-gray-200 select-all flex-1 truncate">
                  {actualReq?.fullUrl || actualReq?.url || activeApi?.url || ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      actualReq?.fullUrl || actualReq?.url || activeApi?.url || ''
                    );
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="p-1 text-gray-400 hover:text-foreground rounded"
                  title="复制完整请求 URL"
                >
                  {copiedUrl ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Section 2: 请求参数 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-300 text-xs">请求参数</div>
              </div>

              {/* Sub-tabs: Header, Query, Path, Body */}
              <div className="flex items-center justify-between border-b border-line pb-1">
                <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-line">
                  {(['headers', 'query', 'path', 'body'] as const).map((tab) => {
                    const labelMap = {
                      headers: 'Header',
                      query: 'Query',
                      path: 'Path',
                      body: 'Body',
                    };
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActualSubTab(tab)}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          actualSubTab === tab
                            ? 'bg-subtle text-foreground shadow-xs'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {labelMap[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* Copy table icon */}
                <Tooltip
                  content={copiedActualTable ? '已复制参数' : '复制当前参数表格'}
                  delayMs={300}
                >
                  <button
                    type="button"
                    onClick={handleCopyActualTable}
                    className="p-1.5 rounded-lg bg-surface hover:bg-hover border border-line text-gray-400 hover:text-foreground transition"
                  >
                    {copiedActualTable ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <TableIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                </Tooltip>
              </div>

              {/* Sub-tab Table Render */}
              <div className="border border-line rounded-lg overflow-hidden bg-subtle">
                {actualSubTab === 'headers' && (
                  <div>
                    <div className="grid grid-cols-[220px_1fr] bg-subtle border-b border-line font-semibold py-1.5 px-3 text-gray-400">
                      <div>参数名</div>
                      <div>参数值</div>
                    </div>
                    <div className="divide-y divide-line">
                      {Object.keys(actualHeaders).length === 0 ? (
                        <div className="py-6 text-center text-gray-500">
                          {actualReq ? '无发送 Header 参数' : '尚未发送请求，发送后可查看实际请求 Header'}
                        </div>
                      ) : (
                        Object.entries(actualHeaders).map(([k, v]) => (
                          <div
                            key={k}
                            className="grid grid-cols-[220px_1fr] py-1.5 px-3 hover:bg-hover/40 font-mono text-xs"
                          >
                            <div className="text-gray-300 font-medium select-all">{k}</div>
                            <div className="text-gray-400 select-all break-all">{v}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {actualSubTab === 'query' && (
                  <div>
                    <div className="grid grid-cols-[220px_1fr] bg-subtle border-b border-line font-semibold py-1.5 px-3 text-gray-400">
                      <div>参数名</div>
                      <div>参数值</div>
                    </div>
                    <div className="divide-y divide-line">
                      {Object.keys(actualQuery).length === 0 ? (
                        <div className="py-6 text-center text-gray-500">
                          {actualReq ? '无发送 Query 参数' : '尚未发送请求，发送后可查看实际 Query 参数'}
                        </div>
                      ) : (
                        Object.entries(actualQuery).map(([k, v]) => (
                          <div
                            key={k}
                            className="grid grid-cols-[220px_1fr] py-1.5 px-3 hover:bg-hover/40 font-mono text-xs"
                          >
                            <div className="text-gray-300 font-medium select-all">{k}</div>
                            <div className="text-gray-400 select-all break-all">{v}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {actualSubTab === 'path' && (
                  <div>
                    <div className="grid grid-cols-[220px_1fr] bg-subtle border-b border-line font-semibold py-1.5 px-3 text-gray-400">
                      <div>参数名</div>
                      <div>参数值</div>
                    </div>
                    <div className="divide-y divide-line">
                      {Object.keys(actualPath).length === 0 ? (
                        <div className="py-6 text-center text-gray-500">
                          {actualReq ? '无 Path 路径参数' : '尚未发送请求，发送后可查看实际 Path 参数'}
                        </div>
                      ) : (
                        Object.entries(actualPath).map(([k, v]) => (
                          <div
                            key={k}
                            className="grid grid-cols-[220px_1fr] py-1.5 px-3 hover:bg-hover/40 font-mono text-xs"
                          >
                            <div className="text-gray-300 font-medium select-all">{k}</div>
                            <div className="text-gray-400 select-all break-all">{v}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {actualSubTab === 'body' && (
                  <div className="p-3">
                    {Object.keys(actualForm).length > 0 ? (
                      <div className="divide-y divide-line">
                        <div className="grid grid-cols-[200px_100px_1fr] font-semibold pb-1.5 text-gray-400">
                          <div>参数名</div>
                          <div>类型</div>
                          <div>参数值</div>
                        </div>
                        {Object.entries(actualForm).map(([k, f]) => (
                          <div
                            key={k}
                            className="grid grid-cols-[200px_100px_1fr] py-1.5 hover:bg-hover/40 font-mono text-xs items-center"
                          >
                            <div className="text-gray-200">{k}</div>
                            <div className="text-amber-400 text-[11px]">{f.type}</div>
                            <div className="text-gray-400 truncate" title={f.value}>
                              {f.fileName ? `📁 ${f.fileName} (${f.value})` : f.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : actualReq?.bodyData !== undefined && actualReq?.bodyData !== '' ? (
                      <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap leading-relaxed select-all">
                        {actualReq.bodyData}
                      </pre>
                    ) : actualReq?.bodyMode === 'raw' ? (
                      <pre className="font-mono text-xs text-gray-400 whitespace-pre-wrap leading-relaxed select-all italic">
                        {actualReq?.bodyData || '<空请求体>'}
                      </pre>
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        {actualReq
                          ? `本次请求无 Body 载荷参数 (mode: ${actualReq?.bodyMode || 'none'})`
                          : '尚未发送请求，发送后可查看实际 Body 载荷'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. 响应头 (Headers) */}
        {activeTab === 'headers' && (
          <div className="border border-line rounded-lg overflow-hidden bg-surface text-xs">
            <div className="grid grid-cols-[220px_1fr] bg-subtle border-b border-line font-semibold py-2 px-3 text-gray-400">
              <div>Header 字段</div>
              <div>值 (Value)</div>
            </div>
            <div className="divide-y divide-line">
              {headersCount === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  {isStreaming
                    ? '尚未连接或服务器未返回响应头'
                    : response
                    ? '无返回 Header 参数'
                    : '暂无响应头数据，请发送请求后查看'}
                </div>
              ) : (
                Object.entries(response?.headers || {}).map(([k, v]) => (
                  <div
                    key={k}
                    className="grid grid-cols-[220px_1fr] py-1.5 px-3 hover:bg-hover/50"
                  >
                    <div className="font-mono text-accent select-all">{k}</div>
                    <div className="font-mono text-gray-300 break-all select-all">{v}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. Cookie */}
        {activeTab === 'cookies' && (
          <div className="border border-line rounded-lg overflow-hidden bg-surface text-xs">
            {cookiesList.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                {response ? '本次请求未包含 Set-Cookie 响应头' : '暂无 Cookie 数据，请发送请求后查看'}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[160px_180px_120px_100px_120px] bg-subtle border-b border-line font-semibold py-2 px-3 text-gray-400">
                  <div>Cookie 名</div>
                  <div>Cookie 值</div>
                  <div>域名 (Domain)</div>
                  <div>路径 (Path)</div>
                  <div>过期时间 (Expires)</div>
                </div>
                <div className="divide-y divide-line">
                  {cookiesList.map((ck, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[160px_180px_120px_100px_120px] py-1.5 px-3 hover:bg-hover/50 font-mono text-[11px]"
                    >
                      <div className="text-amber-400 font-medium select-all">{ck.name}</div>
                      <div className="text-gray-300 select-all truncate" title={ck.value}>
                        {ck.value}
                      </div>
                      <div className="text-gray-400">{ck.domain || '-'}</div>
                      <div className="text-gray-400">{ck.path || '/'}</div>
                      <div className="text-gray-400">{ck.expires || 'Session'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 控制台与请求排查日志 (Console & Request Diagnostics) */}
        {activeTab === 'console' && (
          <div className="flex flex-col h-full border border-line rounded-lg bg-surface overflow-hidden">
            <div className="px-3 py-2 bg-subtle border-b border-line flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2 text-gray-300 font-medium">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>控制台与请求排查日志</span>
                {response?.logs && response.logs.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-surface border border-line text-[10px] text-gray-400 font-mono">
                    {response.logs.length} 条
                  </span>
                )}
              </div>
              {response?.logs && response.logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(response.logs!.join('\n'));
                    setCopiedLogs(true);
                    setTimeout(() => setCopiedLogs(false), 2000);
                  }}
                  className="px-2 py-1 rounded bg-surface hover:bg-hover border border-line text-[11px] text-gray-300 hover:text-foreground flex items-center gap-1 transition"
                  title="复制全部日志"
                >
                  {copiedLogs ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制全部日志</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-3 font-mono text-xs space-y-1.5 bg-surface">
              {!response?.logs || response.logs.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  {response
                    ? '本次请求未产生额外的控制台打印日志'
                    : '暂无控制台日志，发送请求或执行脚本后在此查看详细排查信息'}
                </div>
              ) : (
                response.logs.map((log, idx) => {
                  const isError = log.includes('[ERROR]') || log.includes('[ERROR-');
                  const isReq = log.includes('[REQ]') || log.includes('[REQ-');
                  const isRes = log.includes('[RES]') || log.includes('[RES-');
                  const isScript = log.includes('[PRE-SCRIPT]') || log.includes('[POST-SCRIPT]');

                  let rowStyle = 'text-gray-300 hover:bg-hover/30';
                  if (isError) {
                    rowStyle = 'text-rose-400 bg-rose-500/10 border-l-2 border-rose-500 pl-2 font-semibold';
                  } else if (isReq) {
                    rowStyle = 'text-sky-300 bg-sky-500/5 border-l-2 border-sky-500/60 pl-2';
                  } else if (isRes) {
                    rowStyle = 'text-emerald-300 bg-emerald-500/5 border-l-2 border-emerald-500/60 pl-2';
                  } else if (isScript) {
                    rowStyle = 'text-amber-300 bg-amber-500/5 border-l-2 border-amber-500/60 pl-2';
                  }

                  return (
                    <div
                      key={idx}
                      className={`leading-relaxed py-1 rounded px-1 transition ${rowStyle} select-text break-all whitespace-pre-wrap`}
                    >
                      <span className="text-gray-500 mr-2 select-none text-[11px]">[{idx + 1}]</span>
                      <span>{log}</span>
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
