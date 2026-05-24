import type { Metadata } from 'next';
import Link from 'next/link';
import { DataExportClient } from './DataExportClient';

// `account/*` is auth-gated by AccountLayout; no extra check needed here.
// `noindex` because the page only makes sense for a signed-in customer.
export const metadata: Metadata = {
  title: 'Download my data',
  robots: { index: false, follow: false },
};

export default function DataExportPage() {
  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }} aria-hidden="true">/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>
            Download my data
          </h1>
        </div>

        <div style={{
          background: 'white', borderRadius: 16, padding: 32,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--line)',
        }}>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 16 }}>
            Under UK GDPR Article 15 you have the right to a copy of the
            personal data we hold about you. This page lets you download
            that copy as a JSON file — no email round-trip, no waiting.
          </p>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24 }}>
            The export includes your profile, saved addresses, order
            history, reviews, newsletter preferences, loyalty balance +
            ledger, subscriptions and wishlist. It does NOT include things
            we don&apos;t hold (e.g. data shared with Stripe to process a
            card payment — request those directly from{' '}
            <a
              href="https://stripe.com/privacy"
              target="_blank" rel="noopener noreferrer"
              className="underline"
              style={{ color: 'var(--brand-pink-text)' }}
            >Stripe</a>).
          </p>

          <DataExportClient />

          <hr className="hairline" style={{ margin: '28px 0 20px' }} />

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500, margin: '0 0 8px' }}>
            Want to erase your data?
          </h2>
          <p className="small-text" style={{ color: 'var(--ink-700)', margin: 0 }}>
            Email{' '}
            <a href="mailto:privacy@aizel.co.uk" className="underline" style={{ color: 'var(--brand-pink-text)' }}>
              privacy@aizel.co.uk
            </a>{' '}
            and we&apos;ll action your erasure within 30 days. Some
            information (order records for VAT) stays on file for the 6
            years HMRC requires, but everything else is scrubbed.
          </p>
        </div>
      </div>
    </div>
  );
}
