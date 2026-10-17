import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  RefreshCw,
  Link2,
  Folder,
  Layers,
  FileUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  Check,
  FolderOpen
} from 'lucide-react';
import { ApiDetail, ApiTreeNode } from '../../../common/types';
import { DataImporters, ParsedApiDocItem, ParsedApiDocResult } from '../../../common/importers';
import { useFeedback } from './FeedbackContext';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onImportComplete: () => Promise<void>;
}

interface FolderOption {
  id: string;
  name: string;
  path: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onImportComplete,
}) => {
  const { toast } = useFeedback();

  // Input source mode: URL vs Local File
  const [sourceMode, setSourceMode] = useState<'url' | 'file'>('url');

  // URL state
  const [docUrl, setDocUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  // File state
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw content state (JSON / YAML)
  const [content, setContent] = useState('');
  const [showRawEditor, setShowRawEditor] = useState(false);

  // Parsed doc result & preview
  const [parsedDoc, setParsedDoc] = useState<ParsedApiDocResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  // Target directory selection (default to root '0')
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string>('0');

  // Conflict strategy: replace vs skip (single selection for the entire batch import)
  const [conflictStrategy, setConflictStrategy] = useState<'replace' | 'skip'>('replace');

  // Importing progress state
  const [importing, setImporting] = useState(false);

  // Group parsed items by their folder path for clear tree-structure preview
  const groupedPreview = React.useMemo(() => {
    if (!parsedDoc || !parsedDoc.items || parsedDoc.items.length === 0) return [];

    const groups = new Map<string, ParsedApiDocItem[]>();
    for (const item of parsedDoc.items) {
      const groupKey =
        item.folderPath && item.folderPath.length > 0
          ? item.folderPath.join(' / ')
          : '默认根分组';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    }

    return Array.from(groups.entries()).map(([folderName, items]) => ({
      folderName,
      items,
    }));
  }, [parsedDoc]);

  // Load project folders on open
  useEffect(() => {
    if (isOpen) {
      loadFolders();
      // Reset state
      setParsedDoc(null);
      setParseError(null);
      setContent('');
      setFileName('');
      setFileSize('');
      setDocUrl('');
      setTargetFolderId('0');
      setConflictStrategy('replace');
    }
  }, [isOpen, projectId]);

  const loadFolders = async () => {
    try {
      const tree = await window.mypostAPI.getProjectTree(projectId);
      const folderNodes = (tree || []).filter((n) => n.target_type === 'folder');
      const folderMap = new Map<string, ApiTreeNode>();
      for (const f of folderNodes) {
        folderMap.set(f.target_id, f);
      }

      const getFolderPath = (folderId: string): string => {
        const parts: string[] = [];
        const visited = new Set<string>();
        let curr: ApiTreeNode | undefined = folderMap.get(folderId);
        while (curr && !visited.has(curr.target_id)) {
          visited.add(curr.target_id);
          parts.unshift(curr.name);
          curr = curr.parent_id && curr.parent_id !== '0' ? folderMap.get(curr.parent_id) : undefined;
        }
        return parts.join(' / ');
      };

      const options: FolderOption[] = folderNodes
        .map((f) => ({
          id: f.target_id,
          name: f.name,
          path: getFolderPath(f.target_id),
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

      setFolders(options);
    } catch (e) {
      console.warn('Failed to load project folders:', e);
    }
  };

  // Method badge styling helper
  const renderMethodBadge = (m: string) => {
    const method = (m || 'GET').toUpperCase();
    const map: Record<string, string> = {
      GET: 'bg-green-500/15 text-green-400 border-green-500/30',
      POST: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      PUT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
      PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      HEAD: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
      OPTIONS: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0 ${
          map[method] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
        }`}
      >
        {method}
      </span>
    );
  };

  // Helper to parse content and update preview using mature open-source parser
  const parseDocumentContent = async (rawText: string) => {
    const cleanText = (rawText || '').trim().replace(/^\uFEFF/, '');
    if (!cleanText) {
      setParsedDoc(null);
      setParseError(null);
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      let docResult: ParsedApiDocResult;
      if (window.mypostAPI?.parseApiDoc) {
        docResult = await window.mypostAPI.parseApiDoc(cleanText);
      } else {
        docResult = await DataImporters.parseApiDocAsync(cleanText);
      }
      setParsedDoc(docResult);
      setParseError(null);
      if (!docResult.items || docResult.items.length === 0) {
        setParseError('文档解析成功，但未在 paths 中发现有效接口定义');
      }
    } catch (err: any) {
      console.warn('Async open-source parse failed, trying sync parser fallback:', err);
      try {
        const fallbackResult = DataImporters.parseApiDoc(cleanText);
        setParsedDoc(fallbackResult);
        setParseError(null);
        if (!fallbackResult.items || fallbackResult.items.length === 0) {
          setParseError('文档解析成功，但未在 paths 中发现有效接口定义');
        }
      } catch (errFallback: any) {
        setParsedDoc(null);
        setParseError(errFallback.message || err.message || '文档格式无效，无法解析为 JSON 或 YAML');
      }
    } finally {
      setParsing(false);
    }
  };

  // Fetch online doc URL
  const handleFetchUrl = async () => {
    if (!docUrl.trim()) {
      toast.warning('请输入有效的文档链接 URL');
      return;
    }
    setFetchingUrl(true);
    setParseError(null);
    try {
      let rawText = '';
      if (window.mypostAPI?.fetchDocUrl) {
        rawText = await window.mypostAPI.fetchDocUrl(docUrl.trim());
      } else {
        const res = await fetch(docUrl.trim(), {
          headers: {
            Accept: 'application/json, application/yaml, text/plain, */*',
          },
        });
        if (!res.ok) {
          throw new Error(`网络请求失败 (HTTP ${res.status} ${res.statusText})`);
        }
        rawText = await res.text();
      }

      const cleanText = (rawText || '').trim().replace(/^\uFEFF/, '');
      setContent(cleanText);
      await parseDocumentContent(cleanText);
      toast.success('接口文档拉取成功并已自动解析！');
    } catch (e: any) {
      setParseError(`拉取文档失败: ${e.message}`);
      toast.error(`拉取文档失败: ${e.message}`);
    } finally {
      setFetchingUrl(false);
    }
  };

  // Select local doc file (supports Electron native dialog and web file input)
  const handlePickLocalFile = async () => {
    if (window.mypostAPI?.readDocFile) {
      try {
        const res = await window.mypostAPI.readDocFile();
        if (res && res.content) {
          const clean = res.content.replace(/^\uFEFF/, '');
          setFileName(res.fileName);
          const sizeKb = (new Blob([clean]).size / 1024).toFixed(1);
          setFileSize(`${sizeKb} KB`);
          setContent(clean);
          await parseDocumentContent(clean);
          toast.success(`已加载文件 "${res.fileName}"`);
          return;
        }
      } catch (err: any) {
        console.warn('Native readDocFile error, fallback to HTML5 file input:', err);
      }
    }
    fileInputRef.current?.click();
  };

  // Native input onChange fallback
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      setFileName(file.name);
      setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      setContent(text);
      await parseDocumentContent(text);
      toast.success(`已加载文件 "${file.name}"`);
    } catch (err: any) {
      toast.error(`读取文件失败: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Drag and drop handler
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      setFileName(file.name);
      setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      setContent(text);
      await parseDocumentContent(text);
      toast.success(`已加载拖入的文件 "${file.name}"`);
    } catch (err: any) {
      toast.error(`读取拖入文件失败: ${err.message}`);
    }
  };

  // Execute batch import with directory structure restoration & conflict strategy
  const handleExecuteImport = async () => {
    let doc = parsedDoc;

    // If doc hasn't been parsed yet, try parsing now
    if (!doc || doc.items.length === 0) {
      if (sourceMode === 'url' && docUrl.trim() && !content.trim()) {
        try {
          setFetchingUrl(true);
          let rawText = '';
          if (window.mypostAPI?.fetchDocUrl) {
            rawText = await window.mypostAPI.fetchDocUrl(docUrl.trim());
          } else {
            const res = await fetch(docUrl.trim());
            rawText = await res.text();
          }
          setContent(rawText);
          if (window.mypostAPI?.parseApiDoc) {
            doc = await window.mypostAPI.parseApiDoc(rawText);
          } else {
            doc = await DataImporters.parseApiDocAsync(rawText);
          }
          setParsedDoc(doc);
        } catch (err: any) {
          toast.error(`拉取文档失败: ${err.message}`);
          return;
        } finally {
          setFetchingUrl(false);
        }
      } else if (content.trim()) {
        try {
          if (window.mypostAPI?.parseApiDoc) {
            doc = await window.mypostAPI.parseApiDoc(content);
          } else {
            doc = await DataImporters.parseApiDocAsync(content);
          }
          setParsedDoc(doc);
        } catch (err: any) {
          toast.error(`解析失败: ${err.message}`);
          return;
        }
      }
    }

    if (!doc || doc.items.length === 0) {
      toast.warning('未能从文档中解析出有效接口，请检查文档内容或链接');
      return;
    }

    setImporting(true);
    try {
      const tree = await window.mypostAPI.getProjectTree(projectId);
      const baseParentId = targetFolderId || '0';

      // Cache folder paths to avoid duplicate creations
      // e.g. "用户中心" -> folderId, "用户中心/权限" -> folderId
      const folderCache = new Map<string, string>();
      let createdFolderCount = 0;

      // Helper to find or recursively create folder hierarchy under baseParentId
      const resolveDestinationFolder = (folderPath?: string[]): string => {
        if (!folderPath || folderPath.length === 0) {
          return baseParentId;
        }

        let currentParentId = baseParentId;
        let pathAccum = '';

        for (const segment of folderPath) {
          pathAccum = pathAccum ? `${pathAccum}/${segment}` : segment;
          if (folderCache.has(pathAccum)) {
            currentParentId = folderCache.get(pathAccum)!;
            continue;
          }

          // Check if folder exists in tree with name === segment and parent_id === currentParentId
          const existingFolder = tree.find(
            (n) => n.target_type === 'folder' && (n.parent_id || '0') === currentParentId && n.name === segment
          );

          if (existingFolder) {
            currentParentId = existingFolder.target_id;
            folderCache.set(pathAccum, currentParentId);
          } else {
            // Create new folder node
            const newFolderId = `folder-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
            const newFolderNode: ApiTreeNode = {
              target_id: newFolderId,
              parent_id: currentParentId,
              target_type: 'folder',
              name: segment,
              method: '',
              url: '',
              sort: tree.length * 1000 + 1000,
              status: 1,
            };
            tree.push(newFolderNode);
            currentParentId = newFolderId;
            folderCache.set(pathAccum, currentParentId);
            createdFolderCount++;
          }
        }

        return currentParentId;
      };

      let createdCount = 0;
      let replacedCount = 0;
      let skippedCount = 0;
      const detailsToSave: ApiDetail[] = [];

      for (const item of doc.items) {
        // 1. Resolve folder directory for this API based on its tag hierarchy
        const destinationFolderId = resolveDestinationFolder(item.folderPath);

        // 2. Check for conflicting API in that exact destination folder
        const existingNode = tree.find(
          (n) =>
            n.target_type === 'api' &&
            (n.parent_id || '0') === destinationFolderId &&
            n.method.toUpperCase() === item.method.toUpperCase() &&
            n.url.trim() === item.url.trim()
        );

        if (existingNode) {
          if (conflictStrategy === 'skip') {
            skippedCount++;
            continue;
          } else {
            // Replace / Overwrite existing API
            const detail = DataImporters.apiDocItemToApiDetail(
              item,
              existingNode.target_id,
              projectId,
              destinationFolderId
            );
            detailsToSave.push(detail);
            existingNode.name = item.name;
            existingNode.url = item.url;
            existingNode.method = item.method;
            replacedCount++;
          }
        } else {
          // Create new API in that destination folder
          const newId = `api-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
          const detail = DataImporters.apiDocItemToApiDetail(
            item,
            newId,
            projectId,
            destinationFolderId
          );
          detailsToSave.push(detail);
          const newNode: ApiTreeNode = {
            target_id: newId,
            parent_id: destinationFolderId,
            target_type: 'api',
            name: item.name,
            method: item.method,
            url: item.url,
            sort: tree.length * 1000 + 1000,
            status: 1,
          };
          tree.push(newNode);
          createdCount++;
        }
      }

      // Fast atomic batch import
      if (window.mypostAPI?.batchImportApis) {
        await window.mypostAPI.batchImportApis(projectId, detailsToSave, tree);
      } else {
        for (const detail of detailsToSave) {
          await window.mypostAPI.saveApiDetail(projectId, detail.target_id, detail);
        }
        await window.mypostAPI.saveProjectTree(projectId, tree);
      }

      const summaryParts = [];
      if (createdFolderCount > 0) summaryParts.push(`还原创建 ${createdFolderCount} 个分类目录`);
      summaryParts.push(`新增 ${createdCount} 个接口`);
      if (replacedCount > 0) summaryParts.push(`覆盖替换 ${replacedCount} 个`);
      if (skippedCount > 0) summaryParts.push(`跳过 ${skippedCount} 个重复接口`);

      toast.success(`✨ 批量导入完成！${summaryParts.join('，')}`);
      try {
        await onImportComplete();
      } catch (err) {
        console.warn('onImportComplete notice:', err);
      }
      onClose();
    } catch (e: any) {
      toast.error(`导入保存失败: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const parsedItemsCount = parsedDoc?.items?.length || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[820px] h-[670px] max-h-[92vh] bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-12 px-5 bg-subtle border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 font-bold text-sm text-foreground">
            <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Upload className="w-4 h-4" />
            </div>
            <span>导入 API 接口文档 (Swagger / OpenAPI)</span>
            <span className="text-[11px] font-normal text-gray-400">
              (自动识别 Swagger 2.0 / OpenAPI 3.x 规范，自动还原目录结构与完整参数)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-hover text-gray-400 hover:text-foreground transition"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Mode Toggle & Detected Doc Info Bar */}
        <div className="px-5 py-2.5 bg-subtle/50 border-b border-line flex items-center justify-between shrink-0">
          {/* Detected Format Badge */}
          <div className="flex items-center gap-2">
            {parsedDoc ? (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-accent/20 border border-accent/40 text-accent font-mono font-bold text-[11px] uppercase">
                  {parsedDoc.docFormat === 'openapi' ? `OpenAPI ${parsedDoc.version || '3.x'}` : `Swagger ${parsedDoc.version || '2.0'}`}
                </span>
                <span className="font-semibold text-gray-200 truncate max-w-[280px]">
                  {parsedDoc.title}
                </span>
                <span className="text-gray-400 text-[11px]">
                  ({parsedDoc.items.length} 个接口，{groupedPreview.length} 个目录)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>自动识别 Swagger 2.0 / OpenAPI 3.x 规范，兼容 JSON 与 YAML</span>
              </div>
            )}
          </div>

          {/* Source Toggle: URL vs Local File */}
          <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSourceMode('url')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                sourceMode === 'url'
                  ? 'bg-accent/20 text-accent font-semibold border border-accent/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>URL 导入</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('file')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                sourceMode === 'file'
                  ? 'bg-accent/20 text-accent font-semibold border border-accent/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>本地文件导入</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 min-h-0 flex flex-col p-5 overflow-y-auto space-y-4">
          {/* 1. Source Input Section */}
          {sourceMode === 'url' ? (
            <div className="bg-subtle border border-line rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-accent" />
                  <span>接口文档在线链接 (URL)：</span>
                </label>
                <span className="text-gray-500">
                  支持内网/局域网及各类 Swagger UI/OpenAPI JSON/YAML 接口
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchUrl();
                    }
                  }}
                  placeholder="例如 http://localhost:8080/v2/api-docs 或 https://petstore.swagger.io/v2/swagger.json"
                  className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleFetchUrl}
                  disabled={fetchingUrl || !docUrl.trim()}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition shrink-0 flex items-center gap-1.5 disabled:opacity-50 shadow-sm shadow-accent/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchingUrl ? 'animate-spin' : ''}`} />
                  <span>{fetchingUrl ? '拉取中...' : '拉取并解析'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-subtle border border-line rounded-xl p-3.5 space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml,.txt"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={handlePickLocalFile}
                className="border-2 border-dashed border-line hover:border-accent/60 bg-surface/60 hover:bg-hover rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-subtle group-hover:bg-accent/20 flex items-center justify-center text-gray-400 group-hover:text-accent transition">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-200 text-xs">
                    {fileName ? (
                      <span className="text-accent font-mono flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        已选择：{fileName} ({fileSize})
                      </span>
                    ) : (
                      '点击选择本地文档文件，或直接拖拽文件至此处'
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    支持 .json, .yaml, .yml 格式的 Swagger 2.0 / OpenAPI 3.x 接口文档
                  </div>
                </div>
                {fileName && (
                  <span className="text-[10px] text-gray-400 underline hover:text-accent mt-0.5">
                    重新选择其他文件
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Toggle for inspecting or editing raw JSON / YAML */}
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <button
              type="button"
              onClick={() => setShowRawEditor(!showRawEditor)}
              className="text-gray-400 hover:text-accent transition underline flex items-center gap-1"
            >
              <span>{showRawEditor ? '隐藏文档原始文本内容' : '或手动粘贴 / 查看文档原始 JSON/YAML 文本'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showRawEditor ? 'rotate-180' : ''}`} />
            </button>
            {content && (
              <span className="text-gray-500 font-mono">
                文档长度: {content.length} 字符
              </span>
            )}
          </div>

          {showRawEditor && (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                parseDocumentContent(e.target.value);
              }}
              placeholder={'在此直接粘贴 Swagger / OpenAPI 的 JSON 或 YAML 文本内容...'}
              className="w-full h-32 bg-subtle border border-line rounded-lg p-3 font-mono text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent resize-none leading-relaxed"
            />
          )}

          {/* 2. Target Directory & Conflict Strategy Configuration */}
          <div className="grid grid-cols-2 gap-3.5 bg-subtle/80 border border-line rounded-xl p-3.5">
            {/* Target Folder Selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5 text-xs">
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>目标导入目录：</span>
              </label>
              <div className="relative">
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  className="w-full appearance-none bg-surface border border-line rounded-lg px-3 py-2 text-xs text-gray-200 font-medium focus:outline-none focus:border-accent cursor-pointer pr-8 transition"
                >
                  <option value="0" className="bg-surface text-gray-200">
                    📁 根目录 (项目根节点 /)
                  </option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id} className="bg-surface text-gray-200">
                      📁 {f.path}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
              <div className="text-[10px] text-gray-500">
                文档中解析出的各分类目录将在此目录下自动还原创建
              </div>
            </div>

            {/* Conflict Strategy Selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-gray-300 flex items-center gap-1.5 text-xs">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>同目录接口冲突策略：</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConflictStrategy('replace')}
                  className={`p-2 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                    conflictStrategy === 'replace'
                      ? 'bg-accent/15 border-accent text-accent font-semibold shadow-sm'
                      : 'bg-surface border-line text-gray-400 hover:text-gray-200 hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center gap-1 font-semibold text-xs">
                    <Check className={`w-3.5 h-3.5 ${conflictStrategy === 'replace' ? 'opacity-100' : 'opacity-0'}`} />
                    <span>覆盖替换已有</span>
                  </div>
                  <div className="text-[10px] text-gray-500 scale-95 origin-left">
                    已存在同 Method+URL 时更新内容
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConflictStrategy('skip')}
                  className={`p-2 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                    conflictStrategy === 'skip'
                      ? 'bg-accent/15 border-accent text-accent font-semibold shadow-sm'
                      : 'bg-surface border-line text-gray-400 hover:text-gray-200 hover:bg-hover'
                  }`}
                >
                  <div className="flex items-center gap-1 font-semibold text-xs">
                    <Check className={`w-3.5 h-3.5 ${conflictStrategy === 'skip' ? 'opacity-100' : 'opacity-0'}`} />
                    <span>跳过重复接口</span>
                  </div>
                  <div className="text-[10px] text-gray-500 scale-95 origin-left">
                    保留原有接口数据，不覆盖
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Parsed APIs Preview List with Restored Directory Structure */}
          <div className="flex-1 min-h-[170px] flex flex-col border border-line rounded-xl overflow-hidden bg-surface">
            <div className="h-9 px-3.5 bg-subtle/80 border-b border-line flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-gray-300">
                  目录结构与接口预览
                </span>
                {parsedItemsCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent font-mono font-bold">
                    共 {parsedItemsCount} 个接口 / {groupedPreview.length} 个分类目录
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-500">
                导入目标：{targetFolderId === '0' ? '根目录 /' : folders.find((f) => f.id === targetFolderId)?.name || '指定目录'} | 冲突策略：{conflictStrategy === 'replace' ? '覆盖替换' : '跳过'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {parsing ? (
                <div className="h-full flex flex-col items-center justify-center text-accent text-xs gap-2 p-6">
                  <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                  <span className="font-semibold">正在使用开源 OpenAPI 引擎解引规范与还原模型定义...</span>
                </div>
              ) : parseError ? (
                <div className="h-full flex flex-col items-center justify-center text-red-400 text-xs gap-1.5 p-6">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <span className="font-semibold">{parseError}</span>
                  <span className="text-[11px] text-gray-500">
                    请核实输入的是有效的 Swagger 2.0 或 OpenAPI 3.x 规范的 JSON/YAML 文档
                  </span>
                </div>
              ) : !parsedDoc || parsedDoc.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs gap-1.5 p-6">
                  <FileText className="w-6 h-6 text-gray-600" />
                  <span>请输入在线文档 URL 并点击拉取，或选择本地文档文件</span>
                </div>
              ) : (
                groupedPreview.map((group, gIdx) => (
                  <div key={group.folderName + gIdx} className="border border-line/60 rounded-lg overflow-hidden bg-subtle/30">
                    {/* Folder Header */}
                    <div className="px-3 py-1.5 bg-subtle/80 border-b border-line/40 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-400 text-xs">
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{group.folderName}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {group.items.length} 个接口
                      </span>
                    </div>

                    {/* APIs in this folder */}
                    <div className="divide-y divide-line/30">
                      {group.items.map((item, idx) => (
                        <div
                          key={`${item.method}-${item.url}-${idx}`}
                          className="py-1.5 px-3 hover:bg-hover/50 flex items-center justify-between gap-3 transition text-xs"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {renderMethodBadge(item.method)}
                            <span className="font-mono text-gray-200 text-xs truncate">
                              {item.url}
                            </span>
                            <span className="text-gray-400 text-[11px] truncate">
                              {item.name !== `${item.method} ${item.url}` ? item.name : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 shrink-0">
                            {item.pathParams && item.pathParams.length > 0 && (
                              <span className="bg-subtle px-1.5 py-0.5 rounded border border-line text-amber-400/80">
                                Path: {item.pathParams.length}
                              </span>
                            )}
                            {item.queryParams && item.queryParams.length > 0 && (
                              <span className="bg-subtle px-1.5 py-0.5 rounded border border-line">
                                Query: {item.queryParams.length}
                              </span>
                            )}
                            {item.bodyMode === 'json' && (
                              <span className="bg-subtle px-1.5 py-0.5 rounded border border-line text-blue-400">
                                JSON Body
                              </span>
                            )}
                            {item.bodyMode === 'form-data' && (
                              <span className="bg-subtle px-1.5 py-0.5 rounded border border-line text-purple-400">
                                Form-Data
                              </span>
                            )}
                            {item.bodyMode === 'urlencoded' && (
                              <span className="bg-subtle px-1.5 py-0.5 rounded border border-line text-teal-400">
                                Urlencoded
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-14 px-5 bg-subtle border-t border-line flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400">
            {parsedDoc && parsedDoc.items.length > 0 ? (
              <span className="text-accent font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                就绪：准备还原 {groupedPreview.length} 个目录结构，导入 {parsedDoc.items.length} 个接口
              </span>
            ) : (
              <span>请先提供并解析接口文档</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 rounded-lg bg-surface hover:bg-hover border border-line text-gray-300 font-medium transition disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={importing || (!parsedDoc && !docUrl.trim() && !content.trim())}
              className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold transition flex items-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>正在还原目录并批量导入...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    确认导入并还原目录 {parsedItemsCount > 0 ? `(${parsedItemsCount} 个接口)` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
