import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface FeedbackContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Add Toast
  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    warning: (msg: string, dur?: number) => addToast('warning', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
  };

  // Confirm Modal
  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions =
        typeof options === 'string'
          ? { message: options, title: '操作确认', type: 'danger' }
          : {
              title: options.title || '操作确认',
              type: options.type || 'warning',
              ...options,
            };

      setConfirmState({
        isOpen: true,
        options: opts,
        resolve: (val: boolean) => {
          setConfirmState(null);
          resolve(val);
        },
      });
    });
  }, []);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Notification Container */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center gap-2 max-w-md w-full px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-auto px-4 py-2.5 rounded-xl bg-surface/95 backdrop-blur-xl border border-line shadow-2xl flex items-center gap-2.5 text-xs text-gray-200 animate-in fade-in slide-in-from-top-3 duration-200"
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}

            <span className="font-medium whitespace-pre-wrap">{t.message}</span>

            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 p-0.5 rounded hover:bg-hover text-gray-400 hover:text-foreground transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="w-[420px] bg-surface border border-line rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                }`}
              >
                {confirmState.options.type === 'danger' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : confirmState.options.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <HelpCircle className="w-4 h-4" />
                )}
              </div>
              <div className="font-bold text-sm text-foreground">
                {confirmState.options.title || '操作确认'}
              </div>
            </div>

            {/* Message Body */}
            <div className="text-xs text-gray-300 leading-relaxed pl-10">
              {confirmState.options.message}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => confirmState.resolve(false)}
                className="px-4 py-1.5 rounded-xl bg-subtle hover:bg-hover border border-line text-xs text-gray-300 font-medium transition"
              >
                {confirmState.options.cancelText || '取消'}
              </button>

              <button
                type="button"
                onClick={() => confirmState.resolve(true)}
                className={`px-4 py-1.5 rounded-xl text-xs text-white font-bold transition shadow-lg ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                    : 'bg-accent hover:bg-accent-hover shadow-orange-500/10'
                }`}
              >
                {confirmState.options.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
