export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { BankAccountsEditor } from '@/components/admin/BankAccountsEditor';
import { parseBankAccounts } from '@/lib/bank-accounts';
import {
  inp, lbl, Section, Card, Divider, PayMethodRow,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/payments';

export default async function SettingsPaymentsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Payments"
        subtitle="Which payment options the customer sees at checkout, and which bank/wallet accounts they pay to for manual transfers."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Payment methods" desc="Unticked methods disappear from the checkout picker entirely. Default: all on." />
          <Divider />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PayMethodRow
              name="pay_card_enabled"
              checked={g('pay_card_enabled', 'true') !== 'false'}
              label="Credit / Debit card"
              desc="Visa, Mastercard, Amex via Stripe. Requires STRIPE_SECRET_KEY env var (integration pending)."
            />
            <PayMethodRow
              name="pay_cod_enabled"
              checked={g('pay_cod_enabled', 'false') !== 'false'}
              label="Cash on Delivery (COD)"
              desc="Customer pays the courier when the order arrives. Off by default for UK orders."
            />
            <PayMethodRow
              name="pay_bank_enabled"
              checked={g('pay_bank_enabled', 'true') !== 'false'}
              label="Bank transfer"
              desc="Manual: the customer transfers to one of your accounts, then you confirm and ship. Add your accounts below — they show at checkout and on the order confirmation page."
            />
          </div>
        </Card>

        <Card>
          <Section title="Bank & wallet accounts" desc="Shown to customers who choose Bank Transfer. Add as many as you like." />
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <BankAccountsEditor name="pay_bank_accounts" initial={parseBankAccounts(g('pay_bank_accounts'))} />
            <div>
              <label style={lbl}>Additional notes (optional)</label>
              <textarea
                name="pay_bank_instructions"
                defaultValue={g('pay_bank_instructions', '')}
                rows={2}
                style={{ ...inp, resize: 'vertical' }}
                placeholder="e.g. Send your transfer receipt to our WhatsApp to confirm the order."
              />
            </div>
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
