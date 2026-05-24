'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType }

interface ToastContextValue { toast: (message: string, type?: ToastType) => void }
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const colors: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
    success: { bg: '#f0fdf4', border: '#86efac', color: '#15803d', icon: '✓' },
    error:   { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', icon: '✕' },
    info:    { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', icon: 'i' },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="adm-toast-stack" style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = colors[t.type];
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 10,
              background: c.bg, border: `1px solid ${c.border}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              pointerEvents: 'auto', maxWidth: 360,
              animation: 'toast-in 0.2s ease',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
              }}>{c.icon}</span>
              <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
