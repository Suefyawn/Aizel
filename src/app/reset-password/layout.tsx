import type { Metadata } from 'next';

// Same as /forgot-password — noindex + clean title. Audit SEV-2.
export const metadata: Metadata = {
  title: 'Set new password',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
