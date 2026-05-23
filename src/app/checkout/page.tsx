import type { Metadata } from 'next';
import { CheckoutPage } from '@/sections/checkout/CheckoutPage';
import { getSiteSettings } from '@/lib/supabase';
import { parseBankAccounts } from '@/lib/bank-accounts';
import type { PayMethod } from '@/types';

// Cart→checkout pages must not be indexed (audit SEV-2). Also override the
// page title — without this it inherits the homepage default.
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function CheckoutRoute() {
  // Read which payment methods the merchant has toggled on in admin settings.
  // Default: all on (matching the historical hard-coded behaviour) — so a
  // fresh install or a row that isn't in site_settings yet still works.
  const settings = await getSiteSettings();
  const isEnabled = (key: string) => settings[key] !== 'false';
  const bankAccounts = parseBankAccounts(settings.pay_bank_accounts);
  const enabledMethods: PayMethod[] = [
    isEnabled('pay_card_enabled')      && 'card',
    isEnabled('pay_cod_enabled')       && 'cod',
    // Bank Transfer is only offered once at least one account is configured —
    // otherwise the customer reaches a dead end with nowhere to pay.
    (isEnabled('pay_bank_enabled') && bankAccounts.length > 0) && 'bank',
  ].filter(Boolean) as PayMethod[];

  return (
    <main className="fade-in">
      <CheckoutPage
        enabledMethods={enabledMethods}
        bankAccounts={bankAccounts}
        bankNotes={settings.pay_bank_instructions ?? ''}
      />
    </main>
  );
}
