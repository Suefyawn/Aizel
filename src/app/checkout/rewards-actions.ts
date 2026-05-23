'use server';

// Server actions backing the checkout's rewards section (gift card,
// loyalty points, referral code). All read-only — the actual
// debit/credit happens after the order RPC succeeds.

import { supabase } from '@/lib/supabase';

export async function validateGiftCardCode(code: string): Promise<{ valid: boolean; balance: number; currency: string }> {
  const cleaned = code.trim();
  if (!cleaned) return { valid: false, balance: 0, currency: 'GBP' };
  const { data } = await supabase.rpc('validate_gift_card' as never, { p_code: cleaned } as never);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as { valid: boolean; balance: number; currency: string } | undefined;
  if (!row) return { valid: false, balance: 0, currency: 'GBP' };
  return { valid: row.valid, balance: Number(row.balance), currency: row.currency };
}

export async function validateReferralCode(code: string): Promise<{ valid: boolean; discount_pct: number }> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return { valid: false, discount_pct: 0 };
  const { data } = await supabase.rpc('validate_referral_code' as never, { p_code: cleaned } as never);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as { valid: boolean; discount_pct: number } | undefined;
  if (!row) return { valid: false, discount_pct: 0 };
  return { valid: row.valid, discount_pct: Number(row.discount_pct) };
}
