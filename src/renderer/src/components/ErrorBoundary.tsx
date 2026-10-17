import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-canvas text-foreground select-none">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">视图渲染发生异常</h2>
          <p className="text-xs text-gray-400 max-w-md text-center mb-4 font-mono break-all bg-surface border border-line p-2.5 rounded-lg">
            {this.state.error?.message || '未知错误'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center gap-1.5 shadow transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重新加载界面</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
