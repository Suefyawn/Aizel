'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

// ============================================================================
// Categories CMS — server actions.
//
// Authorization: only the owner OR a staff member with the `settings.edit`
// permission can write. The reads (storefront nav, shop filter sidebar)
// hit Supabase with the anon key via the standard read policies seeded
// in migration 143.
//
// On every successful write we `revalidateTag('taxonomy')` so the next
// request anywhere on the site picks up the change without waiting for
// per-page ISR. The layout's `loadTaxonomy()` is the consumer of that
// tag.
//
// Rename semantics: products store their category as a plain text label
// (e.g. 'Shampoo & Conditioner'), not a foreign key. Renaming the
// category label here also updates every matching `products.category`
// row in the same call — products never silently disconnect from their
// taxon when an operator edits the label.
//
// Delete semantics: refuse the delete if any product is in the
// category (or, for a taxon, in any of its categories). The operator
// gets a clear "37 products are in this category — reassign or delete
// them first" message rather than silently orphaning catalogue data.
// ============================================================================

async function assertSettingsWrite() {
  const session = await getStaffSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  if (!session.isOwner && !session.permissions.includes('settings')) {
    throw new Error('Unauthorized');
  }
  return session;
}

const PATH = '/admin/settings/categories';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Taxon CRUD ─────────────────────────────────────────────────────────────

const TaxonInput = z.object({
  key:         z.string().trim().min(1, 'Key is required').max(40)
                 .regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, digits and hyphens — no spaces.'),
  label:       z.string().trim().min(1, 'Label is required').max(80),
  tagline:     z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  sort_order:  z.coerce.number().int().nonnegative().default(0),
});

export async function createTaxon(formData: FormData): Promise<void> {
  const session = await assertSettingsWrite();
  const parsed = TaxonInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`);
  }
  const { error, data } = await supabaseAdmin().from('taxons').insert({
    key:         parsed.data.key,
    label:       parsed.data.label,
    tagline:     parsed.data.tagline || null,
    description: parsed.data.description || null,
    sort_order:  parsed.data.sort_order,
  }).select('id').single();
  if (error) {
    redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  }
  await logAudit(session, { action: 'taxon.create', entity: 'taxon', entity_id: data?.id, diff: parsed.data });
  updateTag('taxonomy');
  revalidatePath('/');
  redirect(`${PATH}?ok=Section%20added`);
}

export async function updateTaxon(formData: FormData): Promise<void> {
  const session = await assertSettingsWrite();
  const id = formData.get('id') as string;
  if (!id) redirect(`${PATH}?error=Missing%20id`);
  const parsed = TaxonInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`);
  }
  const { data: before } = await supabaseAdmin().from('taxons').select('*').eq('id', id).maybeSingle();
  if (!before) redirect(`${PATH}?error=Section%20not%20found`);
  const { error } = await supabaseAdmin().from('taxons').update({
    key:         parsed.data.key,
    label:       parsed.data.label,
    tagline:     parsed.data.tagline || null,
    description: parsed.data.description || null,
    sort_order:  parsed.data.sort_order,
    updated_at:  new Date().toISOString(),
  }).eq('id', id);
  if (error) {
    redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  }
  await logAudit(session, { action: 'taxon.update', entity: 'taxon', entity_id: id, diff: { before, after: parsed.data } });
  updateTag('taxonomy');
  revalidatePath('/');
  redirect(`${PATH}?ok=Section%20updated`);
}

