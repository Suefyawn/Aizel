'use client';

import React, { createContext, useContext, useState } from 'react';

interface SearchContextValue {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <SearchContext.Provider value={{ searchOpen, setSearchOpen }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}
