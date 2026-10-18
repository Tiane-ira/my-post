import React, { useState } from 'react';
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
} from 'lucide-react';
import { HttpResponseResult, ResponseExample, ApiDetail } from '../../../common/types';
import { Tooltip } from './Tooltip';

interface ResponseViewerProps {
  response: HttpResponseResult | null;
  loading: boolean;
  onExtractVariable?: (key: string, value: string) => void;
  examples?: ResponseExample[];
  activeApi?: ApiDetail;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  loading,
  onExtractVariable,
  examples = [],
  activeApi,
}) => {
  // Response tabs
  const [activeTab, setActiveTab] = useState<
    'body' | 'headers' | 'cookies' | 'examples' | 'actual' | 'console'
  >('body');

  // Actual request sub-tab (Header | Query | Path | Body)
  const [actualSubTab, setActualSubTab] = useState<'headers' | 'query' | 'path' | 'body'>('headers');

  const [bodyMode, setBodyMode] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [copied, setCopied] = useState(false);
  const [copiedActualTable, setCopiedActualTable] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Search inside response
  const [searchKeyword, setSearchKeyword] = useState('');

  // Variable extraction
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractPath, setExtractPath] = useState('');
  const [extractVarName, setExtractVarName] = useState('');
  const [extractSuccessTip, setExtractSuccessTip] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-subtle text-gray-400 gap-3 select-none">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs tracking-wider animate-pulse font-medium">
          正在请求目标服务，请稍候...
        </span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-subtle text-gray-500 gap-2 select-none">
        <Code2 className="w-10 h-10 stroke-[1.2] text-gray-600" />
        <span className="text-xs">点击上方「发送」按钮，即可在此查看实时响应</span>
      </div>
    );
  }

  const getStatusBadge = (code: number, text: string) => {
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
    navigator.clipboard.writeText(response.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getNestedValue = (obj: any, pathStr: string): any => {
    if (!obj || !pathStr.trim()) return undefined;
    const parts = pathStr.trim().split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[part];
    }
    return curr;
  };

  const currentExtractedVal = getNestedValue(response.data, extractPath);

  const handleConfirmExtract = () => {
    if (!extractVarName.trim() || currentExtractedVal === undefined) return;
    const stringVal =
      typeof currentExtractedVal === 'object'
        ? JSON.stringify(currentExtractedVal)
        : String(currentExtractedVal);
    if (onExtractVariable) {
      onExtractVariable(extractVarName.trim(), stringVal);
    }
    setExtractSuccessTip(true);
    setTimeout(() => {
      setExtractSuccessTip(false);
      setIsExtractModalOpen(false);
    }, 1200);
  };

  const headersCount = Object.keys(response.headers || {}).length;
  const cookiesList = response.cookies || [];
  const actualReq = response.actualRequest;

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
        {/* Left Tabs (实时响应, 响应头, Cookie, 响应示例, 实际请求, 控制台) */}
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

          <button
            onClick={() => setActiveTab('examples')}
            className={`px-3 py-1.5 rounded-md transition font-medium text-xs whitespace-nowrap ${
              activeTab === 'examples'
                ? 'bg-accent/15 text-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            响应示例
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
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
            {response.logs && response.logs.length > 0 && (
              <span className="text-[10px] text-gray-500">({response.logs.length})</span>
            )}
          </button>
        </div>

        {/* Right Stats & Indicators (Status, Time, Size, Globe icon, Download icon) */}
        <div className="flex items-center gap-2.5 text-xs">
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
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-3 bg-surface">
        {/* 1. 实时响应 (Live Response Body) */}
        {activeTab === 'body' && (
          <div className="h-full flex flex-col">
            {/* Body Mode Selector & Tools Toolbar */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center bg-subtle border border-line rounded p-0.5 text-xs">
                <button
                  onClick={() => setBodyMode('pretty')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                    bodyMode === 'pretty'
                      ? 'bg-accent text-white font-medium'
                      : 'text-gray-400 hover:text-foreground'
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  Pretty
                </button>
                <button
                  onClick={() => setBodyMode('raw')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                    bodyMode === 'raw'
                      ? 'bg-accent text-white font-medium'
                      : 'text-gray-400 hover:text-foreground'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  Raw
                </button>
                <button
                  onClick={() => setBodyMode('preview')}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                    bodyMode === 'preview'
                      ? 'bg-accent text-white font-medium'
                      : 'text-gray-400 hover:text-foreground'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>

              {/* Advanced Response Actions: Extract to Variable */}
              <div className="flex items-center gap-2">
                {/* Search within response */}
                <div className="relative">
                  <Search className="w-3 h-3 text-gray-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜索响应内容..."
                    className="bg-surface border border-line rounded pl-6 pr-2 py-0.5 text-[11px] text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>

                <Tooltip content={copied ? '已复制响应内容' : '复制响应内容'} delayMs={400}>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 hover:text-foreground transition"
                    aria-label="复制"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </Tooltip>

                {onExtractVariable &&
                  typeof response.data === 'object' &&
                  response.data !== null && (
                    <button
                      onClick={() => {
                        setExtractPath('token');
                        setExtractVarName('token');
                        setIsExtractModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition shadow-sm"
                      title="从返回的 JSON 中快速提取字段存为环境变量"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>⚡ 提取变量</span>
                    </button>
                  )}
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 border border-line rounded-lg bg-surface p-3 overflow-auto font-mono text-xs text-gray-200">
              {response.error ? (
                <div className="text-rose-400 whitespace-pre-wrap">{response.error}</div>
              ) : bodyMode === 'pretty' ? (
                <pre className="whitespace-pre-wrap leading-relaxed select-text">
                  {typeof response.data === 'object' && response.data !== null
                    ? JSON.stringify(response.data, null, 2)
                    : response.rawText}
                </pre>
              ) : bodyMode === 'raw' ? (
                <pre className="whitespace-pre-wrap leading-relaxed select-text">
                  {response.rawText}
                </pre>
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
                        <div className="py-6 text-center text-gray-500">无发送 Header 参数</div>
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
                        <div className="py-6 text-center text-gray-500">无发送 Query 参数</div>
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
                        <div className="py-6 text-center text-gray-500">无 Path 路径参数</div>
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
                        本次请求无 Body 载荷参数 (mode: {actualReq?.bodyMode || 'none'})
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
              {Object.entries(response.headers).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[220px_1fr] py-1.5 px-3 hover:bg-hover/50"
                >
                  <div className="font-mono text-accent select-all">{k}</div>
                  <div className="font-mono text-gray-300 break-all select-all">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Cookie */}
        {activeTab === 'cookies' && (
          <div className="border border-line rounded-lg overflow-hidden bg-surface text-xs">
            {cookiesList.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                本次请求未包含 Set-Cookie 响应头
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

        {/* 5. 响应示例 (Response Examples) */}
        {activeTab === 'examples' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>当前接口配置的响应示例列表：</span>
            </div>

            {examples.length === 0 ? (
              <div className="border border-line rounded-lg bg-surface py-12 text-center text-gray-500 text-xs">
                暂无配置响应示例
              </div>
            ) : (
              <div className="space-y-2">
                {examples.map((ex) => (
                  <div
                    key={ex.example_id}
                    className="p-3 rounded-lg border border-line bg-surface space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                          {ex.expect?.code || 200}
                        </span>
                        <span className="font-semibold text-gray-200 text-xs">{ex.name}</span>
                        {ex.expect?.is_default === 1 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                            默认
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {ex.expect?.content_type || 'application/json'}
                      </span>
                    </div>
                    <pre className="p-2 rounded bg-surface text-gray-300 font-mono text-[11px] max-h-36 overflow-auto">
                      {ex.raw}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. 控制台 (Console) */}
        {activeTab === 'console' && (
          <div className="border border-line rounded-lg bg-surface p-3 font-mono text-xs text-gray-300 space-y-1">
            {!response.logs || response.logs.length === 0 ? (
              <div className="text-gray-500">无控制台打印日志</div>
            ) : (
              response.logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  <span className="text-gray-500 mr-2">[{idx + 1}]</span>
                  <span>{log}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Extract Variable Modal */}
      {isExtractModalOpen && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-96 bg-surface border border-line rounded-xl shadow-2xl p-4 text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>从响应提取为环境变量</span>
              </div>
              <button
                onClick={() => setIsExtractModalOpen(false)}
                className="text-gray-400 hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">
                JSON 字段路径 (支持点语法，如 data.token)
              </label>
              <input
                type="text"
                value={extractPath}
                onChange={(e) => setExtractPath(e.target.value)}
                placeholder="例如: token 或 data.user.id"
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-1">存储的环境变量名称</label>
              <input
                type="text"
                value={extractVarName}
                onChange={(e) => setExtractVarName(e.target.value)}
                placeholder="例如: auth_token"
                className="w-full bg-surface border border-line rounded px-2.5 py-1.5 text-gray-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Extracted Value Live Preview */}
            <div className="p-2.5 rounded bg-surface border border-line space-y-1">
              <span className="text-gray-400 block text-[11px]">提取字段实时预览：</span>
              <div className="font-mono text-amber-300 break-all max-h-20 overflow-auto">
                {currentExtractedVal !== undefined
                  ? typeof currentExtractedVal === 'object'
                    ? JSON.stringify(currentExtractedVal)
                    : String(currentExtractedVal)
                  : '(未匹配到此字段或响应非有效对象)'}
              </div>
            </div>

            {extractSuccessTip && (
              <div className="text-emerald-400 font-medium text-center py-1">
                ✓ 提取成功，已写入当前环境变量！
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIsExtractModalOpen(false)}
                className="px-3 py-1.5 rounded bg-subtle hover:bg-hover text-gray-300 font-medium transition"
              >
                取消
              </button>
              <button
                type="button"
                disabled={currentExtractedVal === undefined || !extractVarName.trim()}
                onClick={handleConfirmExtract}
                className="px-4 py-1.5 rounded bg-accent hover:bg-accent disabled:opacity-50 text-white font-medium transition shadow-md"
              >
                写入环境变量
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
