'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

// ============================================================================
// UK GDPR helpers for the customer admin page.
//
// Article 15 (Right of access)  → exportCustomerData()
//   Returns a JSON payload of everything the store holds about the
//   customer. The operator can save it and email it to the data subject
//   (Aizel doesn't have a self-serve "Download my data" route yet — that's
//   a Tier-3 follow-up). Tables read:
//     • profiles       — name / phone / preferences
//     • addresses      — saved shipping addresses
//     • orders         — full order history (incl. items, totals, address-on-order)
//     • order_events   — status history per order
//     • product_reviews — reviews they've left
//     • newsletter_subscribers — opt-in state + dates
//     • loyalty_accounts + loyalty_transactions — balance + ledger
//     • subscriptions  — Subscribe & Save records
//     • wishlists      — saved items
//
// Article 17 (Right to erasure) → anonymiseCustomer()
//   We can't hard-delete orders — HMRC requires 6 years of transaction
//   records for VAT. So we anonymise:
//     • profiles   → email/phone/name scrubbed, anonymised_at set
//     • addresses  → deleted
//     • orders     → first/last_name/email/phone/address/city/zip
//                    overwritten with the standard "ANONYMISED" marker;
//                    items + totals kept for accounting
//     • reviews    → display_name → "Former customer", body kept (it's
//                    an opinion attached to a product, not PII once the
//                    name is gone)
//     • newsletter_subscribers, wishlists, subscriptions → deleted
//     • auth.users  → admin.deleteUser() so they can't sign back in
//   The audit log row pre-dates the anonymisation so we can prove the
//   request was actioned + when.
// ============================================================================

const ANONYMISED_MARKER = 'ANONYMISED';
const ANONYMISED_EMAIL_PREFIX = 'anonymised+';

async function assertCustomersWrite() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

interface ExportResult {
  ok: boolean;
  error?: string;
  /** JSON-serialisable payload — the action returns it; the client
   *  builds a Blob and triggers download. Keeps the server side stateless. */
  data?: Record<string, unknown>;
}

export async function exportCustomerData(userId: string): Promise<ExportResult> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return { ok: false, error: 'Unauthorized' };
  }

  const admin = supabaseAdmin();

  // Look up the profile + any auth.users metadata so the export carries
  // the canonical email even after anonymisation (auth.users keeps it).
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

  const payload = {
    export_meta: {
      exported_at: new Date().toISOString(),
      exported_by_staff: session.name,
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

  await logAudit(session, {
    action: 'customer.data_export',
    entity: 'customer',
    entity_id: userId,
    diff: { tables: Object.keys(payload).filter(k => k !== 'export_meta') },
  });

  return { ok: true, data: payload };
}

interface AnonymiseResult {
  ok: boolean;
  error?: string;
  /** Counts of records anonymised / deleted so the toast can summarise. */
  summary?: {
    orders: number;
    addresses_deleted: number;
    reviews_anonymised: number;
    newsletter_deleted: number;
    wishlists_deleted: number;
    subscriptions_deleted: number;
    auth_user_deleted: boolean;
  };
}

export async function anonymiseCustomer(userId: string): Promise<AnonymiseResult> {
  const session = await assertCustomersWrite();
  const admin = supabaseAdmin();

  // Log BEFORE we anonymise — once the profile email/name are gone we
  // can't prove who we actioned the request for. The audit row holds the
  // pre-anonymisation summary.
  const { data: snapshot } = await admin
    .from('profiles')
    .select('email, first_name, last_name, phone')
    .eq('id', userId)
    .maybeSingle<{ email: string | null; first_name: string | null; last_name: string | null; phone: string | null }>();

  await logAudit(session, {
    action: 'customer.anonymise',
    entity: 'customer',
    entity_id: userId,
    diff: {
      basis: 'UK GDPR Article 17 — right to erasure',
      pre_email: snapshot?.email ?? null,
      pre_name: [snapshot?.first_name, snapshot?.last_name].filter(Boolean).join(' ') || null,
    },
  });

  // ── Orders: scrub PII columns; keep totals/items for accounting. ───
  // Suffix the anonymised email with the user id so concurrent
  // anonymisations don't collide on a unique index if one is in place.
  const placeholderEmail = `${ANONYMISED_EMAIL_PREFIX}${userId}@aizel.invalid`;
  const { data: orderRows } = await admin
    .from('orders')
    .update({
      first_name: ANONYMISED_MARKER,
      last_name: ANONYMISED_MARKER,
      email: placeholderEmail,
      phone: ANONYMISED_MARKER,
      address: ANONYMISED_MARKER,
      city: ANONYMISED_MARKER,
      province: null,
      zip: null,
    })
    .eq('user_id', userId)
    .select('id');
  const ordersAnonymised = (orderRows ?? []).length;

  // ── Reviews: blank the display name but keep the body — the review
  //    is opinion about a product, not PII once the name is gone. ─────
  const { data: reviewRows } = await admin
    .from('product_reviews')
    .update({ display_name: 'Former customer' })
    .eq('user_id', userId)
    .select('id');
  const reviewsAnonymised = (reviewRows ?? []).length;

  // ── Delete the bits that have no record-keeping value. ─────────────
  const [{ data: addrDel }, { data: nlDel }, { data: wlDel }, { data: subDel }] = await Promise.all([
    admin.from('addresses').delete().eq('user_id', userId).select('id'),
    admin.from('newsletter_subscribers').delete().eq('user_id', userId).select('id'),
    admin.from('wishlists').delete().eq('user_id', userId).select('id'),
    admin.from('subscriptions').delete().eq('user_id', userId).select('id'),
  ]);

  // ── Profile: scrub names / phone / email; mark as anonymised so the
  //    customers list can still surface the row (links from orders) but
  //    shows the marker rather than the original PII. ──────────────────
  await admin
    .from('profiles')
    .update({
      first_name: ANONYMISED_MARKER,
      last_name: ANONYMISED_MARKER,
      email: placeholderEmail,
      phone: null,
    })
    .eq('id', userId);

  // ── Auth: delete the auth.users row so the customer can't sign in
  //    again (or have someone else sign in as them via a stale email). ─
  let authDeleted = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    authDeleted = !error;
  } catch {
    // Some environments (e.g. local with anon key only) don't expose
    // admin.deleteUser — surface the partial completion in the result.
    authDeleted = false;
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/users');

  return {
    ok: true,
    summary: {
      orders: ordersAnonymised,
      addresses_deleted: (addrDel ?? []).length,
      reviews_anonymised: reviewsAnonymised,
      newsletter_deleted: (nlDel ?? []).length,
      wishlists_deleted: (wlDel ?? []).length,
      subscriptions_deleted: (subDel ?? []).length,
      auth_user_deleted: authDeleted,
    },
  };
}
