'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { HOMEPAGE_CONTENT_TAG } from '@/lib/homepage-content';
import { z } from 'zod';

// Featured content (homepage blocks) — admin actions for the cards +
// tile rows shown on the storefront homepage. Same auth + audit pattern
// as every other admin action: owner OR `settings` permission, audit
// row per write, cache-tag invalidation on success.
//
// One row in `homepage_content` per block; `kind` discriminates the
// render shape. We keep the schema permissive (lots of nullable fields)
// because banner cards need title + image + CTA, but tile rows only
// need title + a list of slugs — the action validates per-kind.

const PATH = '/admin/settings/featured';

async function assertWrite() {
  const session = await getStaffSession();
  if (!session) throw new Error('Not authenticated');
  if (!session.isOwner && !session.permissions.includes('settings')) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ── Shared input shape ───────────────────────────────────────────────
const BlockInput = z.object({
  kind:           z.enum(['banner_card', 'category_row']),
  title:          z.string().trim().min(1, 'Title is required').max(120),
  subtitle:       z.string().trim().max(120).optional().or(z.literal('')),
  cta_text:       z.string().trim().max(60).optional().or(z.literal('')),
  cta_href:       z.string().trim().max(200).optional().or(z.literal('')),
  image_url:      z.string().trim().max(500).optional().or(z.literal('')),
  // Slugs come from a hidden field, comma-separated. The admin UI maps
  // checkbox selection → this string. Empty → empty array.
  category_slugs: z.string().optional()
                    .transform(s => (s ?? '').split(',').map(t => t.trim()).filter(Boolean)),
  sort_order:     z.coerce.number().int().nonnegative().default(0),
  active:         z.preprocess(v => v === 'true' || v === 'on' || v === true, z.boolean()).default(true),
});

function pack(parsed: z.infer<typeof BlockInput>) {
  return {
    kind:           parsed.kind,
    title:          parsed.title,
    subtitle:       parsed.subtitle || null,
    cta_text:       parsed.cta_text || null,
    cta_href:       parsed.cta_href || null,
    image_url:      parsed.image_url || null,
    category_slugs: parsed.category_slugs,
    sort_order:     parsed.sort_order,
    active:         parsed.active,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────

export async function createBlock(formData: FormData): Promise<void> {
  const session = await assertWrite();
  const parsed = BlockInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`);
  }
  const { data, error } = await supabaseAdmin().from('homepage_content').insert(pack(parsed.data)).select('id').single();
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  await logAudit(session, { action: 'homepage.create', entity: 'homepage_content', entity_id: data?.id, diff: pack(parsed.data) });
  updateTag(HOMEPAGE_CONTENT_TAG);
  revalidatePath('/');
  redirect(`${PATH}?ok=Block%20added`);
}

export async function updateBlock(formData: FormData): Promise<void> {
  const session = await assertWrite();
  const id = formData.get('id') as string;
  if (!id) redirect(`${PATH}?error=Missing%20id`);
  const parsed = BlockInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`);
  }
  const admin = supabaseAdmin();
  const { data: before } = await admin.from('homepage_content').select('*').eq('id', id).maybeSingle();
  if (!before) redirect(`${PATH}?error=Block%20not%20found`);
  const { error } = await admin.from('homepage_content').update({
    ...pack(parsed.data),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  await logAudit(session, { action: 'homepage.update', entity: 'homepage_content', entity_id: id, diff: { before, after: pack(parsed.data) } });
  updateTag(HOMEPAGE_CONTENT_TAG);
  revalidatePath('/');
  redirect(`${PATH}?ok=Block%20updated`);
}

export async function deleteBlock(formData: FormData): Promise<void> {
  const session = await assertWrite();
  const id = formData.get('id') as string;
  if (!id) redirect(`${PATH}?error=Missing%20id`);
  const admin = supabaseAdmin();
  const { data: row } = await admin.from('homepage_content').select('title').eq('id', id).maybeSingle<{ title: string }>();
  const { error } = await admin.from('homepage_content').delete().eq('id', id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  await logAudit(session, { action: 'homepage.delete', entity: 'homepage_content', entity_id: id, diff: { title: row?.title } });
  updateTag(HOMEPAGE_CONTENT_TAG);
  revalidatePath('/');
  redirect(`${PATH}?ok=Block%20removed`);
}

// Up/down reorder — simple swap-with-neighbour pattern. Operator
// doesn't see sort_order numbers; the UI gives them ↑ / ↓ buttons.
export async function moveBlock(formData: FormData): Promise<void> {
  const session = await assertWrite();
  const id = formData.get('id') as string;
  const direction = formData.get('direction') as 'up' | 'down';
  if (!id || (direction !== 'up' && direction !== 'down')) redirect(`${PATH}?error=Invalid%20move`);
  const admin = supabaseAdmin();
  const { data: self } = await admin
    .from('homepage_content')
    .select('id, kind, sort_order')
    .eq('id', id)
    .maybeSingle<{ id: string; kind: string; sort_order: number }>();
  if (!self) redirect(`${PATH}?error=Block%20not%20found`);
  // Find the neighbour within the same `kind` group (banners reorder
  // amongst banners, tile rows amongst tile rows).
  const query = admin.from('homepage_content').select('id, sort_order').eq('kind', self.kind);
  const { data: neighbour } = direction === 'up'
    ? await query.lt('sort_order', self.sort_order).order('sort_order', { ascending: false }).limit(1).maybeSingle<{ id: string; sort_order: number }>()
    : await query.gt('sort_order', self.sort_order).order('sort_order', { ascending: true }).limit(1).maybeSingle<{ id: string; sort_order: number }>();
  if (!neighbour) {
    // Already at the edge — silently no-op rather than error.
    redirect(PATH);
  }
  await Promise.all([
    admin.from('homepage_content').update({ sort_order: neighbour.sort_order, updated_at: new Date().toISOString() }).eq('id', self.id),
    admin.from('homepage_content').update({ sort_order: self.sort_order,     updated_at: new Date().toISOString() }).eq('id', neighbour.id),
  ]);
  await logAudit(session, { action: 'homepage.move', entity: 'homepage_content', entity_id: id, diff: { direction } });
  updateTag(HOMEPAGE_CONTENT_TAG);
  revalidatePath('/');
  redirect(PATH);
}
