'use client';

import { useEffect } from 'react';

// Registers /sw.js once on first render. In dev we *unregister* any
// previously-installed worker so HMR isn't blocked.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
  }, []);
  return null;
}