export async function deleteTaxon(formData: FormData): Promise<void> {
  const session = await assertSettingsWrite();
  const id = formData.get('id') as string;
  if (!id) redirect(`${PATH}?error=Missing%20id`);
  // Refuse if any category is still under this taxon — the operator
  // moves the categories first, then drops the empty taxon. Avoids
  // silently orphaning category rows.
  const { count } = await supabaseAdmin().from('categories').select('id', { count: 'exact', head: true }).eq('taxon_id', id);
  if ((count ?? 0) > 0) {
    redirect(`${PATH}?error=${encodeURIComponent(`Section still has ${count} categories — move or delete them first.`)}`);
  }
  const { error } = await supabaseAdmin().from('taxons').delete().eq('id', id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  await logAudit(session, { action: 'taxon.delete', entity: 'taxon', entity_id: id });
  updateTag('taxonomy');
  revalidatePath('/');
  redirect(`${PATH}?ok=Section%20removed`);
}

// ── Category CRUD ──────────────────────────────────────────────────────────

const CategoryInput = z.object({
  label:       z.string().trim().min(1, 'Label is required').max(80),
  slug:        z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  taxon_id:    z.string().uuid('Pick a section'),
  sort_order:  z.coerce.number().int().nonnegative().default(0),
});

export async function createCategory(formData: FormData): Promise<void> {
  const session = await assertSettingsWrite();
  const parsed = CategoryInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`);
  }
  // Auto-slug from the label if the operator didn't override it.
  const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.label);
  const { error, data } = await supabaseAdmin().from('categories').insert({
    label:       parsed.data.label,
    slug,
    description: parsed.data.description || null,
    taxon_id:    parsed.data.taxon_id,
    sort_order:  parsed.data.sort_order,
  }).select('id').single();
  if (error) {
    redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  }
  await logAudit(session, { action: 'category.create', entity: 'category', entity_id: data?.id, diff: { ...parsed.data, slug } });
  updateTag('taxonomy');
  revalidatePath('/');
  redirect(`${PATH}?ok=Category%20added`);
}

export async function updateCategory(formData: FormData): Promise<void> {
  const session = await assertSettingsWrite();
  const id = formData.get('id') as string;
  if (!id) redirect(`${PATH}?error=Missing%20id`);
  const parsed = CategoryInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid input')}`);
  }
  const slug = parsed.data.slug ? slugify(parsed.data.slug) : slugify(parsed.data.label);
  const admin = supabaseAdmin();
  const { data: before } = await admin.from('categories').select('*').eq('id', id).maybeSingle<{ id: string; label: string; slug: string }>();
  if (!before) redirect(`${PATH}?error=Category%20not%20found`);

  // Two writes inside the same action so a label rename keeps catalogue
  // data consistent: update the category row, then propagate the new
  // label to every product currently filed under the OLD label. Without
  // this, renaming "Shampoo & Conditioner" → "Cleansers" leaves 245
  // products with the old text and they disappear from the new filter.
  const { error: catErr } = await admin.from('categories').update({
    label:       parsed.data.label,
    slug,
    description: parsed.data.description || null,
    taxon_id:    parsed.data.taxon_id,
    sort_order:  parsed.data.sort_order,
    updated_at:  new Date().toISOString(),
  }).eq('id', id);
  if (catErr) redirect(`${PATH}?error=${encodeURIComponent(catErr.message)}`);

  let productsRenamed = 0;
  if (before && before.label !== parsed.data.label) {
    const { data: rows, error: prodErr } = await admin
      .from('products')
      .update({ category: parsed.data.label })
      .eq('category', before.label)
      .select('id');
    if (prodErr) redirect(`${PATH}?error=${encodeURIComponent(`Renamed in CMS but product rename failed: ${prodErr.message}`)}`);
    productsRenamed = (rows ?? []).length;
  }

  await logAudit(session, { action: 'category.update', entity: 'category', entity_id: id, diff: { before, after: { ...parsed.data, slug }, products_renamed: productsRenamed } });
  updateTag('taxonomy');
  revalidatePath('/');
  revalidatePath('/shop');
  redirect(`${PATH}?ok=${encodeURIComponent(productsRenamed > 0 ? `Category updated — ${productsRenamed} products moved` : 'Category updated')}`);
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const session = await assertSettingsWrite();
  const id = formData.get('id') as string;
  if (!id) redirect(`${PATH}?error=Missing%20id`);
  const admin = supabaseAdmin();
  const { data: row } = await admin.from('categories').select('label').eq('id', id).maybeSingle<{ label: string }>();
  if (!row) redirect(`${PATH}?error=Category%20not%20found`);
  // Refuse if there are products in this category — operator reassigns
  // them via the products page first.
  const { count } = await admin.from('products').select('id', { count: 'exact', head: true }).eq('category', row.label);
  if ((count ?? 0) > 0) {
    redirect(`${PATH}?error=${encodeURIComponent(`${count} products are in this category — reassign or delete them first.`)}`);
  }
  const { error } = await admin.from('categories').delete().eq('id', id);
  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  await logAudit(session, { action: 'category.delete', entity: 'category', entity_id: id, diff: { label: row.label } });
  updateTag('taxonomy');
  revalidatePath('/');
  redirect(`${PATH}?ok=Category%20removed`);
}
