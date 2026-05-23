import type { BankAccount } from '@/types';

/** Parse the `pay_bank_accounts` site-setting (a JSON string written by the
 *  admin BankAccountsEditor) into a typed array. Returns [] on missing or
 *  malformed data, and drops any entry without a name + number. */
export function parseBankAccounts(raw: string | null | undefined): BankAccount[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map(x => ({
        label: String(x.label ?? '').trim(),
        title: String(x.title ?? '').trim(),
        number: String(x.number ?? '').trim(),
        iban: String(x.iban ?? '').trim(),
      }))
      .filter(a => a.label && a.number);
  } catch {
    return [];
  }
}
