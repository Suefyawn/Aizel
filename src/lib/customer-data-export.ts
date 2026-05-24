// ============================================================================
// Shared Article-15 export assembler.
//
// Two callers — admin (operator-actioned SAR via /admin/users/[id]) and
// customer self-serve (/account/data-export). Both produce the same
// JSON payload so the data subject gets a consistent file regardless of
// who triggered it.
//
// Server-only — pulls via supabaseAdmin which bypasses RLS. Callers MUST
// authenticate the requester before invoking; this module trusts the
// caller to have verified that `userId` is who they say they are.
// ============================================================================

import { supabaseAdmin } from './supabase';

export interface ExportMeta {
  /** Free-text describing how the export was triggered + by whom.
   *  Admin: "actioned by <staff name>". Self-serve: "self-serve by data subject". */
  triggered_by: string;
  /** ISO timestamp. */
  exported_at: string;
  /** UUID of the data subject. */
  data_subject_id: string;
  /** Legal basis text — always Article 15 for these exports. */
  basis: string;
}

export interface CustomerExport {
  export_meta: ExportMeta;
  profile: unknown;
  addresses: unknown[];
  orders: unknown[];
  order_events: unknown[];
  reviews: unknown[];
  newsletter_subscription: unknown[];
  loyalty: { account: unknown; transactions: unknown[] };
  subscriptions: unknown[];
  wishlists: unknown[];
}

/**
 * Pulls every table that holds PII or activity for the data subject and
 * returns a JSON-serialisable payload. The shape is stable — additions
 * happen by appending keys; existing keys keep their meaning so previous
 * exports stay parseable.
 */
export async function assembleCustomerExport(
  userId: string,
  triggeredBy: string,
): Promise<CustomerExport> {
  const admin = supabaseAdmin();

  const [
    { data: profile },
    { data: addresses },
    { data: orders },
    { data: reviews },
    { data: newsletter },
    { data: loyaltyAcct },
    { data: subscriptions },
    { data: wishlists },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    admin.from('addresses').select('*').eq('user_id', userId),
    admin.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('product_reviews').select('*').eq('user_id', userId),
    admin.from('newsletter_subscribers').select('*').eq('user_id', userId),
    admin.from('loyalty_accounts').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('subscriptions').select('*').eq('user_id', userId),
    admin.from('wishlists').select('*').eq('user_id', userId),
  ]);

  // Loyalty transactions joined to the account, when present.
  let loyaltyLedger: unknown[] = [];
  if (loyaltyAcct && (loyaltyAcct as { id?: string }).id) {
    const { data: ledger } = await admin
      .from('loyalty_transactions')
      .select('*')
      .eq('account_id', (loyaltyAcct as { id: string }).id)
      .order('created_at', { ascending: true });
    loyaltyLedger = ledger ?? [];
  }

  // Order events tied to this user's orders.
  let orderEvents: unknown[] = [];
  const orderIds = ((orders ?? []) as Array<{ id: string }>).map(o => o.id);
  if (orderIds.length > 0) {
    const { data: events } = await admin
      .from('order_events')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true });
    orderEvents = events ?? [];
  }

  return {
    export_meta: {
      triggered_by: triggeredBy,
      exported_at: new Date().toISOString(),
      data_subject_id: userId,
      basis: 'UK GDPR Article 15 — right of access',
    },
    profile: profile ?? null,
    addresses: addresses ?? [],
    orders: orders ?? [],
    order_events: orderEvents,
    reviews: reviews ?? [],
    newsletter_subscription: newsletter ?? [],
    loyalty: {
      account: loyaltyAcct ?? null,
      transactions: loyaltyLedger,
    },
    subscriptions: subscriptions ?? [],
    wishlists: wishlists ?? [],
  };
}
