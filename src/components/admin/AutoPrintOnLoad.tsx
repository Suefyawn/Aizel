'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// When the URL carries `?print=1`, fire window.print() once the page
// hydrates. Used to wire the POS "Print receipt" button on the post-
// sale screen — cashier taps the button, a new tab opens at the order
// detail with `?print=1`, the print dialog opens automatically, the
// cashier hits Print (or it auto-prints on a kiosk-mode setup).
//
// Small delay so the page has time to load fonts + paint the invoice
// card. 250ms is enough for the SSR'd content to be visible.
export function AutoPrintOnLoad() {
  const params = useSearchParams();
  const wantsPrint = params.get('print') === '1';

  useEffect(() => {
    if (!wantsPrint) return;
    const t = window.setTimeout(() => { window.print(); }, 250);
    return () => window.clearTimeout(t);
  }, [wantsPrint]);

  return null;
}
