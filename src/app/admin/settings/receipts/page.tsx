export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import {
  inp, lbl, Section, Toggle, Card, Divider, SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

// Settings → Receipts. Lets the owner tune the printed POS receipt
// + the in-page invoice without code: header tagline, footer message,
// return-policy line, and the optional VAT block (number + line text)
// for when the store hits the £90k VAT threshold and needs to issue
// VAT-compliant tax receipts.
//
// Everything lives in site_settings as plain key/value rows so it
// follows the same upsert path every other settings page uses.

const PATH = '/admin/settings/receipts';

export default async function SettingsReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  const headerTagline = g('receipt_header_tagline', 'aizel.co.uk');
  const footerMessage = g('receipt_footer_message', 'Thanks for shopping with Aizel.');
  const returnPolicy  = g('receipt_return_policy', 'Returns accepted within 14 days with this receipt.');
  const vatEnabled    = g('receipt_vat_enabled', 'false') === 'true';
  const vatNumber     = g('receipt_vat_number', '');
  const vatLine       = g('receipt_vat_line', 'VAT included where applicable.');

  return (
    <>
      <SettingsPageHeader
        title="Receipts"
        subtitle="What appears on the printed till receipt + the order invoice. Changes apply to every receipt printed from now on; previously-emailed copies are unchanged."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section
            title="Header & footer"
            desc="The tagline sits under the Aizel mark at the top of every receipt. The footer message prints just below the totals — keep it short so it fits an 80mm thermal roll."
          />
          <Divider />
          <div>
            <label style={lbl}>Header tagline</label>
            <input
              name="receipt_header_tagline"
              type="text"
              defaultValue={headerTagline}
              maxLength={80}
              placeholder="aizel.co.uk"
              style={inp}
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
              e.g. your website, a tagline, or a phone number. Max 80 characters.
            </p>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>Footer message</label>
            <textarea
              name="receipt_footer_message"
              defaultValue={footerMessage}
              rows={2}
              maxLength={160}
              placeholder="Thanks for shopping with Aizel."
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </Card>

        <Card>
          <Section
            title="Return policy line"
            desc="Printed in small text under the totals so customers can see your returns window at a glance. Leave blank to omit."
          />
          <Divider />
          <input
            name="receipt_return_policy"
            type="text"
            defaultValue={returnPolicy}
            maxLength={200}
            placeholder="Returns accepted within 14 days with this receipt."
            style={inp}
          />
        </Card>

        <Card>
          <Section
            title="VAT receipt"
            desc="Turn this on once Aizel is VAT-registered. Adds your VAT number and a one-line statement to every receipt so it doubles as a valid VAT invoice."
          />
          <Divider />
          <Toggle name="receipt_vat_enabled" checked={vatEnabled} />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginTop: 14 }}>
            <div>
              <label style={lbl}>VAT number</label>
              <input
                name="receipt_vat_number"
                type="text"
                defaultValue={vatNumber}
                maxLength={20}
                placeholder="GB123456789"
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>VAT line text</label>
              <input
                name="receipt_vat_line"
                type="text"
                defaultValue={vatLine}
                maxLength={160}
                placeholder="VAT included where applicable."
                style={inp}
              />
            </div>
          </div>
        </Card>

        {/* Live preview — paints what the print receipt will look like
            using the *current* form values is fiddly without a client
            wrapper, so we render the *saved* values. The owner saves
            and lands back here to see the change reflected. */}
        <Card>
          <Section
            title="Preview"
            desc="A rendering of the current saved values. Save the form to refresh it."
          />
          <Divider />
          <div style={{
            background: '#fafafa', border: '1px dashed #d1d5db', borderRadius: 8,
            padding: '20px 24px', maxWidth: 360, margin: '0 auto',
            fontFamily: 'sans-serif', color: '#111827',
          }}>
            <div style={{ textAlign: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#6B2C91', letterSpacing: '-0.02em' }}>Aizel</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{headerTagline}</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>AZ-P-2401  ·  25 May 2026</div>
            <div style={{ margin: '14px 0', fontSize: '0.8125rem', color: '#374151' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sample item × 2</span><span>£24.00</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Another product × 1</span><span>£12.50</span></div>
            </div>
            <div style={{ borderTop: '1px solid #111827', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Total</span><span>£36.50</span>
            </div>
            {(returnPolicy || vatEnabled || footerMessage) && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #d1d5db', fontSize: '0.6875rem', color: '#6b7280', textAlign: 'center', lineHeight: 1.5 }}>
                {returnPolicy && <div>{returnPolicy}</div>}
                {vatEnabled && (
                  <div style={{ marginTop: 4 }}>
                    {vatLine}{vatNumber ? ` · VAT ${vatNumber}` : ''}
                  </div>
                )}
                {footerMessage && <div style={{ marginTop: 4, fontWeight: 600, color: '#374151' }}>{footerMessage}</div>}
              </div>
            )}
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
