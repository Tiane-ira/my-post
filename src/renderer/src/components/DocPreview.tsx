import React, { useState } from 'react';
import { FileText, Download, Copy, Check, ArrowLeft, Code2 } from 'lucide-react';
import { ApiDetail } from '../../../common/types';
import { DocGenerator } from '../../../common/docGenerator';
import { useFeedback } from './FeedbackContext';

interface DocPreviewProps {
  api: ApiDetail;
  onBackToDebug: () => void;
}

export const DocPreview: React.FC<DocPreviewProps> = ({
  api,
  onBackToDebug,
}) => {
  const { toast } = useFeedback();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'render' | 'markdown'>('render');

  const markdown = DocGenerator.generateMarkdown(api);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('已复制 Markdown 内容！');
  };

  const handleExportMarkdown = async () => {
    const filename = `${api.name || 'api_doc'}.md`;
    if ((window as any).mypostAPI?.saveFile) {
      await (window as any).mypostAPI.saveFile(filename, markdown);
    } else {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
    toast.success(`Markdown 文档已下载: ${filename}`);
  };

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    POST: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    PUT: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    DELETE: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas overflow-hidden">
      {/* Top Action Bar */}
      <div className="h-11 px-4 border-b border-line flex items-center justify-between bg-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDebug}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回调试</span>
          </button>
          <div className="h-4 w-[1px] bg-subtle"></div>
          <div className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold">
            <FileText className="w-4 h-4 text-accent" />
            <span>接口文档预览模式 (Markdown)</span>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center p-0.5 bg-surface border border-line rounded-lg ml-2">
            <button
              onClick={() => setViewMode('render')}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition ${
                viewMode === 'render'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              渲染视图
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition ${
                viewMode === 'markdown'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Markdown 源码
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制 Markdown'}</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载 Markdown (.md)</span>
          </button>
        </div>
      </div>

      {/* Doc Body */}
      {viewMode === 'markdown' ? (
        <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full">
          <div className="bg-surface border border-line rounded-xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400 border-b border-line pb-2">
              <span className="font-mono text-gray-300">Markdown 源码内容预览 ({markdown.length} 字符)</span>
              <button
                onClick={handleCopyMarkdown}
                className="px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-xs text-gray-300 hover:text-foreground transition flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已复制' : '复制全文'}</span>
              </button>
            </div>
            <pre className="font-mono text-xs text-gray-200 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text">
              <code>{markdown}</code>
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full space-y-6">
          {/* Title and Method */}
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{api.name || '未命名接口'}</h1>
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs border ${
                  methodColors[api.method] || 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                {api.method}
              </span>
              <code className="text-xs font-mono bg-sidebar px-2.5 py-1 rounded border border-line text-orange-300">
                {api.url || '/'}
              </code>
            </div>
          </div>

          {/* Query Parameters */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200 border-b border-line pb-1.5">
              Query 参数
            </h3>
            {(api.request?.query?.parameter || []).filter((q) => q.is_checked === 1 && q.key).length > 0 ? (
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-subtle text-gray-400 border-b border-line">
                    <tr>
                      <th className="px-3 py-2 font-medium">参数名</th>
                      <th className="px-3 py-2 font-medium">示例值</th>
                      <th className="px-3 py-2 font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {(api.request?.query?.parameter || [])
                      .filter((q) => q.is_checked === 1 && q.key)
                      .map((q, idx) => (
                        <tr key={idx} className="hover:bg-hover">
                          <td className="px-3 py-2 text-orange-300 font-mono font-medium">{q.key}</td>
                          <td className="px-3 py-2 text-gray-300 font-mono">{q.value || '-'}</td>
                          <td className="px-3 py-2 text-gray-400">{q.description || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-gray-500 py-1">无 Query 请求参数</div>
            )}
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200 border-b border-line pb-1.5">
              请求头 (Headers)
            </h3>
            {(api.request?.header?.parameter || []).filter((h) => h.is_checked === 1 && h.key).length > 0 ? (
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-subtle text-gray-400 border-b border-line">
                    <tr>
                      <th className="px-3 py-2 font-medium">头部字段</th>
                      <th className="px-3 py-2 font-medium">示例值</th>
                      <th className="px-3 py-2 font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {(api.request?.header?.parameter || [])
                      .filter((h) => h.is_checked === 1 && h.key)
                      .map((h, idx) => (
                        <tr key={idx} className="hover:bg-hover">
                          <td className="px-3 py-2 text-gray-200 font-mono font-medium">{h.key}</td>
                          <td className="px-3 py-2 text-gray-300 font-mono">{h.value || '-'}</td>
                          <td className="px-3 py-2 text-gray-400">{h.description || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-gray-500 py-1">无特殊 Headers</div>
            )}
          </div>

          {/* Body */}
          {api.request?.body?.mode === 'json' && api.request?.body?.raw && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-200 border-b border-line pb-1.5">
                请求体 JSON (Body)
              </h3>
              <pre className="bg-surface border border-line p-4 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto leading-relaxed">
                <code>{api.request.body.raw}</code>
              </pre>
            </div>
          )}

          {/* Response Examples */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-200 border-b border-line pb-1.5">
              响应示例 (Response Example)
            </h3>
            {(api.response?.example || []).map((ex, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-gray-300">{ex.name || '默认响应'}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">
                    HTTP {ex.expect?.code || '200'}
                  </span>
                </div>
                <pre className="bg-surface border border-line p-4 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto leading-relaxed">
                  <code>{ex.raw}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
