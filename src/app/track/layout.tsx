import type { Metadata } from 'next';

// The /track page itself is 'use client' (form + state), so it can't export
// metadata directly. This server-component layout sets the page-level meta
// — title override + noindex (audit SEV-2: order-lookup page shouldn't
// surface in SERPs).
export const metadata: Metadata = {
  title: 'Track order',
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
