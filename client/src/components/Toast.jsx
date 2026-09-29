import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Toasts clear themselves. Success sits for 3s; anything that is part of the
// argument — a revert, a refusal — stays a little longer, because on stage the
// failure is the interesting part.

const ToastContext = createContext(null);

const TONE = {
  ok: { wrap: 'border-emerald-200 bg-white', dot: 'bg-emerald-500', title: 'text-emerald-800' },
  error: { wrap: 'border-rose-200 bg-white', dot: 'bg-rose-500', title: 'text-rose-800' },
  info: { wrap: 'border-slate-200 bg-white', dot: 'bg-slate-400', title: 'text-slate-800' },
  warn: { wrap: 'border-amber-200 bg-white', dot: 'bg-amber-500', title: 'text-amber-800' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tone = toast.tone || 'info';
      const ttl = toast.ttl ?? (tone === 'error' || tone === 'warn' ? 5200 : 3000);
      setToasts((current) => [...current.slice(-3), { id, tone, ...toast }]);
      setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      ok: (title, detail) => push({ tone: 'ok', title, detail }),
      error: (title, detail) => push({ tone: 'error', title, detail }),
      info: (title, detail) => push({ tone: 'info', title, detail }),
      warn: (title, detail) => push({ tone: 'warn', title, detail }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const tone = TONE[toast.tone] || TONE.info;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${tone.wrap}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${tone.title}`}>{toast.title}</p>
                {toast.detail && (
                  <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-600">
                    {toast.detail}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-mr-1 -mt-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
