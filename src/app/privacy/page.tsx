import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { PrivacyCenter } from './PrivacyCenter';

export const metadata: Metadata = pageMeta({
  title: 'Privacy & Cookies',
  description:
    'How Aizel uses cookies, what data we collect, and how to change your cookie preferences at any time.',
  path: '/privacy',
});

// Server component renders the static policy text; PrivacyCenter (client)
// hosts the interactive consent toggles + last-updated stamp.
export default function PrivacyPage() {
  return (
    <article className="container fade-in" style={{ padding: '64px var(--side)', maxWidth: 760 }}>
      <h1 className="display-l" style={{ fontSize: '2.5rem', margin: '0 0 12px' }}>
        Privacy &amp; cookies
      </h1>
      <p style={{ color: 'var(--ink-500)', fontSize: '0.875rem', marginBottom: 32 }}>
        Last updated: 18 May 2026
      </p>

      <PrivacyCenter />

      <section style={{ marginTop: 48 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>Who we are</h2>
        <p className="body-text" style={{ color: 'var(--ink-700)' }}>
          Aizel is an online beauty and wellness retailer operating in the UK. When you
          shop with us we collect the information needed to deliver your order and improve our
          service — nothing more.
        </p>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>What we collect</h2>
        <ul style={{ color: 'var(--ink-700)', lineHeight: 1.7, paddingLeft: 20 }}>
          <li><strong>Account info:</strong> name, email, phone, shipping address.</li>
          <li><strong>Order info:</strong> items purchased, totals, courier tracking number.</li>
          <li><strong>Browsing info (essential):</strong> a session cookie so the cart works across pages.</li>
          <li><strong>Browsing info (analytics, opt-in):</strong> aggregate page-view + Web Vitals data, no PII.</li>
          <li><strong>Browsing info (marketing, opt-in):</strong> a retargeting cookie for relevant ads.</li>
        </ul>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>How we use it</h2>
        <ul style={{ color: 'var(--ink-700)', lineHeight: 1.7, paddingLeft: 20 }}>
          <li>To process and deliver your orders, including handing your address to the courier.</li>
          <li>To send you transactional email (order confirmation, shipped, delivered, refund).</li>
          <li>With your opt-in, to send our newsletter about new products and offers — you can unsubscribe any time.</li>
          <li>With your opt-in, to measure which pages help shoppers find what they need.</li>
        </ul>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>What we don&apos;t do</h2>
        <ul style={{ color: 'var(--ink-700)', lineHeight: 1.7, paddingLeft: 20 }}>
          <li>We never sell your personal information.</li>
          <li>We never share your data with third parties beyond what&apos;s needed to deliver your order.</li>
          <li>We never enable analytics or marketing cookies until you choose to allow them.</li>
        </ul>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>Your rights</h2>
        <p className="body-text" style={{ color: 'var(--ink-700)' }}>
          You can ask us at any time to: see the data we hold about you, correct it, or delete your
          account. Email <a href="mailto:privacy@aizel.co.uk" className="underline">privacy@aizel.co.uk</a>{' '}
          and we&apos;ll respond within 30 days.
        </p>
      </section>
    </article>
  );
}
