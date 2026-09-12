'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './Icon';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  tone?: ToastTone;
  action?: ToastAction;
  duration?: number;
}

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, optionsOrTone?: ToastTone | ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneConfig: Record<ToastTone, { icon: string; cls: string }> = {
  success: { icon: 'checkCircle', cls: 'text-positive' },
  error: { icon: 'alertCircle', cls: 'text-negative' },
  info: { icon: 'info', cls: 'text-info' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, optionsOrTone?: ToastTone | ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const tone: ToastTone = typeof optionsOrTone === 'string' ? optionsOrTone : optionsOrTone?.tone || 'success';
    const action = typeof optionsOrTone === 'object' ? optionsOrTone.action : undefined;
    const duration = typeof optionsOrTone === 'object' && optionsOrTone.duration ? optionsOrTone.duration : action ? 6000 : 4000;

    setItems((prev) => [...prev, { id, tone, message, action }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 end-4 z-[300] flex flex-col gap-2 max-w-[calc(100vw-2rem)] w-[340px] pointer-events-none">
        {items.map((t) => {
          const cfg = toneConfig[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-2.5 p-3 rounded-md border border-border bg-surface-elevated shadow-lg anim-rise"
            >
              <span className={cfg.cls}>
                <Icon name={cfg.icon} size={18} />
              </span>
              <span className="t-body-m flex-1 min-w-0">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={async () => {
                    setItems((prev) => prev.filter((x) => x.id !== t.id));
                    await t.action?.onClick();
                  }}
                  className="text-xs font-semibold text-accent hover:underline focus-ring rounded-sm px-1.5 py-0.5 shrink-0"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
                className="text-text-muted hover:text-text shrink-0 focus-ring rounded-sm"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful no-op if used outside provider (e.g. auth screens).
    return { toast: () => undefined };
  }
  return ctx;
};
