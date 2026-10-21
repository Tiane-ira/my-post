import React, { useState } from 'react';
import {
  ChevronDown,
  Layers,
  Variable,
  Sparkles,
  Minimize2,
  FileCode,
  X,
} from 'lucide-react';
import { ApiDetail, ApiTreeNode, KeyValueItem } from '../../../common/types';
import { ParamUtils } from '../../../common/paramUtils';
import { UrlUtils } from '../../../common/urlUtils';
import { KeyValueTable } from './KeyValueTable';
import { JsonCodeEditor } from './JsonCodeEditor';
import { VisualFieldModal } from './VisualFieldModal';
import { VariableInput, VariableItem } from './VariableInput';
import { useFeedback } from './FeedbackContext';

export interface RequestEditorProps {
  api: ApiDetail;
  onChange: (updated: ApiDetail) => void;
  availableVars?: Record<string, VariableItem>;
  accentColor?: string; // 'accent' (orange for HTTP) or 'sky' (blue for SSE)
  showScripts?: boolean;
  treeItems?: ApiTreeNode[];
  folderDetails?: Record<string, any>;
  isSse?: boolean;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  api,
  onChange,
  availableVars = {},
  accentColor = 'accent',
  showScripts = true,
  treeItems = [],
  folderDetails = {},
  isSse = false,
}) => {
  const { toast } = useFeedback();
  const [activeReqTab, setActiveReqTab] = useState<
    'header' | 'query' | 'path' | 'body' | 'auth' | 'cookie' | 'pre' | 'tests'
  >('query');

  const [isVarMenuOpen, setIsVarMenuOpen] = useState(false);
  const [isVisualModalOpen, setIsVisualModalOpen] = useState(false);

  // Compute all implicit / inherited parameters from parent folders, Auth, and SSE system defaults
  const { headers: inheritedHeaders, query: inheritedQuery } = React.useMemo(() => {
    return ParamUtils.computeImplicitParams(api, treeItems, folderDetails, { isSse });
  }, [api, treeItems, folderDetails, isSse]);

  // Safe fallback normalization for request
  const req = {
    query: api.request?.query || { parameter: [] },
    path: api.request?.path || { parameter: [] },
    header: api.request?.header || { parameter: [] },
    cookie: api.request?.cookie || { parameter: [] },
    body: api.request?.body || { mode: 'none' },
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

  // Query parameter table update with automatic Params -> URL sync
  const handleQueryParamsChange = (parameter: KeyValueItem[]) => {
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
  const handlePathParamsChange = (parameter: KeyValueItem[]) => {
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
    try {
      const content = req.body?.raw_xml ?? req.body?.raw ?? '';
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

  const activeTabClass = accentColor === 'sky' ? 'bg-sky-500/20 text-sky-400' : 'bg-accent/20 text-accent';
  const badgeTextClass = accentColor === 'sky' ? 'text-sky-400' : 'text-accent';
  const activeDotClass = accentColor === 'sky' ? 'bg-sky-400' : 'bg-accent';

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface">
      {/* Request Tabs Strip: Header, Query, Path, Body, 认证, Cookie, 预执行操作, 后执行操作 */}
      <div className="h-9 px-3 bg-subtle border-b border-line flex items-center gap-1 text-xs select-none overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveReqTab('header')}
          className={`px-3 py-1 rounded-md transition font-medium ${
            activeReqTab === 'header'
              ? activeTabClass
              : 'text-gray-400 hover:text-foreground'
          }`}
        >
          Header
          {(req.header?.parameter || []).filter((h) => h.is_checked === 1 && h.key).length > 0 && (
            <span className={`ml-1 px-1 rounded-full text-[10px] bg-subtle ${badgeTextClass}`}>
              {(req.header?.parameter || []).filter((h) => h.is_checked === 1 && h.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveReqTab('query')}
          className={`px-3 py-1 rounded-md transition font-medium ${
            activeReqTab === 'query'
              ? activeTabClass
              : 'text-gray-400 hover:text-foreground'
          }`}
        >
          Query
          {(req.query?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length > 0 && (
            <span className={`ml-1 px-1 rounded-full text-[10px] bg-subtle ${badgeTextClass}`}>
              {(req.query?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveReqTab('path')}
          className={`px-3 py-1 rounded-md transition font-medium ${
            activeReqTab === 'path'
              ? activeTabClass
              : 'text-gray-400 hover:text-foreground'
          }`}
        >
          Path
          {(req.path?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length > 0 && (
            <span className={`ml-1 px-1 rounded-full text-[10px] bg-subtle ${badgeTextClass}`}>
              {(req.path?.parameter || []).filter((p) => p.is_checked === 1 && p.key).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveReqTab('body')}
          className={`px-3 py-1 rounded-md transition font-medium ${
            activeReqTab === 'body'
              ? activeTabClass
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
          type="button"
          onClick={() => setActiveReqTab('auth')}
          className={`px-3 py-1 rounded-md transition font-medium ${
            activeReqTab === 'auth'
              ? activeTabClass
              : 'text-gray-400 hover:text-foreground'
          }`}
        >
          认证
          {req.auth?.type && req.auth.type !== 'none' && (
            <span className={`ml-1 w-1.5 h-1.5 rounded-full ${activeDotClass} inline-block`}></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveReqTab('cookie')}
          className={`px-3 py-1 rounded-md transition font-medium ${
            activeReqTab === 'cookie'
              ? activeTabClass
              : 'text-gray-400 hover:text-foreground'
          }`}
        >
          Cookie
          {(req.cookie?.parameter || []).filter((c) => c.is_checked === 1 && c.key).length > 0 && (
            <span className={`ml-1 px-1 rounded-full text-[10px] bg-subtle ${badgeTextClass}`}>
              {(req.cookie?.parameter || []).filter((c) => c.is_checked === 1 && c.key).length}
            </span>
          )}
        </button>

        {showScripts && (
          <>
            <button
              type="button"
              onClick={() => setActiveReqTab('pre')}
              className={`px-3 py-1 rounded-md transition font-medium ${
                activeReqTab === 'pre'
                  ? activeTabClass
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              预执行操作
            </button>

            <button
              type="button"
              onClick={() => setActiveReqTab('tests')}
              className={`px-3 py-1 rounded-md transition font-medium ${
                activeReqTab === 'tests'
                  ? activeTabClass
                  : 'text-gray-400 hover:text-foreground'
              }`}
            >
              后执行操作
            </button>
          </>
        )}
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
            showContentType={true}
            showType={false}
            showRequired={true}
            keyPlaceholder="Header 名"
            valuePlaceholder="Header 值"
          />
        )}

        {activeReqTab === 'query' && (
          <KeyValueTable
            items={req.query?.parameter || []}
            onChange={handleQueryParamsChange}
            inheritedItems={inheritedQuery}
            availableVars={availableVars}
            allowFile={false}
            showContentType={false}
            showType={true}
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
                            name="request_editor_body_mode"
                            checked={isSelected}
                            onChange={() => handleBodyModeChange(mode)}
                            className="accent-accent"
                          />
                          <span
                            className={
                              isSelected ? (accentColor === 'sky' ? 'text-sky-400 font-medium' : 'text-accent font-medium') : 'text-gray-400'
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
                                className="appearance-none bg-subtle hover:bg-hover border border-line text-foreground font-mono text-[11px] font-semibold pl-2 pr-5 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent transition"
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
                              <ChevronDown className="w-2.5 h-2.5 text-gray-400 opacity-70 absolute right-1.5 pointer-events-none" />
                            </div>

                            {/* Visual Field Editor Modal Trigger for JSON and XML */}
                            {((req.body?.raw_type || (req.body?.mode === 'json' ? 'json' : 'json')) === 'json' ||
                              req.body?.raw_type === 'xml') && (
                              <button
                                type="button"
                                onClick={() => setIsVisualModalOpen(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line hover:border-gray-500 text-amber-400 hover:text-amber-300 transition text-[11px] font-medium shadow-sm ml-1"
                                title="弹窗打开可视化字段编辑"
                              >
                                <Layers className="w-3.5 h-3.5 text-amber-400" />
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
                      <Variable className="w-3 h-3 text-amber-400" />
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
                      type="button"
                      onClick={formatXmlBody}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-subtle hover:bg-hover text-[11px] text-gray-300 transition"
                      title="格式化 XML"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
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
                  placeholder="Bearer Token 字符串，支持 {{token}} 变量"
                />
              </div>
            )}

            {req.auth?.type === 'basic' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 mb-1">Username</label>
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
                    placeholder="用户名"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Password</label>
                  <VariableInput
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
                    placeholder="密码"
                  />
                </div>
              </div>
            )}

            {req.auth?.type === 'apikey' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 mb-1">Key</label>
                  <VariableInput
                    value={req.auth.apikey?.key || ''}
                    onChange={(key) =>
                      updateReq({
                        auth: {
                          ...req.auth,
                          apikey: {
                            key,
                            value: req.auth.apikey?.value || '',
                            in: req.auth.apikey?.in || 'header',
                          },
                        },
                      })
                    }
                    availableVars={availableVars}
                    placeholder="例如: X-API-KEY 或 api_key"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Value</label>
                  <VariableInput
                    value={req.auth.apikey?.value || ''}
                    onChange={(value) =>
                      updateReq({
                        auth: {
                          ...req.auth,
                          apikey: {
                            key: req.auth.apikey?.key || '',
                            value,
                            in: req.auth.apikey?.in || 'header',
                          },
                        },
                      })
                    }
                    availableVars={availableVars}
                    placeholder="Key 的对应取值"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Add to</label>
                  <select
                    value={req.auth.apikey?.in || 'header'}
                    onChange={(e) =>
                      updateReq({
                        auth: {
                          ...req.auth,
                          apikey: {
                            key: req.auth.apikey?.key || '',
                            value: req.auth.apikey?.value || '',
                            in: e.target.value as any,
                          },
                        },
                      })
                    }
                    className="w-full bg-subtle border border-line rounded-lg px-3 py-1.5 text-gray-200 focus:outline-none focus:border-accent"
                  >
                    <option value="header">Header (请求头)</option>
                    <option value="query">Query Params (URL 参数)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {showScripts && activeReqTab === 'pre' && (
          <div className="h-full flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>在请求发送前执行的 JavaScript 脚本逻辑</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    insertPreScriptSnippet('mypost.setEnvironmentVariable("timestamp", Date.now());')
                  }
                  className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-white transition"
                >
                  + 设置环境时间戳
                </button>
              </div>
            </div>
            <textarea
              value={req.pre_tasks?.[0]?.script || ''}
              onChange={(e) =>
                updateReq({
                  pre_tasks: [{ type: 'script', script: e.target.value }],
                })
              }
              placeholder="// 在此处编写预执行 JS 代码，例如: mypost.setEnvironmentVariable('token', 'xxx');"
              className="flex-1 w-full bg-surface border border-line rounded-lg p-3 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent resize-none leading-relaxed"
            />
          </div>
        )}

        {showScripts && activeReqTab === 'tests' && (
          <div className="h-full flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>在收到响应后执行的断言与提取脚本</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    insertTestSnippet(
                      'mypost.test("Status is 200", function() {\n  mypost.assert(response.statusCode === 200);\n});'
                    )
                  }
                  className="px-2 py-0.5 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-white transition"
                >
                  + 状态码 200 断言
                </button>
              </div>
            </div>
            <textarea
              value={req.post_tasks?.[0]?.script || ''}
              onChange={(e) =>
                updateReq({
                  post_tasks: [{ type: 'script', script: e.target.value }],
                })
              }
              placeholder="// 在此处编写断言脚本，例如: mypost.test('Status is 200', function() { mypost.assert(response.statusCode === 200); });"
              className="flex-1 w-full bg-surface border border-line rounded-lg p-3 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent resize-none leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* Visual Field Editor Modal (JSON & XML) */}
      <VisualFieldModal
        isOpen={isVisualModalOpen}
        onClose={() => setIsVisualModalOpen(false)}
        value={req.body?.raw || ''}
        format={(req.body?.raw_type === 'xml' ? 'xml' : 'json') as any}
        onSave={(newRaw) => {
          updateReq({
            body: {
              ...req.body,
              raw: newRaw,
            },
          });
        }}
        availableVars={availableVars}
      />
    </div>
  );
};
