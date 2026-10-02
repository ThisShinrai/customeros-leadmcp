'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: string; kind: ToastKind; message: string }

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = `t${++counter}`;
    // Keep at most 3 visible — newest win.
    setToasts((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => remove(id), 4200);
  }, [remove]);

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
  };

  const icons: Record<ToastKind, React.ReactNode> = {
    success: <Check size={16} />,
    error: <AlertCircle size={16} />,
    info: <Info size={16} />,
  };
  const colors: Record<ToastKind, string> = { success: '#16A34A', error: '#DC2626', info: 'var(--black)' };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 11, background: 'var(--black)', color: '#fff',
            padding: '12px 16px', borderRadius: 14, boxShadow: '0 16px 44px rgba(0,0,0,.3)',
            fontSize: 13.5, fontWeight: 500, minWidth: 280, maxWidth: 440, pointerEvents: 'auto',
            animation: 'toastIn .32s var(--ease)',
          }}>
            <span style={{ display: 'flex', width: 24, height: 24, borderRadius: 7, background: colors[t.kind], alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {icons[t.kind]}
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => remove(t.id)} style={{ color: 'rgba(255,255,255,.5)', display: 'flex', flexShrink: 0 }}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback if used outside a provider.
    return { toast: () => {}, success: () => {}, error: () => {} };
  }
  return ctx;
}
