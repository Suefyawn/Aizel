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
        Last updated: 23 May 2026
      </p>

      <PrivacyCenter />

      <section style={{ marginTop: 48 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>Who we are</h2>
        <p className="body-text" style={{ color: 'var(--ink-700)' }}>
          Aizel is an online retailer of authentic Afro/Black hair and body care brands, operating
          in the United Kingdom. We are the &ldquo;data controller&rdquo; for the personal data
          described below, as defined by the UK GDPR and the Data Protection Act 2018. When you
          shop with us we collect the information needed to deliver your order and improve our
          service &mdash; nothing more.
        </p>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>Lawful basis for processing</h2>
        <ul style={{ color: 'var(--ink-700)', lineHeight: 1.7, paddingLeft: 20 }}>
          <li><strong>Contract:</strong> we need your address and contact details to deliver the order you placed.</li>
          <li><strong>Legal obligation:</strong> we retain order records for HMRC tax compliance (6 years).</li>
          <li><strong>Legitimate interest:</strong> transactional email about your order status — you can stop these by cancelling the order.</li>
          <li><strong>Consent:</strong> analytics cookies and the marketing newsletter. You opt-in via the cookie banner / signup form, and you can withdraw consent any time.</li>
        </ul>
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
        <h2 className="h2" style={{ marginBottom: 16 }}>Your rights under the UK GDPR</h2>
        <p className="body-text" style={{ color: 'var(--ink-700)' }}>
          You have the right to: access the data we hold about you, request a correction, request
          deletion (&ldquo;right to be forgotten&rdquo;), object to processing, restrict processing,
          and receive your data in a portable format. Email{' '}
          <a href="mailto:privacy@aizel.co.uk" className="underline">privacy@aizel.co.uk</a> and we&apos;ll
          respond within one calendar month. If you&apos;re not happy with how we&apos;ve handled your
          request, you can complain to the UK&apos;s Information Commissioner&apos;s Office at{' '}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="underline">ico.org.uk</a>.
        </p>
      </section>

      <section style={{ marginTop: 36 }}>
        <h2 className="h2" style={{ marginBottom: 16 }}>How long we keep data</h2>
        <ul style={{ color: 'var(--ink-700)', lineHeight: 1.7, paddingLeft: 20 }}>
          <li><strong>Order records:</strong> 6 years from the order date (HMRC retention rule).</li>
          <li><strong>Account profiles:</strong> until you delete your account.</li>
          <li><strong>Marketing list:</strong> until you unsubscribe.</li>
          <li><strong>Analytics events:</strong> 14 months in aggregate; no individual identifiers.</li>
        </ul>
      </section>
    </article>
  );
}
