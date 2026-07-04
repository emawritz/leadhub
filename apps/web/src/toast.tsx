import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { stageColor } from '@leadhub/core/stages';

type Kind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: Kind; msg: string };
type Ctx = { push: (kind: Kind, msg: string) => void };

const ToastCtx = createContext<Ctx | null>(null);

const KIND_COLOR: Record<Kind, string> = {
  success: stageColor('ganado'),
  error: stageColor('perdido'),
  info: 'var(--color-accent)',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, msg: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => remove(id), 3000);
  }, [remove]);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : undefined}
            className="card bg-surface px-4 py-2.5 text-[13px] text-ink shadow-lg max-w-xs flex items-start justify-between gap-2"
            style={{ borderLeft: `3px solid ${KIND_COLOR[t.kind]}` }}
          >
            <span>{t.msg}</span>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => remove(t.id)}
              className="cursor-pointer hover:opacity-70 shrink-0 text-ink"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast fuera de ToastProvider');
  return {
    success: (msg: string) => ctx.push('success', msg),
    error: (msg: string) => ctx.push('error', msg),
    info: (msg: string) => ctx.push('info', msg),
  };
}
