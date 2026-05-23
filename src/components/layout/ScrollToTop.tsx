'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Next's App Router scroll-to-top is unreliable when the destination route
// has a loading.tsx: the skeleton can be shorter than the offset you left,
// the browser clamps the scroll, and the new page opens part-way down —
// often at the footer. This forces scroll-to-top on every forward
// navigation. Back/forward (popstate) navigations are left untouched so the
// browser still restores their position, and #anchor links are honoured.
export function ScrollToTop() {
  const pathname = usePathname();
  const isPopNavigation = useRef(false);

  useEffect(() => {
    const onPopState = () => { isPopNavigation.current = true; };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    // Back/forward: let the browser restore the previous scroll position.
    if (isPopNavigation.current) {
      isPopNavigation.current = false;
      return;
    }
    // Deep link to an in-page section (e.g. /product/x#reviews): let the
    // browser scroll to the anchor instead of yanking to the top.
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
