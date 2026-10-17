import React, { useState } from 'react';
import {
  X,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Download,
  Square,
  CheckSquare
} from 'lucide-react';
import { ApiDetail, ApiTreeNode, EnvironmentInfo } from '../../../common/types';
import { useFeedback } from './FeedbackContext';

interface RunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  treeItems: ApiTreeNode[];
  projectId: string;
  currentEnv: EnvironmentInfo | null;
}

interface RunnerResultItem {
  id: string;
  name: string;
  method: string;
  statusCode: number;
  timeMs: number;
  passed: boolean;
  testSummary: string;
}

export const RunnerModal: React.FC<RunnerModalProps> = ({
  isOpen,
  onClose,
  treeItems,
  projectId,
  currentEnv,
}) => {
  const { toast } = useFeedback();
  const apiItems = treeItems.filter((t) => t.target_type === 'api');
  const [selectedIds, setSelectedIds] = useState<string[]>(apiItems.map((a) => a.target_id));
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<RunnerResultItem[]>([]);

  if (!isOpen) return null;

  const handleToggleAll = () => {
    if (selectedIds.length === apiItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(apiItems.map((a) => a.target_id));
    }
  };

  const handleToggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRun = async () => {
    if (selectedIds.length === 0) {
      toast.warning('请至少选择一个接口进行批量测试');
      return;
    }
    setRunning(true);
    setResults([]);
    setCurrentIndex(0);

    const envVars: Record<string, string> = {};
    if (currentEnv?.list) {
      for (const item of currentEnv.list) {
        if (item.is_checked === 1 && item.key) envVars[item.key] = item.value;
      }
    }

    const preUrl = currentEnv?.pre_url || '';
    const newResults: RunnerResultItem[] = [];

    for (let i = 0; i < selectedIds.length; i++) {
      const targetId = selectedIds[i];
      setCurrentIndex(i + 1);

      try {
        const detail = await window.mypostAPI.getApiDetail(projectId, targetId);
        if (detail) {
          const res = await window.mypostAPI.sendRequest(detail, envVars, {}, preUrl);
          const testsPassed = (res.tests || []).every((t) => t.passed);
          const passCount = (res.tests || []).filter((t) => t.passed).length;
          const totalCount = res.tests?.length || 0;

          const isPass = res.statusCode >= 200 && res.statusCode < 400 && (totalCount === 0 || testsPassed);

          newResults.push({
            id: targetId,
            name: detail.name,
            method: detail.method,
            statusCode: res.statusCode,
            timeMs: res.timeMs,
            passed: isPass,
            testSummary: totalCount > 0 ? `${passCount}/${totalCount} 断言通过` : '无断言',
          });
          setResults([...newResults]);
        }
      } catch (err: any) {
        newResults.push({
          id: targetId,
          name: '请求异常',
          method: 'GET',
          statusCode: 0,
          timeMs: 0,
          passed: false,
          testSummary: err.message,
        });
        setResults([...newResults]);
      }
    }
    setRunning(false);
    toast.success(`批量测试完成: 共 ${newResults.length} 个接口，${newResults.filter((r) => r.passed).length} 个通过`);
  };

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.length - totalPassed;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[800px] h-[600px] bg-surface border border-line rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="h-11 px-4 bg-subtle border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>自动化测试与批量运行器 (Runner)</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-hover text-gray-400 hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Bar */}
        <div className="p-4 bg-surface border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold">总测试用例</div>
              <div className="text-base font-bold text-foreground">{selectedIds.length} 个</div>
            </div>
            <div>
              <div className="text-[10px] text-emerald-500 uppercase font-semibold">通过 (Passed)</div>
              <div className="text-base font-bold text-emerald-400">{totalPassed}</div>
            </div>
            <div>
              <div className="text-[10px] text-rose-500 uppercase font-semibold">失败 (Failed)</div>
              <div className="text-base font-bold text-rose-400">{totalFailed}</div>
            </div>
            <div>
              <div className="text-[10px] text-blue-500 uppercase font-semibold">当前环境</div>
              <div className="text-xs font-mono text-gray-300">{currentEnv ? currentEnv.name : '无环境'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              {running ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              <span>{running ? `正在执行 (${currentIndex}/${selectedIds.length})...` : '开始执行批量测试'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left API Checklist */}
          <div className="w-64 border-r border-line bg-surface p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                <button
                  onClick={handleToggleAll}
                  className="flex items-center gap-1.5 text-gray-300 font-semibold"
                >
                  {selectedIds.length === apiItems.length ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500" />
                  )}
                  <span>全选 ({apiItems.length})</span>
                </button>
              </div>

              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {apiItems.map((api) => {
                  const isChecked = selectedIds.includes(api.target_id);
                  return (
                    <div
                      key={api.target_id}
                      onClick={() => handleToggleOne(api.target_id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-hover text-gray-300"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      <span className="text-[10px] font-bold text-amber-400">{api.method}</span>
                      <span className="truncate text-xs">{api.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Results Table */}
          <div className="flex-1 p-3 overflow-y-auto bg-surface">
            <div className="font-semibold text-gray-300 mb-2">执行结果清单</div>
            <div className="border border-line rounded-lg overflow-hidden bg-surface">
              <div className="grid grid-cols-[40px_1fr_70px_70px_80px_130px] bg-surface border-b border-line font-semibold py-2 px-3 text-gray-400 select-none">
                <div>#</div>
                <div>接口名称</div>
                <div>方法</div>
                <div>状态码</div>
                <div>耗时</div>
                <div>断言结果</div>
              </div>

              <div className="divide-y divide-line">
                {results.map((r, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[40px_1fr_70px_70px_80px_130px] py-2 px-3 hover:bg-hover items-center text-xs"
                  >
                    <div className="text-gray-500">{idx + 1}</div>
                    <div className="font-medium text-gray-200 truncate pr-2">{r.name}</div>
                    <div>
                      <span className="text-[10px] font-bold text-accent">{r.method}</span>
                    </div>
                    <div>
                      <span className={`font-bold ${r.statusCode === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.statusCode || 'ERR'}
                      </span>
                    </div>
                    <div className="font-mono text-gray-400">{r.timeMs} ms</div>
                    <div className="flex items-center gap-1.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span className={`text-[11px] truncate ${r.passed ? 'text-emerald-300' : 'text-rose-400'}`}>
                        {r.testSummary}
                      </span>
                    </div>
                  </div>
                ))}

                {results.length === 0 && (
                  <div className="py-20 text-center text-gray-500">
                    点击右上角「开始执行批量测试」，查看实时测试报告
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
