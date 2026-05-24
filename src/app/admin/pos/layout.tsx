// POS uses a custom layout — NOT the standard AdminShell — because:
//   • The till is touchscreen-first; nav chrome would eat real estate.
//   • Cashiers want one job at a time; a sidebar full of "Customers /
//     Reviews / Settings" is a distraction that invites typos.
//   • The screen often runs on a dedicated tablet locked to /admin/pos;
//     the rest of admin should feel like a separate app.
//
// Permission gate happens at the page level; this layout just sets the
// background + suppresses the regular admin chrome.

import { Suspense } from 'react';

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F0F10',  // dark canvas so product photos pop + the
                                // operator can dim store lighting without
                                // washing out the till
        color: '#F5F5F7',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
