'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Product } from '@/types';

// localStorage-backed "Recently viewed" feed.
//
// Persists a trimmed, render-ready summary of each viewed product (just
// the fields ProductTile actually needs) so the rail can paint without a
// network round-trip. The choice deliberately trades a tiny amount of
// staleness (stored price/stock might drift from the live row) for a
// no-flicker experience — the customer is comparing what they JUST saw,
// not the latest server state, so the trade-off is correct.
//
// Cap is 12 items so a long browse session doesn't bloat localStorage;
// the rail only renders the first 8.

const STORAGE_KEY = 'aizel:recently-viewed';
const MAX_STORED = 12;

export interface RecentlyViewedItem {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number;
  original_price?: number;
  image_url?: string;
  category: string;
  /** Optional fields below kept so ProductTile gets a complete render
   *  even with partial localStorage entries from older versions. */
  stock?: number;
  track_inventory?: boolean;
  kind?: Product['kind'];
  rating?: number | null;
  review_count?: number | null;
  created_at?: string;
  is_bestseller?: boolean | null;
}

function readStored(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Light validation — drop anything that's missing the minimum tile fields.
    return parsed.filter((p): p is RecentlyViewedItem =>
      !!p && typeof p === 'object' && typeof (p as RecentlyViewedItem).id === 'string'
      && typeof (p as RecentlyViewedItem).slug === 'string'
      && typeof (p as RecentlyViewedItem).name === 'string'
      && typeof (p as RecentlyViewedItem).price === 'number',
    );
  } catch {
    return [];
  }
}

function writeStored(items: RecentlyViewedItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // QuotaExceeded → silently drop. Recently-viewed is best-effort.
  }
}

/** Push a product to the front of the recently-viewed list (dedup + cap). */
export function trackView(product: Product): void {
  if (typeof window === 'undefined') return;
  const summary: RecentlyViewedItem = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    price: product.price,
    original_price: product.original_price,
    image_url: product.image_url,
    category: product.category,
    stock: product.stock,
    track_inventory: product.track_inventory,
    kind: product.kind,
    rating: product.rating,
    review_count: product.review_count,
    created_at: product.created_at,
    is_bestseller: product.is_bestseller,
  };
  const current = readStored().filter(p => p.id !== product.id);
  current.unshift(summary);
  writeStored(current.slice(0, MAX_STORED));
}

/**
 * Hook returning the recently-viewed list (excluding `excludeId` so a PDP
 * doesn't show its own product back to the customer). Re-reads on mount;
 * does not subscribe to storage events (the rail is decorative — a
 * mid-session refresh is fine).
 */
export function useRecentlyViewed(excludeId?: string): RecentlyViewedItem[] {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  useEffect(() => {
    // Read storage on mount — no need for an event listener, the rail
    // is shown once per page load.
    setItems(readStored());
  }, []);
  return excludeId ? items.filter(p => p.id !== excludeId) : items;
}

/**
 * Imperative tracker — used inside a PDP mount effect so the current
 * product gets added to the feed without re-renders. Returns a stable
 * callback so the effect's deps array stays clean.
 */
export function useTrackView(product: Product | null | undefined): void {
  const track = useCallback(() => {
    if (product) trackView(product);
  }, [product]);
  useEffect(() => {
    track();
  }, [track]);
}
