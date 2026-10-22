import React, { useState, useEffect } from 'react';
import {
  Send,
  Save,
  Copy,
  Check,
  Sparkles,
  Code2,
  FileText,
  ChevronDown,
  Minimize2,
  BookmarkPlus,
  Share2,
  Variable,
  Plus,
  Trash2,
  Layers,
  FileCode,
  X,
} from 'lucide-react';
import { ApiDetail, ApiTreeNode, HttpMethod, HttpResponseResult, ResponseExample } from '../../../common/types';
import { ParamUtils } from '../../../common/paramUtils';
import { UrlUtils } from '../../../common/urlUtils';
import { DataImporters } from '../../../common/importers';
import { KeyValueTable } from './KeyValueTable';
import { VisualFieldModal } from './VisualFieldModal';
import { JsonCodeEditor } from './JsonCodeEditor';
import { ResponseViewer } from './ResponseViewer';
import { Tooltip } from './Tooltip';
import { CodeDrawer } from './CodeDrawer';
import { DocPreview } from './DocPreview';
import { VariableInput, VariableItem } from './VariableInput';
import { useFeedback } from './FeedbackContext';

interface ApiWorkbenchProps {
  api: ApiDetail;
  onChange: (updated: ApiDetail) => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onOpenShare?: () => void;
  isDirty?: boolean;
  onSend: (api: ApiDetail, requestId?: string) => Promise<HttpResponseResult>;
  cachedResponse?: HttpResponseResult | null;
  onResponseChange?: (res: HttpResponseResult | null) => void;
  preUrl?: string;
  availableVars?: Record<string, VariableItem>;
  onExtractVariable?: (key: string, value: string) => void;
  treeItems?: ApiTreeNode[];
  folderDetails?: Record<string, any>;
}


