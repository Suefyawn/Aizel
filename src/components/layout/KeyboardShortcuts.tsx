'use client';

import { useEffect } from 'react';
import { useSearch } from '@/context/SearchContext';

export function KeyboardShortcuts() {
  const { setSearchOpen } = useSearch();
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [setSearchOpen]);
  return null;
}
