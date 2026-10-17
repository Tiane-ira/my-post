import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  AlertCircle,
  RotateCcw,
  PlusCircle,
  Layers,
} from 'lucide-react';
import {
  VisualFieldNode,
  VisualFieldType,
  parseJsonToNodes,
  serializeNodesToJson,
  parseXmlToNodes,
  serializeNodesToXml,
} from '../../../common/visualBodyUtils';
import { VariableInput, VariableItem } from './VariableInput';

interface VisualFieldEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  format: 'json' | 'xml';
  availableVars?: Record<string, VariableItem>;
}

interface FlattenedNode {
  node: VisualFieldNode;
  path: number[];
  depth: number;
}

const TYPE_OPTIONS: VisualFieldType[] = [
  'string',
  'integer',
  'number',
  'boolean',
  'array',
  'object',
  'null',
];

export const VisualFieldEditor: React.FC<VisualFieldEditorProps> = ({
  value,
  onChange,
  format,
  availableVars = {},
}) => {
  const [nodes, setNodes] = useState<VisualFieldNode[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Track the raw string that was committed by VisualFieldEditor itself
  const lastCommittedRawRef = React.useRef<string>('');
  const lastFormatRef = React.useRef<string>(format);
  const isInternalChangeRef = React.useRef<boolean>(false);

  // Sync incoming value to visual nodes only when changed externally
  useEffect(() => {
    // If this update was triggered by our own local edit, ignore it to prevent focus loss
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (value === lastCommittedRawRef.current && format === lastFormatRef.current) {
      return;
    }
    lastCommittedRawRef.current = value;
    lastFormatRef.current = format;

    try {
      if (format === 'json') {
        const parsed = parseJsonToNodes(value);
        setNodes(parsed);
      } else {
        const parsed = parseXmlToNodes(value);
        setNodes(parsed);
      }
      setParseError(null);
    } catch (err: any) {
      setParseError(err.message || '语法错误，无法解析为可视化字段');
    }
  }, [value, format]);

  // Helper to commit changes back to parent
  const commitNodes = (newNodes: VisualFieldNode[]) => {
    setNodes(newNodes);
    try {
      let serialized = '';
      if (format === 'json') {
        serialized = serializeNodesToJson(newNodes);
      } else {
        serialized = serializeNodesToXml(newNodes);
      }
      isInternalChangeRef.current = true;
      lastCommittedRawRef.current = serialized;
      onChange(serialized);
      setParseError(null);
    } catch (e: any) {
      console.error('Serialization error:', e);
    }
  };

  // Mutate tree at a specific index path
  const mutateTree = (
    tree: VisualFieldNode[],
    path: number[],
    mutator: (target: VisualFieldNode, parentList: VisualFieldNode[], idx: number) => void
  ): VisualFieldNode[] => {
    const clone: VisualFieldNode[] = JSON.parse(JSON.stringify(tree));
    let curList = clone;
    for (let i = 0; i < path.length - 1; i++) {
      const idx = path[i];
      if (!curList[idx].children) {
        curList[idx].children = [];
      }
      curList = curList[idx].children!;
    }
    const targetIdx = path[path.length - 1];
    mutator(curList[targetIdx], curList, targetIdx);
    return clone;
  };

  const handleUpdateField = (path: number[], field: keyof VisualFieldNode, val: any) => {
    const updated = mutateTree(nodes, path, (node) => {
      (node as any)[field] = val;
    });
    commitNodes(updated);
  };

  const handleTypeChange = (path: number[], newType: VisualFieldType) => {
    const updated = mutateTree(nodes, path, (node) => {
      node.type = newType;
      if (newType === 'object' || newType === 'array') {
        if (!node.children || node.children.length === 0) {
          node.children = [
            {
              id: Math.random().toString(36).substring(2, 9),
              key: newType === 'array' ? '[0]' : '',
              type: 'string',
              value: '',
              required: false,
            },
          ];
        }
        node.isExpanded = true;
        node.value = '';
      } else {
        node.children = undefined;
        if (newType === 'boolean') {
          node.value = node.value === 'true' ? 'true' : 'false';
        } else if (newType === 'integer') {
          node.value = /^-?\d+$/.test(node.value) ? node.value : '0';
        } else if (newType === 'number') {
          node.value = /^-?\d+(\.\d+)?$/.test(node.value) ? node.value : '0.0';
        } else if (newType === 'null') {
          node.value = '';
        }
      }
    });
    commitNodes(updated);
  };

  const handleToggleExpand = (path: number[]) => {
    const updated = mutateTree(nodes, path, (node) => {
      node.isExpanded = node.isExpanded === false ? true : false;
    });
    setNodes(updated);
  };

  const handleAddChild = (path: number[]) => {
    const updated = mutateTree(nodes, path, (node) => {
      if (!node.children) node.children = [];
      const isArray = node.type === 'array';
      const newKey = isArray ? `[${node.children.length}]` : '';
      node.children.push({
        id: Math.random().toString(36).substring(2, 9),
        key: newKey,
        type: 'string',
        value: '',
        required: false,
      });
      node.isExpanded = true;
    });
    commitNodes(updated);
  };

  const handleAddSibling = (path: number[]) => {
    const clone: VisualFieldNode[] = JSON.parse(JSON.stringify(nodes));
    let curList = clone;
    for (let i = 0; i < path.length - 1; i++) {
      curList = curList[path[i]].children!;
    }
    const idx = path[path.length - 1];
    curList.splice(idx + 1, 0, {
      id: Math.random().toString(36).substring(2, 9),
      key: '',
      type: 'string',
      value: '',
      required: false,
    });
    commitNodes(clone);
  };

  const handleDeleteNode = (path: number[]) => {
    const clone: VisualFieldNode[] = JSON.parse(JSON.stringify(nodes));
    let curList = clone;
    for (let i = 0; i < path.length - 1; i++) {
      curList = curList[path[i]].children!;
    }
    const idx = path[path.length - 1];
    curList.splice(idx, 1);
    commitNodes(clone);
  };

  const handleAddRootField = () => {
    const next: VisualFieldNode[] = [
      ...nodes,
      {
        id: Math.random().toString(36).substring(2, 9),
        key: format === 'xml' ? 'element' : '',
        type: 'string',
        value: '',
        required: false,
      },
    ];
    commitNodes(next);
  };

  const handleResetToTemplate = () => {
    if (format === 'json') {
      const template = JSON.stringify(
        {
          id: 1001,
          name: '示例对象',
          status: true,
          tags: ['api', 'mock'],
        },
        null,
        2
      );
      onChange(template);
    } else {
      const template = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <id>1001</id>\n  <name>示例对象</name>\n  <status>true</status>\n</root>`;
      onChange(template);
    }
  };

  // Flatten the visible nodes with hierarchy depth for table rendering
  const flattenedNodes = useMemo(() => {
    const res: FlattenedNode[] = [];
    const traverse = (list: VisualFieldNode[], currentPath: number[], depth: number) => {
      list.forEach((node, idx) => {
        const path = [...currentPath, idx];
        res.push({ node, path, depth });
        if (node.isExpanded !== false && node.children && node.children.length > 0) {
          traverse(node.children, path, depth + 1);
        }
      });
    };
    traverse(nodes, [], 0);
    return res;
  }, [nodes]);

  return (
    <div className="w-full flex flex-col space-y-2 text-xs">
      {/* Parse Error Notification */}
      {parseError && (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{parseError}</span>
          </div>
          <button
            type="button"
            onClick={handleResetToTemplate}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-medium transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重置为标准模板</span>
          </button>
        </div>
      )}

      {/* Visual Table */}
      <div className="border border-line rounded-lg overflow-hidden bg-surface">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1.1fr_40px_1.8fr_1.2fr_80px] bg-subtle border-b border-line text-gray-400 font-semibold py-1.5 px-3">
          <div>字段名 (Key)</div>
          <div>类型 (Type)</div>
          <div className="text-center">必填</div>
          <div>参数值 / 默认值</div>
          <div>说明 / 描述</div>
          <div className="text-center">操作</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-line">
          {flattenedNodes.map(({ node, path, depth }) => {
            const hasChildren = node.children && node.children.length > 0;
            const isContainer = node.type === 'object' || node.type === 'array';

            return (
              <div
                key={node.id || path.join('-')}
                className="grid grid-cols-[2fr_1.1fr_40px_1.8fr_1.2fr_80px] items-center px-2 py-1 gap-2 hover:bg-hover transition"
              >
                {/* Key with Indentation and Folder Toggle */}
                <div
                  className="flex items-center gap-1 min-w-0"
                  style={{ paddingLeft: `${depth * 18}px` }}
                >
                  {isContainer ? (
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(path)}
                      className="text-gray-400 hover:text-foreground p-0.5"
                    >
                      {node.isExpanded !== false ? (
                        <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4.5 inline-block text-gray-600 font-mono text-[10px] text-center">
                      •
                    </span>
                  )}

                  <input
                    type="text"
                    value={node.key}
                    placeholder="字段名"
                    onChange={(e) => handleUpdateField(path, 'key', e.target.value)}
                    className="flex-1 min-w-0 bg-surface/60 border border-transparent focus:border-accent/50 text-gray-200 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                  />
                </div>

                {/* Type Selector */}
                <div className="relative shrink-0 flex items-center">
                  <select
                    value={node.type}
                    onChange={(e) =>
                      handleTypeChange(path, e.target.value as VisualFieldType)
                    }
                    className="w-full appearance-none bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-mono text-[11px] font-semibold pl-2 pr-5 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent transition"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option
                        key={t}
                        value={t}
                        className="bg-subtle text-gray-200 py-1 font-mono text-xs"
                      >
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-2.5 h-2.5 text-accent opacity-70 absolute right-1.5 pointer-events-none" />
                </div>

                {/* Required * button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateField(path, 'required', !node.required)
                    }
                    className={`text-xs font-bold transition select-none ${
                      node.required
                        ? 'text-amber-400'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                    title={node.required ? '必填字段 (已开启)' : '点击设为必填'}
                  >
                    *
                  </button>
                </div>

                {/* Value Input */}
                <div className="min-w-0">
                  {node.type === 'object' ? (
                    <span className="text-gray-500 font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface border border-line">
                      &#123;{node.children?.length || 0} 属性&#125;
                    </span>
                  ) : node.type === 'array' ? (
                    <span className="text-gray-500 font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface border border-line">
                      [{node.children?.length || 0} 项]
                    </span>
                  ) : node.type === 'boolean' ? (
                    <select
                      value={node.value === 'true' ? 'true' : 'false'}
                      onChange={(e) =>
                        handleUpdateField(path, 'value', e.target.value)
                      }
                      className="bg-surface/60 border border-transparent focus:border-accent/50 text-emerald-400 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                    >
                      <option value="true" className="bg-subtle text-emerald-400">
                        true
                      </option>
                      <option value="false" className="bg-subtle text-rose-400">
                        false
                      </option>
                    </select>
                  ) : node.type === 'null' ? (
                    <span className="text-gray-500 font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface border border-line">
                      null
                    </span>
                  ) : (
                    <VariableInput
                      value={node.value}
                      placeholder="字段值"
                      onChange={(val) => handleUpdateField(path, 'value', val)}
                      availableVars={availableVars}
                      className="w-full bg-surface/60 border border-transparent focus-within:border-accent/50 text-gray-200 rounded px-1.5 py-0.5"
                    />
                  )}
                </div>

                {/* Description */}
                <input
                  type="text"
                  value={node.description || ''}
                  placeholder="说明 / 描述"
                  onChange={(e) =>
                    handleUpdateField(path, 'description', e.target.value)
                  }
                  className="w-full bg-surface/60 border border-transparent focus:border-accent/50 text-gray-400 placeholder-gray-600 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                />

                {/* Operations */}
                <div className="flex items-center justify-center gap-1">
                  {isContainer && (
                    <button
                      type="button"
                      onClick={() => handleAddChild(path)}
                      className="p-1 rounded bg-subtle hover:bg-hover text-amber-400 hover:text-amber-300 transition"
                      title="添加子字段"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddSibling(path)}
                    className="p-1 rounded bg-subtle hover:bg-hover text-gray-300 hover:text-foreground transition"
                    title="添加同级字段"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(path)}
                    className="p-1 rounded bg-subtle hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition"
                    title="删除字段"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {flattenedNodes.length === 0 && (
            <div className="py-6 text-center text-gray-500 text-xs">
              暂无可视化字段，点击下方添加根字段
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddRootField}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-subtle hover:bg-hover border border-line text-gray-300 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5 text-accent" />
          <span>添加根字段</span>
        </button>

        <button
          type="button"
          onClick={handleResetToTemplate}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-subtle hover:bg-hover border border-line text-gray-400 hover:text-gray-200 transition text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          <span>重置为标准示例</span>
        </button>
      </div>
    </div>
  );
};
