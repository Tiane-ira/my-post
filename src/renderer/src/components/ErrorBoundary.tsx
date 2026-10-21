import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  isModal?: boolean;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    try {
      const errText = `[ErrorBoundary] ${error?.name}: ${error?.message}\n${error?.stack || ''}\nComponentStack:\n${errorInfo?.componentStack || ''}`;
      if (typeof window !== 'undefined' && (window as any).mypostAPI?.writeDebugLog) {
        (window as any).mypostAPI.writeDebugLog(errText);
      }
    } catch {}
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false });
  };

  public handleCopyError = () => {
    if (this.state.error) {
      const text = `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack || ''}`;
      navigator.clipboard?.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.isModal) {
        return (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 select-none">
            <div className="w-[620px] max-w-full bg-surface border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
              <div className="h-12 px-5 bg-surface border-b border-line flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>窗口渲染发生异常</span>
                </div>
                {this.props.onClose && (
                  <button
                    onClick={this.props.onClose}
                    className="p-1.5 rounded-lg hover:bg-hover text-gray-400 hover:text-foreground transition cursor-pointer"
                    title="关闭 (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-5 flex flex-col gap-3">
                <div className="text-xs text-gray-300">
                  该配置窗口在渲染时遇到了未捕获异常：
                </div>
                <div className="bg-canvas border border-line p-3 rounded-lg text-xs font-mono text-rose-400 max-h-52 overflow-y-auto whitespace-pre-wrap select-text">
                  <div className="font-bold mb-1">{this.state.error?.message || '未知错误'}</div>
                  {this.state.error?.stack && (
                    <div className="text-[11px] text-gray-500 border-t border-line/50 pt-2 mt-2">
                      {this.state.error.stack}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="px-3 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {this.state.copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">已复制错误日志</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>复制错误信息</span>
                      </>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    {this.props.onClose && (
                      <button
                        type="button"
                        onClick={this.props.onClose}
                        className="px-4 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 text-xs transition cursor-pointer"
                      >
                        关闭窗口
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={this.handleReset}
                      className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>重试渲染</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-canvas text-foreground select-none">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">视图渲染发生异常</h2>
          <div className="max-w-xl w-full max-h-60 overflow-auto bg-surface border border-line p-3 rounded-lg text-left text-xs text-gray-300 font-mono mb-4 whitespace-pre-wrap select-text">
            <div className="text-rose-400 font-bold mb-1">{this.state.error?.message || '未知错误'}</div>
            {this.state.error?.stack && (
              <div className="text-[11px] text-gray-500 border-t border-line/50 pt-2 mt-2">
                {this.state.error.stack}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleCopyError}
              className="px-3 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              {this.state.copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制错误</span>
                </>
              )}
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重试渲染</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 rounded-lg bg-subtle hover:bg-hover border border-line text-gray-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>重新加载应用</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
