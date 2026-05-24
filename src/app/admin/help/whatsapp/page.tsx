export const dynamic = 'force-dynamic';

import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { hasWhatsApp, merchantNumber, whatsappUrl, WA_TEMPLATES } from '@/lib/whatsapp';

// Plain content page — no migrations, no DB writes. Lives under /admin so
// only staff can see the setup instructions for the merchant phone.

export default async function WhatsAppHelpPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner) {
    return <NoAccess section="WhatsApp setup help" />;
  }
  const configured = hasWhatsApp();
  const number = merchantNumber();
  const previewUrl = whatsappUrl(WA_TEMPLATES.generic());

  return (
    <div style={{ padding: '32px 36px', maxWidth: 820 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>WhatsApp setup</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
        {'Aizel uses free wa.me deep links — no Cloud API, no card. Customers tap any "Chat on WhatsApp" button on the storefront and their app opens with your number pre-filled. You reply from the standard WhatsApp Business app on your phone.'}
      </p>

      <section style={card}>
        <h2 style={h2}>Current state</h2>
        {configured ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={dotOk} aria-hidden="true" />
            <span style={{ fontSize: '0.875rem' }}>
              Configured. Buttons render with number <strong style={{ fontFamily: 'monospace' }}>+{number}</strong>.
            </span>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#4A1A6B', textDecoration: 'none', fontWeight: 600 }}
              >
                Test the link →
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={dotWarn} aria-hidden="true" />
            <span style={{ fontSize: '0.875rem' }}>
              Not configured. Set <code>NEXT_PUBLIC_WHATSAPP_NUMBER</code> in your Vercel env vars to enable the buttons.
            </span>
          </div>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>Step 1 — install WhatsApp Business on the merchant phone</h2>
        <ol style={ol}>
          <li>{'Download WhatsApp Business from the Play Store or App Store. It is separate from the regular WhatsApp app — both can coexist if the merchant number is on a different SIM.'}</li>
          <li>{'Open the app and verify the merchant phone number (the same number you put in NEXT_PUBLIC_WHATSAPP_NUMBER, including the +44 country code).'}</li>
          <li>{'Fill in the business profile: name Aizel, address, hours, website (https://aizel.co.uk), category Beauty & Personal Care.'}</li>
        </ol>
      </section>

      <section style={card}>
        <h2 style={h2}>Step 2 — set up auto-replies (no AI needed)</h2>
        <p style={p}>
          {'In the Business app, go to Settings → Business tools. Three auto-reply features cover most of what an AI agent would do for $0:'}
        </p>
        <ul style={ul}>
          <li>
            <strong>Greeting message</strong>{' — sent automatically the first time a customer DMs you. Suggested copy: '}
            <em>{'Hi! Thanks for reaching out to Aizel. We typically reply within an hour during 10am–10pm UK time (GMT). For order tracking, please share your order number (starts with AZ-).'}</em>
          </li>
          <li>
            <strong>Away message</strong>{' — sent when you are offline. Suggested copy: '}
            <em>{'We are away right now. We will get back to you first thing in the morning. For urgent order issues, please email orders@aizel.co.uk.'}</em>
          </li>
          <li>
            <strong>Quick replies</strong>{' — type a shortcut to expand a saved message. Set these up:'}
            <ul style={{ ...ul, marginTop: 6 }}>
              <li><code>/track</code>{' → Please share your order number (starts with AZ-) and I will check the status.'}</li>
              <li><code>/shipping</code>{' → Free UK delivery on orders over £15. Mainland UK delivery takes 2–3 working days via Royal Mail or DPD.'}</li>
              <li><code>/return</code>{' → We accept returns within 14 days on unopened items. Reply with your order number to start a return.'}</li>
              <li><code>/payments</code>{' → We accept card (Visa, Mastercard, Amex) and bank transfer. Card payments are processed securely by Stripe.'}</li>
            </ul>
          </li>
        </ul>
      </section>

      <section style={card}>
        <h2 style={h2}>Step 3 — connect your catalog (optional)</h2>
        <p style={p}>
          {'In the Business app, go to Settings → Business tools → Catalog. Add your 5–10 bestsellers manually or sync from Meta Commerce Manager (free). Once set, customers can browse products inside the chat — useful for shade enquiries.'}
        </p>
      </section>

      <section style={card}>
        <h2 style={h2}>Where buttons appear on the site</h2>
        <ul style={ul}>
          <li><strong>Header (every page)</strong>{' — small green icon next to the search/account icons.'}</li>
          <li><strong>Product page</strong>{' — "Ask about this on WhatsApp" pill below the buy bar, pre-fills the product name.'}</li>
          <li><strong>Cart page</strong>{' — "Need help?" link under the checkout button.'}</li>
          <li><strong>Thank-you page</strong>{' — full-width CTA after the customer places an order, pre-fills the order number.'}</li>
          <li><strong>Admin order page</strong>{' — green "WhatsApp" button next to "Print invoice" — opens chat with the customer phone, pre-fills the order number for one-tap support reply.'}</li>
        </ul>
      </section>

      <section style={{ ...card, background: '#fef3c7', border: '1px solid #fde68a' }}>
        <h2 style={{ ...h2, color: '#92400e' }}>Important — what this does NOT do</h2>
        <ul style={{ ...ul, color: '#92400e' }}>
          <li>{'No automation — every customer reply is manual from the Business app.'}</li>
          <li>{'No outbound order-status pushes — those require the paid Cloud API.'}</li>
          <li>{'No AI-generated replies — also Cloud API + LLM.'}</li>
        </ul>
        <p style={{ ...p, color: '#92400e', marginTop: 8 }}>
          {'Move to the Cloud API path when you are ready to spend ~£600/month for those capabilities.'}
        </p>
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'white', borderRadius: 10, border: '1px solid #e5e7eb',
  padding: 20, marginBottom: 16,
};
const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' };
const p:  React.CSSProperties = { margin: '0 0 12px', fontSize: '0.875rem', color: '#374151', lineHeight: 1.55 };
const ol: React.CSSProperties = { margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 };
const ul: React.CSSProperties = { margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 };
const dotOk:   React.CSSProperties = { width: 10, height: 10, borderRadius: '50%', background: '#16a34a', display: 'inline-block' };
const dotWarn: React.CSSProperties = { width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' };
