'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface WishlistContextValue {
  wishlist: string[];
  toggle: (id: string) => void;
  isWishlisted: (id: string) => boolean;
  /** Remove every id from the list — used by the "Clear all" affordance
   *  on the wishlist page. */
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const KEY = 'yp_wishlist';

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  // Start empty so the first client render matches the server-rendered HTML.
  // Initialising from localStorage synchronously made them differ (server =
  // empty, client = stored), which triggered React hydration errors (#418)
  // and broke interactivity site-wide — the heart on every product tile
  // renders from this state. localStorage is an external store; it is
  // synced in after mount. (CartContext already does exactly this.)
  const [wishlist, setWishlist] = useState<string[]>([]);

  // This effect is declared before the persist effect so, on mount, load()
  // reads the real stored value into state before the persist effect's
  // first run can overwrite localStorage with the empty initial state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWishlist(load());
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(wishlist)); } catch { /* quota */ }
  }, [wishlist]);

  const toggle = useCallback((id: string) => {
    setWishlist(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const isWishlisted = useCallback((id: string) => wishlist.includes(id), [wishlist]);
  const clear = useCallback(() => setWishlist([]), []);

  return (
    <WishlistContext.Provider value={{ wishlist, toggle, isWishlisted, clear }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
