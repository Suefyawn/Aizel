'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// Persist staff-curated notes + tags for a customer. Both writes go
// through customers.edit — a view-only staffer can't accidentally
// retag or rewrite a profile while reading it.

const NotesSchema = z.string().max(4000);
const TagsSchema  = z.array(z.string().trim().min(1).max(40)).max(20);

export interface CustomerExtrasView {
  notes: string;
  tags:  string[];
  updated_at: string | null;
}

export async function getCustomerExtras(userId: string): Promise<CustomerExtrasView> {
  // No permission gate here — this is called from server components that
  // already gate at the page level (customers.view).
  const { data } = await supabaseAdmin()
    .from('customer_profile_extras')
    .select('notes, tags, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    notes: data?.notes ?? '',
    tags:  data?.tags ?? [],
    updated_at: data?.updated_at ?? null,
  };
}

async function upsertExtras(userId: string, patch: { notes?: string; tags?: string[] }) {
  const session = await assertPermission('customers.edit');
  const admin = supabaseAdmin();
  const { data: before } = await admin
    .from('customer_profile_extras')
    .select('notes, tags')
    .eq('user_id', userId)
    .maybeSingle();
  // Upsert keyed by user_id (the PK). Writes only the changed columns and
  // bumps updated_by + updated_at.
  const payload = {
    user_id: userId,
    ...patch,
    // session.id is the staff member's auth.users.id — the FK on
    // updated_by points at the same table.
    updated_by: session.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from('customer_profile_extras')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) return { ok: false as const, error: error.message };
  await logAudit(session, {
    action: 'customer.extras_updated',
    entity: 'customer',
    entity_id: userId,
    diff: { before, after: patch },
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true as const };
}

export async function setCustomerNotes(userId: string, notes: string) {
  const parsed = NotesSchema.safeParse(notes);
  if (!parsed.success) return { ok: false as const, error: 'Note is too long (max 4000 chars)' };
  return upsertExtras(userId, { notes: parsed.data });
}

export async function setCustomerTags(userId: string, tags: string[]) {
  // De-duplicate case-insensitively while preserving the first-seen
  // casing — "VIP" wins over "vip" if it was typed first.
  const dedup: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(t);
  }
  const parsed = TagsSchema.safeParse(dedup);
  if (!parsed.success) return { ok: false as const, error: 'Tags must be ≤20 entries, each ≤40 chars' };
  return upsertExtras(userId, { tags: parsed.data });
}