export const ApiWorkbench: React.FC<ApiWorkbenchProps> = ({
  api,
  onChange,
  onSave,
  onSaveAs,
  onOpenShare,
  isDirty = false,
  onSend,
  cachedResponse = null,
  onResponseChange,
  preUrl = '',
  availableVars = {},
  onExtractVariable,
  treeItems = [],
  folderDetails = {},
}) => {
  const { toast } = useFeedback();
  const [activeReqTab, setActiveReqTab] = useState<
    'header' | 'query' | 'path' | 'body' | 'auth' | 'cookie' | 'pre' | 'tests'
  >('body');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HttpResponseResult | null>(cachedResponse || null);
  const reqSeqRef = React.useRef(0);
  const activeRequestIdRef = React.useRef<string | null>(null);
  const reqStartTimeRef = React.useRef<number>(0);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isVarMenuOpen, setIsVarMenuOpen] = useState(false);
  const [isVisualModalOpen, setIsVisualModalOpen] = useState(false);

  const examples: ResponseExample[] = api.response?.example || [];

  // Compute all implicit / inherited parameters from parent folders, Auth, and system defaults
  const { headers: inheritedHeaders, query: inheritedQuery } = React.useMemo(() => {
    return ParamUtils.computeImplicitParams(api, treeItems, folderDetails);
  }, [api, treeItems, folderDetails]);

  // Advanced feature drawer & modes
  const [isDocMode, setIsDocMode] = useState(false);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);

  // Vertical split resizer state
  const [reqHeightPercent, setReqHeightPercent] = useState<number>(45);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const splitRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const totalH = rect.height;
      if (totalH > 0) {
        const percent = Math.min(Math.max((relativeY / totalH) * 100, 15), 85);
        setReqHeightPercent(percent);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const cachedResponseRef = React.useRef(cachedResponse);
  cachedResponseRef.current = cachedResponse;

  // When switching between APIs, restore cached response if present or reset
  useEffect(() => {
    reqSeqRef.current++;
    setResponse(cachedResponseRef.current || null);
    setLoading(false);
  }, [api.target_id]);

  // Safe fallback normalization for request
  const req = {
    query: api.request?.query || { parameter: [] },
    path: api.request?.path || { parameter: [] },
    header: api.request?.header || { parameter: [] },
    cookie: api.request?.cookie || { parameter: [] },
    body: api.request?.body || { mode: 'form-data' },
    auth: api.request?.auth || { type: 'none' },
    pre_tasks: api.request?.pre_tasks || [],
    post_tasks: api.request?.post_tasks || [],
  };

  const updateReq = (patch: Partial<typeof req>) => {
    onChange({
      ...api,
      request: {
        ...req,
        ...patch,
      },
    });
  };


  // Synchronize path params on initial load/mount if URL has path variables
  useEffect(() => {
    if (api?.url && (!api.request?.path?.parameter || api.request.path.parameter.length === 0)) {
      const extracted = UrlUtils.extractPathParams(api.url, []);
      if (extracted.length > 0) {
        onChange({
          ...api,
          request: {
            ...(api.request || req),
            path: { parameter: extracted },
          },
        });
      }
    }
  }, [api?.target_id]);

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

    const { queryParams } = UrlUtils.syncUrlToParams(newUrl, req.query?.parameter || []);
    const pathParams = UrlUtils.extractPathParams(newUrl, req.path?.parameter || []);

    onChange({
      ...api,
      url: newUrl,
      request: {
        ...req,
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

  // Query parameter table update with automatic Params -> URL sync
  const handleQueryParamsChange = (parameter: any[]) => {
    const newUrl = UrlUtils.syncParamsToUrl(api.url || '', parameter);
    onChange({
      ...api,
      url: newUrl,
      request: {
        ...req,
        query: { parameter },
      },
    });
  };

  // Path parameter table update with automatic Params -> URL sync
  const handlePathParamsChange = (parameter: any[]) => {
    const newUrl = UrlUtils.syncPathParamsToUrl(api.url || '', parameter, req.path?.parameter || []);
    onChange({
      ...api,
      url: newUrl,
      request: {
        ...req,
        path: { parameter },
      },
    });
  };

  const handleSend = async () => {
    if (loading) return;
    reqSeqRef.current += 1;
    const thisReqId = reqSeqRef.current;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeRequestIdRef.current = requestId;
    reqStartTimeRef.current = performance.now();

    // Clear previous response immediately so only new request data is shown
    setResponse(null);
    onResponseChange?.(null);
    setLoading(true);
    try {
      const res = await onSend({ ...api, request: req }, requestId);
      if (reqSeqRef.current === thisReqId) {
        setResponse(res);
        onResponseChange?.(res);
      }
    } catch (err: any) {
      if (reqSeqRef.current === thisReqId) {
        const errorRes: HttpResponseResult = {
          statusCode: 0,
          statusText: 'Error',
          timeMs: Math.round(performance.now() - reqStartTimeRef.current),
          sizeBytes: 0,
          headers: {},
          cookies: [],
          data: null,
          rawText: '',
          error: err.message || '请求执行失败',
          logs: [`[${new Date().toLocaleTimeString()}] [ERROR] ${err.message || '请求执行失败'}`],
        };
        setResponse(errorRes);
        onResponseChange?.(errorRes);
      }
    } finally {
      if (reqSeqRef.current === thisReqId) {
        setLoading(false);
        activeRequestIdRef.current = null;
      }
    }
  };

  const handleCancel = async () => {
    if (!loading) return;
    const reqId = activeRequestIdRef.current;
    reqSeqRef.current += 1;
    setLoading(false);
    activeRequestIdRef.current = null;
    const durationMs = Math.round(performance.now() - reqStartTimeRef.current);
    const cancelRes: HttpResponseResult = {
      statusCode: 0,
      statusText: 'Canceled',
      timeMs: durationMs,
      sizeBytes: 0,
      headers: {},
      cookies: [],
      data: null,
      rawText: '',
      error: '请求已被手动取消',
      logs: [
        ...(response?.logs || []),
        `[${new Date().toLocaleTimeString()}] [CANCEL] 用户手动取消了本次请求 (等待耗时: ${durationMs}ms)`,
      ],
    };
    setResponse(cancelRes);
    onResponseChange?.(cancelRes);
    if (reqId && window.mypostAPI?.cancelRequest) {
      try {
        await window.mypostAPI.cancelRequest(reqId);
      } catch (err) {
        console.error('Failed to cancel request:', err);
      }
    }
  };

  const handleCopyCurl = () => {
    const method = api.method || 'GET';
    let curl = `curl -X ${method} "${api.url}"`;
    if (req.header?.parameter) {
      for (const h of req.header.parameter) {
        if (h.is_checked === 1 && h.key) {
          curl += ` \\\n  -H "${h.key}: ${h.value}"`;
        }
      }
    }
    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body?.raw) {
      curl += ` \\\n  -d '${req.body.raw.replace(/'/g, "'\\''")}'`;
    }
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
    toast.success('已复制 cURL 命令行');
  };

  const formatJsonBody = () => {
    try {
      const parsed = JSON.parse(req.body?.raw || '{}');
      const pretty = JSON.stringify(parsed, null, 2);
      updateReq({
        body: {
          ...req.body,
          raw: pretty,
        },
      });
      toast.info('JSON 已格式化');
    } catch {
      toast.error('JSON 语法错误，无法格式化');
    }
  };

  const handleBodyModeChange = (mode: 'none' | 'form-data' | 'urlencoded' | 'binary' | 'msgpack' | 'raw') => {
    let targetRaw = req.body?.raw;
    if (mode === 'raw') {
      const sub = req.body?.raw_type || 'json';
      if (sub === 'json') {
        targetRaw = req.body?.raw_json ?? req.body?.raw ?? '{\n  \n}';
      } else if (sub === 'xml') {
        targetRaw = req.body?.raw_xml ?? '';
      } else {
        targetRaw = req.body?.raw_text ?? '';
      }
    } else if (mode === 'msgpack') {
      targetRaw = req.body?.msgpack_raw ?? (req.body?.mode === 'msgpack' ? req.body?.raw : '') ?? '{\n  \n}';
    } else if (mode === 'binary') {
      targetRaw = req.body?.binary_file ?? (req.body?.mode === 'binary' ? req.body?.raw : '') ?? '';
    }

    updateReq({
      body: {
        ...req.body,
        mode: mode as any,
        raw: targetRaw,
        raw_type: req.body?.raw_type || 'json',
      },
    });
  };

  const handleRawTypeChange = (newRawType: 'json' | 'xml' | 'text') => {
    const currentSub = req.body?.raw_type || 'json';
    const currentRaw = req.body?.raw || '';
    const updatedSlots: Record<string, string> = {};
    if (currentSub === 'json') updatedSlots.raw_json = currentRaw;
    else if (currentSub === 'xml') updatedSlots.raw_xml = currentRaw;
    else if (currentSub === 'text') updatedSlots.raw_text = currentRaw;

    let nextRaw = '';
    if (newRawType === 'json') {
      nextRaw = req.body?.raw_json ?? (currentSub === 'json' ? currentRaw : '{\n  \n}');
    } else if (newRawType === 'xml') {
      nextRaw = req.body?.raw_xml ?? (currentSub === 'xml' ? currentRaw : '');
    } else {
      nextRaw = req.body?.raw_text ?? (currentSub === 'text' ? currentRaw : '');
    }

    updateReq({
      body: {
        ...req.body,
        ...updatedSlots,
        mode: 'raw',
        raw_type: newRawType,
        raw: nextRaw,
      },
    });
  };

  const formatXmlBody = () => {
    const content = req.body?.raw_xml ?? req.body?.raw ?? '';
    if (!content.trim()) return;
    try {
      let formatted = '';
      let indent = 0;
      const tab = '  ';
      content.split(/>\s*</).forEach((element) => {
        if (element.match(/^\/\w/)) {
          indent = Math.max(0, indent - 1);
        }
        const cleanElem = element.replace(/^</, '').replace(/>$/, '');
        formatted += `${tab.repeat(indent)}<${cleanElem}>\n`;
        if (
          cleanElem.match(/^<?\w[^>]*[^\/]$/) &&
          !cleanElem.startsWith('?') &&
          !cleanElem.startsWith('!')
        ) {
          indent += 1;
        }
      });
      const trimmed = formatted.trim();
      updateReq({
        body: {
          ...req.body,
          raw: trimmed,
          raw_xml: trimmed,
        },
      });
      toast.info('XML 已格式化');
    } catch {
      toast.error('XML 格式化异常');
    }
  };

  const insertVarIntoBody = (varKey: string) => {
    const placeholder = `{{${varKey}}}`;
    const cur = req.body?.raw || '';
    const updated = cur + (cur ? ' ' : '') + placeholder;
    const isXml = req.body?.raw_type === 'xml';
    const isJson = req.body?.raw_type === 'json' || !req.body?.raw_type;
    const isMsgpack = req.body?.mode === 'msgpack';

    updateReq({
      body: {
        ...req.body,
        raw: updated,
        ...(isMsgpack
          ? { msgpack_raw: updated }
          : isJson
          ? { raw_json: updated }
          : isXml
          ? { raw_xml: updated }
          : { raw_text: updated }),
      },
    });
    setIsVarMenuOpen(false);
    toast.success(`已插入占位符 ${placeholder}`);
  };

  const insertPreScriptSnippet = (snippet: string) => {
    const old = req.pre_tasks?.[0]?.script || '';
    const newScript = old ? `${old}\n${snippet}` : snippet;
    updateReq({
      pre_tasks: [{ type: 'script', script: newScript }],
    });
  };

  const insertTestSnippet = (snippet: string) => {
    const old = req.post_tasks?.[0]?.script || '';
    const newScript = old ? `${old}\n${snippet}` : snippet;
    updateReq({
      post_tasks: [{ type: 'script', script: newScript }],
    });
  };



  const methodColors: Record<HttpMethod, string> = {
    GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    POST: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    PUT: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    HEAD: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    OPTIONS: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  if (isDocMode) {
    return (
      <DocPreview
        api={api}
        onBackToDebug={() => setIsDocMode(false)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden relative">
      {/* Top Bar: Name, Status Badge, Action Buttons */}
      <div className="h-11 px-4 border-b border-line flex items-center justify-between bg-subtle">
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
            placeholder="接口名称"
            className="bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent px-2 py-0.5 rounded flex-1"
          />
        </div>

        {/* Right side: Only Code2 button */}
        <div className="flex items-center gap-1.5">
          <Tooltip
            content={isCodeDrawerOpen ? '收起代码侧边栏' : '生成多语言代码 (右侧抽屉)'}
            delayMs={400}
          >
            <button
              onClick={() => setIsCodeDrawerOpen(!isCodeDrawerOpen)}
              className={`p-1.5 rounded-lg border transition ${
                isCodeDrawerOpen
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                  : 'bg-subtle hover:bg-hover border-line text-indigo-400 hover:text-indigo-300'
              }`}
              aria-label="生成代码"
            >
              <Code2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Workbench Body */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

      {/* URL & Send Bar */}
      <div className="p-3 bg-surface border-b border-line flex items-center gap-2">
        {/* Method Select (No arrow, unified style, no text truncation) */}
        <select
          value={api.method || 'GET'}
          onChange={(e) => onChange({ ...api, method: e.target.value as HttpMethod })}
          className={`h-9 w-[86px] px-1 rounded-lg font-bold font-mono text-xs border appearance-none text-center focus:outline-none focus:ring-1 focus:ring-accent transition cursor-pointer shrink-0 select-none ${
            methodColors[api.method] || 'text-gray-300 bg-subtle border-line'
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

        {/* URL Input with Variable Placeholder Replacement, Candidates & Highlight */}
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
                handleSend();
              }
            }}
            placeholder="输入请求路径或粘贴 cURL 命令行直接解析，支持 {{baseUrl}} 变量"
            className="w-full bg-transparent border-none text-xs text-gray-100 placeholder-gray-500 font-mono focus:outline-none"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={loading}
          className="h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-accent/10 shrink-0"
          title="发送请求"
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{loading ? '发送中' : '发送'}</span>
        </button>

        {/* Save Button (References Send button style: same h-9, px-4, text-xs font-bold, gap-2, rounded-lg, but no color fill / transparent bg with border) */}
        <button
          onClick={onSave}
          className={`h-9 px-4 rounded-lg border bg-transparent hover:bg-hover font-bold text-xs flex items-center gap-2 transition shrink-0 select-none ${
            isDirty
              ? 'border-accent text-accent hover:bg-accent/10 shadow-sm'
              : 'border-line hover:border-gray-400/60 text-foreground'
          }`}
          title="保存接口修改 (Ctrl+S)"
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

      {/* Resizable Request & Response Split Workspace */}
      <div
        ref={splitRef}
        className={`flex-1 flex flex-col overflow-hidden min-h-0 relative ${
          isDragging ? 'select-none' : ''
        }`}
      >
        {/* Upper Area: Request Configuration (Vertically Resizable) */}
        <div
          style={{ height: `${reqHeightPercent}%` }}
          className="flex flex-col border-b border-line bg-surface overflow-hidden min-h-[90px]"
        >
        {/* Request Tabs: Header, Query, Path, Body, 认证, Cookie, 预执行操作, 后执行操作 */}
        <div className="h-9 px-3 bg-subtle border-b border-line flex items-center gap-1 text-xs select-none overflow-x-auto">
          <button
            onClick={() => setActiveReqTab('header')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'header'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            Header
            {(req.header?.parameter || []).filter((h) => h.is_checked === 1 && h.key).length > 0 && (
              <span className="ml-1 px-1 rounded-full text-[10px] bg-subtle text-accent">
                {(req.header?.parameter || []).filter((h) => h.is_checked === 1 && h.key).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveReqTab('query')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'query'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            Query
            {(req.query?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length > 0 && (
              <span className="ml-1 px-1 rounded-full text-[10px] bg-subtle text-accent">
                {(req.query?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveReqTab('path')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'path'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            Path
            {(req.path?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length > 0 && (
              <span className="ml-1 px-1 rounded-full text-[10px] bg-subtle text-accent">
                {(req.path?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveReqTab('body')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'body'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            Body
            {req.body?.mode && req.body.mode !== 'none' && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-subtle text-gray-300">
                {req.body.mode}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveReqTab('auth')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'auth'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            认证
            {req.auth?.type && req.auth.type !== 'none' && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
            )}
          </button>

          <button
            onClick={() => setActiveReqTab('cookie')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'cookie'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            Cookie
            {(req.cookie?.parameter || []).filter((c) => c.is_checked === 1 && c.key).length > 0 && (
              <span className="ml-1 px-1 rounded-full text-[10px] bg-subtle text-accent">
                {(req.cookie?.parameter || []).filter((c) => c.is_checked === 1 && c.key).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveReqTab('pre')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'pre'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            预执行操作
          </button>

          <button
            onClick={() => setActiveReqTab('tests')}
            className={`px-3 py-1 rounded-md transition font-medium ${
              activeReqTab === 'tests'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:text-foreground'
            }`}
          >
            后执行操作
          </button>
        </div>

        {/* Tab Panels */}
        <div className="flex-1 p-3 overflow-y-auto">
          {activeReqTab === 'header' && (
            <KeyValueTable
              items={req.header?.parameter || []}
              onChange={(parameter) =>
                updateReq({
                  header: {
                    ...req.header,
                    parameter,
                  },
                })
              }
              inheritedItems={inheritedHeaders}
              availableVars={availableVars}
              allowFile={false}
              showType={false}
              showContentType={false}
              showRequired={true}
              keyPlaceholder="参数名 (Header Key)"
              valuePlaceholder="参数值"
            />
          )}

          {activeReqTab === 'query' && (
            <KeyValueTable
              items={req.query?.parameter || []}
              onChange={handleQueryParamsChange}
              inheritedItems={inheritedQuery}
              availableVars={availableVars}
              allowFile={false}
              showType={true}
              showContentType={false}
              showRequired={true}
              keyPlaceholder="参数名"
              valuePlaceholder="参数值"
            />
          )}

          {activeReqTab === 'path' && (
            <KeyValueTable
              items={req.path?.parameter || []}
              onChange={handlePathParamsChange}
              availableVars={availableVars}
              allowFile={false}
              showType={false}
              showContentType={false}
              showRequired={false}
              keyPlaceholder="参数名 (:id 或 {id})"
              valuePlaceholder="参数值"
            />
          )}

          {activeReqTab === 'body' && (
            <div className="h-full flex flex-col space-y-2">
              {/* Body Mode Selector: none, form-data, urlencoded, binary, msgpack, raw */}
              <div className="flex items-center justify-between text-xs text-gray-300">
                <div className="flex items-center gap-3">
                  {(['none', 'form-data', 'urlencoded', 'binary', 'msgpack', 'raw'] as const).map(
                    (mode) => {
                      const isSelected =
                        req.body?.mode === mode || (mode === 'raw' && req.body?.mode === 'json');
                      return (
                        <div key={mode} className="flex items-center gap-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="body_mode"
                              checked={isSelected}
                              onChange={() => handleBodyModeChange(mode)}
                              className="accent-accent"
                            />
                            <span
                              className={
                                isSelected ? 'text-accent font-medium' : 'text-gray-400'
                              }
                            >
                              {mode}
                            </span>
                          </label>

                          {/* When raw is selected, show sub-type dropdown: JSON / XML / Text(txt) */}
                          {mode === 'raw' && isSelected && (
                            <div className="flex items-center gap-2 ml-0.5">
                              <div className="relative shrink-0 flex items-center">
                                <select
                                  value={req.body?.raw_type || (req.body?.mode === 'json' ? 'json' : 'json')}
                                  onChange={(e) => handleRawTypeChange(e.target.value as 'json' | 'xml' | 'text')}
                                  className="appearance-none bg-subtle hover:bg-hover border border-accent/40 text-accent font-mono text-[11px] font-semibold pl-2 pr-5 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent transition"
                                  title="选择 Raw 编辑类型 (JSON / XML / Text)"
                                >
                                  <option value="json" className="bg-subtle text-gray-200">
                                    JSON
                                  </option>
                                  <option value="xml" className="bg-subtle text-gray-200">
                                    XML
                                  </option>
                                  <option value="text" className="bg-subtle text-gray-200">
                                    Text (txt)
                                  </option>
                                </select>
                                <ChevronDown className="w-2.5 h-2.5 text-accent opacity-70 absolute right-1.5 pointer-events-none" />
                              </div>

                              {/* Visual Field Editor Modal Trigger for JSON and XML */}
                              {((req.body?.raw_type || (req.body?.mode === 'json' ? 'json' : 'json')) === 'json' ||
                                req.body?.raw_type === 'xml') && (
                                <button
                                  type="button"
                                  onClick={() => setIsVisualModalOpen(true)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-accent/40 hover:border-accent text-amber-400 hover:text-amber-300 transition text-[11px] font-medium shadow-sm ml-1"
                                  title="弹窗打开可视化字段编辑"
                                >
                                  <Layers className="w-3.5 h-3.5 text-accent" />
                                  <span>可视化编辑</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>

                {(req.body?.mode === 'json' || req.body?.mode === 'raw' || req.body?.mode === 'msgpack') && (
                  <div className="flex items-center gap-2">
                    {/* Insert Variable helper */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsVarMenuOpen(!isVarMenuOpen)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-subtle hover:bg-hover text-[11px] text-amber-300 border border-amber-500/20"
                      >
                        <Variable className="w-3 h-3 text-accent" />
                        <span>+ 插入变量 (&#123;&#123;&#125;&#125;)</span>
                      </button>
                      {isVarMenuOpen && (
                        <div className="absolute right-0 top-7 z-30 bg-surface border border-line rounded-xl shadow-2xl py-1 w-52 max-h-48 overflow-y-auto">
                          {Object.keys(availableVars).length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-gray-500 italic">当前环境暂无配置变量</div>
                          ) : (
                            Object.entries(availableVars).map(([key, item]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => insertVarIntoBody(key)}
                                className="w-full text-left px-3 py-1.5 hover:bg-hover text-xs flex items-center justify-between transition"
                              >
                                <span className="font-mono text-amber-300 font-bold">&#123;&#123;{key}&#125;&#125;</span>
                                <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{item.value}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Format XML button only when in XML mode (JSON formatting is handled directly by JsonCodeEditor) */}
                    {req.body?.mode === 'raw' && req.body?.raw_type === 'xml' && (
                      <button
                        onClick={formatXmlBody}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-subtle hover:bg-hover text-[11px] text-gray-300 transition"
                        title="格式化 XML"
                      >
                        <Sparkles className="w-3 h-3 text-accent" />
                        <span>美化 XML</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Body Content Editor */}
              {req.body?.mode === 'none' && (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
                  此请求不携带任何 Body 载荷
                </div>
              )}

              {(req.body?.mode === 'json' || req.body?.mode === 'raw') && (
                <>
                  {(req.body?.raw_type === 'json' ||
                    (!req.body?.raw_type && req.body?.mode === 'json') ||
                    (!req.body?.raw_type && req.body?.mode === 'raw')) ? (
                    <div className="flex-1 min-h-0">
                      <JsonCodeEditor
                        value={req.body?.raw_json ?? req.body?.raw ?? ''}
                        onChange={(newVal) =>
                          updateReq({
                            body: {
                              ...req.body,
                              mode: 'raw',
                              raw_type: 'json',
                              raw: newVal,
                              raw_json: newVal,
                            },
                          })
                        }
                        placeholder={'{\n  "key": "value"\n}'}
                      />
                    </div>
                  ) : (
                    <textarea
                      value={
                        req.body?.raw_type === 'xml'
                          ? (req.body?.raw_xml ?? req.body?.raw ?? '')
                          : (req.body?.raw_text ?? req.body?.raw ?? '')
                      }
                      onChange={(e) => {
                        const newVal = e.target.value;
                        const isXml = req.body?.raw_type === 'xml';
                        updateReq({
                          body: {
                            ...req.body,
                            mode: 'raw',
                            raw_type: isXml ? 'xml' : 'text',
                            raw: newVal,
                            ...(isXml ? { raw_xml: newVal } : { raw_text: newVal }),
                          },
                        });
                      }}
                      placeholder={
                        req.body?.raw_type === 'xml'
                          ? '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <key>value</key>\n</root>'
                          : '输入纯文本内容 (Text / txt)...'
                      }
                      className="flex-1 w-full bg-surface border border-line rounded-lg p-3 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent resize-none leading-relaxed"
                    />
                  )}
                </>
              )}

              {req.body?.mode === 'form-data' && (
                <KeyValueTable
                  items={req.body.parameter || []}
                  onChange={(parameter) =>
                    updateReq({
                      body: {
                        ...req.body,
                        parameter,
                      },
                    })
                  }
                  availableVars={availableVars}
                  allowFile={true}
                  isFormData={true}
                  showContentType={true}
                  showType={true}
                  showRequired={true}
                  keyPlaceholder="参数名"
                  valuePlaceholder="参数值"
                />
              )}

              {req.body?.mode === 'urlencoded' && (
                <KeyValueTable
                  items={req.body.urlencoded || []}
                  onChange={(urlencoded) =>
                    updateReq({
                      body: {
                        ...req.body,
                        urlencoded,
                      },
                    })
                  }
                  availableVars={availableVars}
                  allowFile={false}
                  showContentType={false}
                  showType={false}
                  showRequired={true}
                  keyPlaceholder="参数名"
                  valuePlaceholder="参数值"
                />
              )}

              {req.body?.mode === 'binary' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-line rounded-lg bg-surface space-y-3">
                  <FileCode className="w-10 h-10 text-amber-400 stroke-1" />
                  <div className="text-gray-300 font-medium text-xs">
                    选择要作为 Binary 载荷发送的本地二进制文件
                  </div>
                  {(req.body.binary_file || (req.body.mode === 'binary' ? req.body.raw : '')) ? (
                    <div className="flex items-center gap-2 p-2 rounded bg-subtle border border-line text-xs font-mono">
                      <span className="text-gray-200">{req.body.binary_file || req.body.raw}</span>
                      <button
                        type="button"
                        onClick={() => updateReq({ body: { ...req.body, binary_file: '', raw: '' } })}
                        className="text-gray-400 hover:text-rose-400"
                        title="清除文件"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.mypostAPI?.openFileDialog) {
                          const res = await window.mypostAPI.openFileDialog();
                          if (res && res.filePath) {
                            updateReq({
                              body: {
                                ...req.body,
                                binary_file: res.filePath,
                                raw: res.filePath,
                              },
                            });
                          }
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-xs shadow-md transition"
                    >
                      选择本地文件
                    </button>
                  )}
                </div>
              )}

              {req.body?.mode === 'msgpack' && (
                <div className="flex-1 min-h-0 flex flex-col space-y-2">
                  <div className="text-[11px] text-gray-400 flex items-center justify-between px-1 shrink-0">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>编写 JSON 结构，发送请求时自动进行 MessagePack 二进制序列化</span>
                    </span>
                    <span className="font-mono text-gray-500 text-[10px]">Content-Type: application/msgpack</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <JsonCodeEditor
                      value={req.body?.msgpack_raw ?? (req.body?.mode === 'msgpack' ? req.body?.raw : '') ?? '{\n  \n}'}
                      onChange={(newVal) =>
                        updateReq({
                          body: {
                            ...req.body,
                            mode: 'msgpack',
                            msgpack_raw: newVal,
                            raw: newVal,
                          },
                        })
                      }
                      placeholder={'{\n  "key": "value"\n}'}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeReqTab === 'cookie' && (
            <KeyValueTable
              items={req.cookie?.parameter || []}
              onChange={(parameter) =>
                updateReq({
                  cookie: {
                    parameter,
                  },
                })
              }
              availableVars={availableVars}
              allowFile={false}
              showContentType={false}
              showType={false}
              showRequired={false}
              keyPlaceholder="Cookie 名"
              valuePlaceholder="Cookie 值"
            />
          )}

          {activeReqTab === 'auth' && (
            <div className="max-w-md space-y-4 text-xs text-gray-300">
              <div>
                <label className="block text-gray-400 mb-1">认证类型 (Auth Type)</label>
                <select
                  value={req.auth?.type || 'none'}
                  onChange={(e) =>
                    updateReq({
                      auth: {
                        ...req.auth,
                        type: e.target.value as any,
                      },
                    })
                  }
                  className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                >
                  <option value="none">No Auth (无需认证)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apikey">API Key</option>
                </select>
              </div>

              {req.auth?.type === 'bearer' && (
                <div>
                  <label className="block text-gray-400 mb-1">Token</label>
                  <VariableInput
                    value={req.auth.bearer?.token || ''}
                    onChange={(token) =>
                      updateReq({
                        auth: {
                          ...req.auth,
                          bearer: { token },
                        },
                      })
                    }
                    availableVars={availableVars}
                    placeholder="输入 Bearer Token，支持 {{token}} 变量"
                    className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 font-mono focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {req.auth?.type === 'basic' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 mb-1">用户名 (Username)</label>
                    <VariableInput
                      value={req.auth.basic?.username || ''}
                      onChange={(username) =>
                        updateReq({
                          auth: {
                            ...req.auth,
                            basic: {
                              username,
                              password: req.auth.basic?.password || '',
                            },
                          },
                        })
                      }
                      availableVars={availableVars}
                      placeholder="用户名，支持 {{username}}"
                      className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">密码 (Password)</label>
                    <VariableInput
                      type="password"
                      value={req.auth.basic?.password || ''}
                      onChange={(password) =>
                        updateReq({
                          auth: {
                            ...req.auth,
                            basic: {
                              username: req.auth.basic?.username || '',
                              password,
                            },
                          },
                        })
                      }
                      availableVars={availableVars}
                      placeholder="密码，支持 {{password}}"
                      className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              {req.auth?.type === 'apikey' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">参数名 (Key)</label>
                      <VariableInput
                        value={req.auth.apikey?.key || ''}
                        onChange={(k) =>
                          updateReq({
                            auth: {
                              ...req.auth,
                              apikey: {
                                key: k,
                                value: req.auth.apikey?.value || '',
                                in: req.auth.apikey?.in || 'header',
                              },
                            },
                          })
                        }
                        availableVars={availableVars}
                        placeholder="例如 X-API-Key"
                        className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">参数值 (Value)</label>
                      <VariableInput
                        value={req.auth.apikey?.value || ''}
                        onChange={(v) =>
                          updateReq({
                            auth: {
                              ...req.auth,
                              apikey: {
                                key: req.auth.apikey?.key || '',
                                value: v,
                                in: req.auth.apikey?.in || 'header',
                              },
                            },
                          })
                        }
                        availableVars={availableVars}
                        placeholder="例如 {{apiKey}}"
                        className="w-full bg-subtle border border-line rounded-lg px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">添加到 (Add to)</label>
                    <select
                      value={req.auth.apikey?.in || 'header'}
                      onChange={(e) =>
                        updateReq({
                          auth: {
                            ...req.auth,
                            apikey: {
                              key: req.auth.apikey?.key || '',
                              value: req.auth.apikey?.value || '',
                              in: e.target.value as 'header' | 'query',
                            },
                          },
                        })
                      }
                      className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                    >
                      <option value="header">Header (请求头)</option>
                      <option value="query">Query (请求参数)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeReqTab === 'pre' && (
            <div className="h-full flex gap-3">
              <div className="flex-1 flex flex-col">
                <textarea
                  value={req.pre_tasks?.[0]?.script || ''}
                  onChange={(e) =>
                    updateReq({
                      pre_tasks: [{ type: 'script', script: e.target.value }],
                    })
                  }
                  placeholder={`// 示例：\npm.environment.set("timestamp", Date.now());\nconsole.log("Pre-request script executed");`}
                  className="flex-1 w-full bg-surface border border-line rounded-lg p-3 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Snippets Sidebar */}
              <div className="w-56 bg-surface border border-line rounded-lg p-3 space-y-2 text-xs overflow-y-auto">
                <div className="font-semibold text-gray-300 flex items-center gap-1.5 pb-1 border-b border-line">
                  <BookmarkPlus className="w-3.5 h-3.5 text-accent" />
                  <span>常用前置片段</span>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => insertPreScriptSnippet('pm.environment.set("timestamp", Date.now());')}
                    className="w-full text-left px-2 py-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground transition"
                  >
                    + 时间戳变量
                  </button>
                  <button
                    onClick={() => insertPreScriptSnippet('pm.environment.set("token", "my-test-token");')}
                    className="w-full text-left px-2 py-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground transition"
                  >
                    + 写入环境变量
                  </button>
                  <button
                    onClick={() => insertPreScriptSnippet('var cur = pm.environment.get("token");\nconsole.log("Token:", cur);')}
                    className="w-full text-left px-2 py-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground transition"
                  >
                    + 读取环境变量
                  </button>
                  <button
                    onClick={() => insertPreScriptSnippet('pm.globals.set("globalDomain", "https://api.example.com");')}
                    className="w-full text-left px-2 py-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground transition"
                  >
                    + 写入全局变量
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Vertical Drag Resizer Bar */}
      <div
        onMouseDown={() => setIsDragging(true)}
        onDoubleClick={() => setReqHeightPercent(45)}
        className={`h-1.5 hover:h-2 bg-subtle hover:bg-accent/40 border-y border-line cursor-row-resize transition-all flex items-center justify-center select-none group z-10 shrink-0 ${
          isDragging ? 'bg-accent/50 h-2' : ''
        }`}
        title="上下拖动调整请求/响应区域高度 (双击恢复默认 45%)"
      >
        <div className="w-8 h-1 rounded-full bg-gray-400/40 group-hover:bg-accent transition" />
      </div>

      {/* Lower Area: Response View */}
      <div
        style={{ height: `calc(${100 - reqHeightPercent}% - 6px)` }}
        className="flex-1 flex flex-col bg-surface overflow-hidden min-h-[90px]"
      >
        <ResponseViewer
          response={response}
          loading={loading}
          activeApi={api}
          onCancel={handleCancel}
        />
      </div>
      </div>
    </div>

    {/* Visual Field Editor Modal */}
    <VisualFieldModal
      isOpen={isVisualModalOpen}
      onClose={() => setIsVisualModalOpen(false)}
      value={req.body?.raw || ''}
      format={req.body?.raw_type === 'xml' ? 'xml' : 'json'}
      onSave={(newRaw) => {
        updateReq({
          body: {
            ...req.body,
            mode: 'raw',
            raw_type: req.body?.raw_type || 'json',
            raw: newRaw,
          },
        });
      }}
      availableVars={availableVars}
    />

    {/* Right Sidebar: Code Generator Drawer */}
    <CodeDrawer
      api={{ ...api, request: req }}
      isOpen={isCodeDrawerOpen}
      onClose={() => setIsCodeDrawerOpen(false)}
      preUrl={preUrl}
    />
  </div>
</div>
  );
};
