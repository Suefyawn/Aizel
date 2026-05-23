'use client';

// Tiny localStorage-backed "recently viewed" tracker. Mount on PDP — it
// records the current product, then renders the previous 4 distinct
// product ids the user looked at.

import { useEffect, useState } from 'react';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Product } from '@/types';

const STORAGE_KEY = 'yp_recently_viewed';
const MAX_ITEMS = 12;
const DISPLAY = 4;

function loadIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveIds(ids: string[]): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* quota */ }
}

export function RecentlyViewed({ currentProductId }: { currentProductId: string }) {
  const [otherProducts, setOtherProducts] = useState<Product[]>([]);

  // Record + then load the previous N (excluding current).
  // setState-in-effect is intentional: localStorage is an external store
  // and the fetched rows arrive asynchronously.
  useEffect(() => {
    const existing = loadIds().filter(id => id !== currentProductId);
    const updated  = [currentProductId, ...existing].slice(0, MAX_ITEMS);
    saveIds(updated);

    const toFetch = existing.slice(0, DISPLAY);
    if (toFetch.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOtherProducts([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const sb = getBrowserClient();
      const { data } = await sb.from('products').select('*').in('id', toFetch);
      if (cancelled) return;
      const map = new Map(((data ?? []) as Product[]).map(p => [p.id, p]));
      // Preserve recent-first order.
      setOtherProducts(toFetch.map(id => map.get(id)).filter((p): p is Product => Boolean(p)));
    })();
    return () => { cancelled = true; };
  }, [currentProductId]);

  if (otherProducts.length === 0) return null;

  return (
    <section style={{ padding: 'var(--section-gap) 0', borderTop: '1px solid var(--line)' }}>
      <div className="container">
        <Overline style={{ display: 'block', marginBottom: 24 }}>Recently Viewed</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DISPLAY}, 1fr)`, gap: 'var(--gutter)' }} className="product-grid">
          {otherProducts.map(p => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
