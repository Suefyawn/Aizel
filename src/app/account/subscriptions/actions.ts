'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase as authedClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase';
import { SUBSCRIPTION_INTERVALS } from '@/lib/subscriptions';

const DAY_MS = 86_400_000;

// authedClient() is the @supabase/ssr server client — reads the customer's
// session from cookies so RLS on reorder_subscriptions applies.

function nextReminderIso(intervalDays: number): string {
  return new Date(Date.now() + intervalDays * DAY_MS).toISOString();
}

// ─── PDP opt-in ─────────────────────────────────────────────────────────────
export type SubscribeResult =
  | { ok: true; interval_days: number }
  | { ok: false; error: string }
  | null;

export async function subscribeToProduct(
  _prev: SubscribeResult,
  formData: FormData,
): Promise<SubscribeResult> {
  const productId = String(formData.get('product_id') ?? '');
  const variantRaw = String(formData.get('variant_id') ?? '');
  const variantId = variantRaw && variantRaw !== 'null' ? variantRaw : null;
  const intervalDays = Number(formData.get('interval_days'));

  if (!productId) return { ok: false, error: 'Missing product.' };
  if (!SUBSCRIPTION_INTERVALS.includes(intervalDays as never)) {
    return { ok: false, error: 'Pick a valid delivery frequency.' };
  }

  const sb = await authedClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user || !user.email) return { ok: false, error: 'Please sign in to subscribe.' };

  // Subscribe & Save is currently inactive for Aizel's hair/body care
  // catalogue — the original "wellness consumables" eligibility window doesn't
  // apply to the new taxonomy. To re-enable, change `subscribeEligible` to a
  // per-taxon check (e.g. `taxonForCategory(...)?.key === 'body'`) and remove
  // the `false` constant below.
  const { data: product } = await supabase
    .from('products').select('category').eq('id', productId).maybeSingle();
  const eligible = false;
  if (!product || !eligible) {
    return { ok: false, error: "This product isn't available for Subscribe & Save." };
  }

  // Re-activate / update an existing live subscription, else insert a new one.
  let lookup = sb.from('reorder_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .neq('status', 'cancelled');
  lookup = variantId ? lookup.eq('variant_id', variantId) : lookup.is('variant_id', null);
  const { data: existing } = await lookup.limit(1);

  if (existing && existing.length > 0) {
    const { error } = await sb.from('reorder_subscriptions')
      .update({
        interval_days: intervalDays,
        status: 'active',
        next_reminder_at: nextReminderIso(intervalDays),
        email: user.email,
      })
      .eq('id', existing[0].id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await sb.from('reorder_subscriptions').insert({
      user_id: user.id,
      email: user.email,
      product_id: productId,
      variant_id: variantId,
      interval_days: intervalDays,
      next_reminder_at: nextReminderIso(intervalDays),
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/account/subscriptions');
  return { ok: true, interval_days: intervalDays };
}

// ─── Account management ─────────────────────────────────────────────────────
// Return Promise<void> so these bind directly to <form action={…}>. RLS on
// reorder_subscriptions guarantees a customer can only touch their own rows.

export async function setSubscriptionStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['active', 'paused', 'cancelled'].includes(status)) return;

  const sb = await authedClient();
  const patch: Record<string, unknown> = { status };

  // Resuming: push the next reminder out by a fresh interval so a sub that
  // was paused well past its due date doesn't fire instantly.
  if (status === 'active') {
    const { data } = await sb.from('reorder_subscriptions')
      .select('interval_days').eq('id', id).maybeSingle();
    if (data) patch.next_reminder_at = nextReminderIso(data.interval_days);
  }

  await sb.from('reorder_subscriptions').update(patch).eq('id', id);
  revalidatePath('/account/subscriptions');
}

export async function updateSubscriptionCadence(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const intervalDays = Number(formData.get('interval_days'));
  if (!id || !SUBSCRIPTION_INTERVALS.includes(intervalDays as never)) return;

  const sb = await authedClient();
  await sb.from('reorder_subscriptions')
    .update({ interval_days: intervalDays, next_reminder_at: nextReminderIso(intervalDays) })
    .eq('id', id);
  revalidatePath('/account/subscriptions');
}
