import type { Metadata } from 'next';

// Auth flow pages should not be indexed (audit SEV-2). Server-component
// layout because the page itself is 'use client'.
export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
