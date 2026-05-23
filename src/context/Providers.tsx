'use client';

import { CartProvider } from './CartContext';
import { SearchProvider } from './SearchContext';
import { AuthProvider } from './AuthContext';
import { WishlistProvider } from './WishlistContext';
import { PHProvider } from '@/components/analytics/PostHogProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <SearchProvider>
              {children}
            </SearchProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </PHProvider>
  );
}
