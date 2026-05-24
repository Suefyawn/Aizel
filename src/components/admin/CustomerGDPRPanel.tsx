'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import { exportCustomerData, anonymiseCustomer } from '@/app/admin/users/[id]/gdpr-actions';

interface Props {
  userId: string;
  /** Display name (or email) — used in the confirm dialog copy. */
  displayName: string;
  /** Permission gate — when false, render the panel in a disabled state
   *  rather than hiding it (operator still sees the controls exist + a
   *  hint about why they can't fire them). */
  canManage: boolean;
}

// Two GDPR actions sit at the bottom of the customer detail page:
//   1. Export — Article 15. Returns a JSON the operator emails to the
//      data subject; no third-party tooling involved.
//   2. Anonymise & remove — Article 17. Double-confirms because it
//      strips PII from orders and deletes the auth.users row.
//
// Both are deliberately understated — they sit at the bottom of the
// page, not in the top bar, so the operator doesn't fire them by
// reflex; surfacing them at all is the point (proves the obligation
// is workable without a developer in the loop).
export function CustomerGDPRPanel({ userId, displayName, canManage }: Props) {
  const [exporting, startExportTransition] = useTransition();
  const [anonymising, startAnonTransition] = useTransition();
  const [done, setDone] = useState(false);
  const toast = useToast();

  const handleExport = () => {
    startExportTransition(async () => {
      const result = await exportCustomerData(userId);
      if (!result.ok || !result.data) {
        toast(result.error ?? 'Export failed', 'error');
        return;
      }
      const json = JSON.stringify(result.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // ISO-date filename — sorts cleanly when the operator is filing
      // multiple SARs in a folder.
      const date = new Date().toISOString().slice(0, 10);
      a.download = `aizel-customer-${userId.slice(0, 8)}-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Data export downloaded', 'success');
    });
  };

  const handleAnonymise = () => {
    // Two-step confirm: first warns about scope, second requires the
    // operator to type "DELETE" so a misclick can't fire it.
    const firstConfirm = window.confirm(
      `Anonymise ${displayName}?\n\n` +
      `This will:\n` +
      `  • Scrub their name, email, phone, and address from every order\n` +
      `  • Blank their review display names\n` +
      `  • Delete saved addresses, wishlist, subscriptions, newsletter sign-up\n` +
      `  • Delete the auth.users row so they can't sign in\n\n` +
      `Order rows are KEPT for UK VAT record-keeping (HMRC requires 6 years).\n\n` +
      `This action is NOT reversible.`,
    );
    if (!firstConfirm) return;
    const typed = window.prompt(`Type DELETE in capitals to confirm anonymisation of ${displayName}.`);
    if (typed !== 'DELETE') {
      toast('Anonymisation cancelled', 'success');
      return;
    }

    startAnonTransition(async () => {
      const result = await anonymiseCustomer(userId);
      if (!result.ok) {
        toast(result.error ?? 'Anonymisation failed', 'error');
        return;
      }
      const s = result.summary!;
      const parts: string[] = [];
      if (s.orders) parts.push(`${s.orders} order${s.orders !== 1 ? 's' : ''} scrubbed`);
      if (s.reviews_anonymised) parts.push(`${s.reviews_anonymised} review${s.reviews_anonymised !== 1 ? 's' : ''} blanked`);
      if (s.addresses_deleted) parts.push(`${s.addresses_deleted} address${s.addresses_deleted !== 1 ? 'es' : ''} removed`);
      if (s.auth_user_deleted) parts.push('sign-in disabled');
      toast(parts.join(' · ') || 'Customer anonymised', 'success');
      setDone(true);
    });
  };

  if (done) {
    return (
      <div style={{
        background: '#f0fdf4', borderRadius: 10, padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #bbf7d0',
        fontSize: '0.875rem', color: '#15803d',
      }}>
        ✓ Customer anonymised. Refresh the page or return to the customers list.
      </div>
    );
  }

  return (
    <div style={{
      background: 'white', borderRadius: 10,
      padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      marginTop: 20, borderTop: '3px solid #4A1A6B',
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
        UK GDPR — data subject rights
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Tools for handling Article 15 (access) and Article 17 (erasure) requests
        without leaving the admin. The export is JSON for emailing to the data
        subject; the anonymise action strips PII from orders but keeps the
        records for HMRC&apos;s 6-year retention requirement.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !canManage}
          style={{
            padding: '9px 16px', background: exporting ? '#9ca3af' : '#4A1A6B',
            color: 'white', border: 'none', borderRadius: 7,
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: exporting || !canManage ? 'not-allowed' : 'pointer',
            opacity: !canManage ? 0.5 : 1,
            minHeight: 38,
          }}
        >
          {exporting ? 'Building export…' : 'Download data export (JSON)'}
        </button>

        <button
          type="button"
          onClick={handleAnonymise}
          disabled={anonymising || !canManage}
          style={{
            padding: '9px 16px',
            background: anonymising ? '#9ca3af' : 'transparent',
            color: anonymising ? 'white' : '#dc2626',
            border: '1px solid ' + (anonymising ? '#9ca3af' : '#fca5a5'),
            borderRadius: 7,
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: anonymising || !canManage ? 'not-allowed' : 'pointer',
            opacity: !canManage ? 0.5 : 1,
            minHeight: 38,
          }}
        >
          {anonymising ? 'Anonymising…' : 'Anonymise & remove customer'}
        </button>

        {!canManage && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            (requires customers.edit permission)
          </span>
        )}
      </div>
    </div>
  );
}
