import type { Metadata } from 'next';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { WA_TEMPLATES } from '@/lib/whatsapp';
import { getSiteSettings, supabaseAdmin } from '@/lib/supabase';
import { parseBankAccounts } from '@/lib/bank-accounts';
import { BankAccountsList } from '@/components/checkout/BankAccountsList';
import type { BankAccount } from '@/types';

// Order-confirmation page should never be indexed — leaks order_number
// existence + lets crawlers guess valid IDs (audit SEV-2 + SEV-3).
export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const orderNumber = order ?? 'AZ-??????';

  // For a bank-transfer order, show the accounts to pay into. Look up the
  // order's pay method (orders RLS blocks anon — service-role read).
  let bankAccounts: BankAccount[] = [];
  let bankNotes = '';
  if (order) {
    const { data: row } = await supabaseAdmin()
      .from('orders').select('pay_method').eq('order_number', order).maybeSingle();
    if (row?.pay_method === 'bank') {
      const settings = await getSiteSettings();
      bankAccounts = parseBankAccounts(settings.pay_bank_accounts);
      bankNotes = settings.pay_bank_instructions ?? '';
    }
  }

  return (
    <main className="fade-in">
      <section style={{ padding: 'var(--section-gap) 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <Overline style={{ display: 'block', marginBottom: 12, color: 'var(--ink-500)' }}>Order Confirmed</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>Thank you!</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 8 }}>
            Your order <strong>{orderNumber}</strong> has been placed successfully.
          </p>
          <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 32 }}>
            We&apos;ll send you a confirmation on WhatsApp with tracking details once your order ships. Delivery typically takes 2–4 business days.
          </p>

          {bankAccounts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <BankAccountsList accounts={bankAccounts} notes={bankNotes} reference={orderNumber} />
            </div>
          )}

          <div style={{ background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 24, marginBottom: 32, textAlign: 'left' }}>
            <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>What Happens Next</Overline>
            {[
              { step: '1', label: 'Preparing', desc: "We're packing your items with care." },
              { step: '2', label: 'Shipped', desc: "Royal Mail Tracked — tracking lands by email once it's on the van." },
              { step: '3', label: 'Delivered', desc: 'Usually within 2–3 working days across the UK.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: i < 2 ? 16 : 0 }}>
                {/* Brand-pink (purple) step badges with white digits — were
                    gold and read as a YellowPink hangover at this size. */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--brand-pink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{s.step}</div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                  <div className="small-text">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp CTA — pre-types the order number so the merchant can
              triage in one tap. Hides if NEXT_PUBLIC_WHATSAPP_NUMBER unset. */}
          <div style={{ marginBottom: 24 }}>
            <WhatsAppButton message={WA_TEMPLATES.orderQuestion(orderNumber)} />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <Link href="/shop" className="btn-primary">Continue Shopping</Link>
            <Link href="/" className="btn-secondary">Back to Home</Link>
          </div>

          {/* Post-purchase opt-in — soft ask after a successful order. The
              checkout itself doesn't ship the email to the newsletter list
              (consent must be explicit), this is the explicit moment. */}
          <div
            style={{
              padding: 20,
              background: 'var(--paper2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-card)',
              textAlign: 'left',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>
              Stay in the loop
            </Overline>
            <p className="small-text" style={{ marginBottom: 12, color: 'var(--ink-700)' }}>
              Get a fortnightly note on new drops, restocks, and routine tips. Unsubscribe any time.
            </p>
            <NewsletterSignup source="post_purchase" variant="light" ctaLabel="Sign up" />
          </div>
        </div>
      </section>
    </main>
  );
}
