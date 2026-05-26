'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { assembleCustomerExport } from '@/lib/customer-data-export';

// ============================================================================
// UK GDPR helpers for the customer admin page.
//
// Article 15 (Right of access)  → exportCustomerData()
//   Returns a JSON payload of everything the store holds about the
//   customer. The operator can save it and email it to the data subject.
//   The assembler (`assembleCustomerExport`) is the source of truth for
//   which tables are read.
//
// Article 17 (Right to erasure) → anonymiseCustomer()
//   We can't hard-delete orders — HMRC requires 6 years of transaction
//   records for VAT. So we anonymise:
//     • profiles   → first/last/phone scrubbed (email lives on auth.users,
//                    not profiles, so it is killed via admin.deleteUser())
//     • addresses  → deleted
//     • orders     → first/last_name/email/phone/address/city/zip
//                    overwritten with the standard "ANONYMISED" marker;
//                    items + totals kept for accounting
//     • reviews    → author_name → "Former customer", body kept (an
//                    opinion attached to a product, not PII once the name
//                    is gone). reviewer_email is also nulled.
//     • newsletter_subscribers → deleted by email (no user_id column)
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

  // Same assembler as the customer-facing self-serve route in
  // /account/data-export — both produce the same JSON shape so the data
  // subject gets a consistent file regardless of who triggered it.
  const payload = await assembleCustomerExport(userId, `actioned by staff: ${session.name}`);

  await logAudit(session, {
    action: 'customer.data_export',
    entity: 'customer',
    entity_id: userId,
    diff: { tables: Object.keys(payload).filter(k => k !== 'export_meta') },
  });

  return { ok: true, data: payload as unknown as Record<string, unknown> };
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
    auth_user_deleted: boolean;
  };
}

export async function anonymiseCustomer(userId: string): Promise<AnonymiseResult> {
  const session = await assertCustomersWrite();
  const admin = supabaseAdmin();

  // Log BEFORE we anonymise — once the name is gone we can't prove who we
  // actioned the request for. The pre-anonymisation snapshot is held in
  // the audit row's diff.
  const { data: snapshot } = await admin
    .from('profiles')
    .select('first_name, last_name, phone')
    .eq('id', userId)
    .maybeSingle<{ first_name: string | null; last_name: string | null; phone: string | null }>();

  // Pull the auth-side email up front — that's where the email of record
  // lives (profiles has no `email` column). We need it for two things:
  //   1. The audit row, so the operator can prove WHO they erased.
  //   2. The newsletter_subscribers delete — its only customer key is
  //      `email`, not `user_id`.
  let preEmail: string | null = null;
  try {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    preEmail = authData?.user?.email ?? null;
  } catch {
    // Local/anon environments don't expose admin.getUserById; tolerated.
  }

  await logAudit(session, {
    action: 'customer.anonymise',
    entity: 'customer',
    entity_id: userId,
    diff: {
      basis: 'UK GDPR Article 17 — right to erasure',
      pre_email: preEmail,
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

  // ── Reviews: blank the visible name + reviewer email but keep the body
  //    — the review is opinion about a product, not PII once the name is
  //    gone. Column is `author_name` (not `display_name`). ──────────────
  const { data: reviewRows } = await admin
    .from('product_reviews')
    .update({ author_name: 'Former customer', reviewer_email: null })
    .eq('user_id', userId)
    .select('id');
  const reviewsAnonymised = (reviewRows ?? []).length;

  // ── Delete the bits that have no record-keeping value. Newsletter
  //    subscribers are keyed on `email`, not `user_id`, so the lookup
  //    is two-step. ───────────────────────────────────────────────────
  const [{ data: addrDel }, nlResult] = await Promise.all([
    admin.from('addresses').delete().eq('user_id', userId).select('id'),
    preEmail
      ? admin.from('newsletter_subscribers').delete().eq('email', preEmail).select('id')
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);

  // ── Profile: scrub names + phone. The `profiles` table does NOT carry
  //    email; auth.users.email is the system of record and is killed by
  //    the deleteUser() call below. ───────────────────────────────────
  await admin
    .from('profiles')
    .update({
      first_name: ANONYMISED_MARKER,
      last_name: ANONYMISED_MARKER,
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
      newsletter_deleted: (nlResult.data ?? []).length,
      auth_user_deleted: authDeleted,
    },
  };
}
