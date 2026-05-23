'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// Admin server actions for the promo CMS. Every action revalidates the root
// layout (which renders the bars) AND the admin list, so the merchant sees
// a published edit on the storefront on the next request.

const PromoSchema = z.object({
  kind: z.enum(['announcement', 'promo']),
  position: z.enum(['top_bar', 'hero_strip']),
  label: z.string().max(40).optional().or(z.literal('')),
  headline: z.string().min(1).max(200),
  subline: z.string().max(280).optional().or(z.literal('')),
  cta_text: z.string().max(40).optional().or(z.literal('')),
  cta_url: z.string().max(400).optional().or(z.literal('')),
  bg_color: z.string().max(20).optional().or(z.literal('')),
  text_color: z.string().max(20).optional().or(z.literal('')),
  start_at: z.string().optional().or(z.literal('')),
  end_at: z.string().optional().or(z.literal('')),
  show_countdown: z.coerce.boolean().optional(),
  audience: z.enum(['guest', 'logged_in', 'first_time', 'returning']).optional().or(z.literal('')),
  enabled: z.coerce.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
});

function emptyToNull<T extends Record<string, unknown>>(o: T): T {
  const out = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === '') out[k] = null;
  return out as T;
}

function bust() {
  revalidatePath('/admin/promos');
  revalidatePath('/', 'layout');
}

export async function createPromo(formData: FormData) {
  const session = await assertPermission('promos');
  const parsed = PromoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { data: created } = await supabaseAdmin().from('promos').insert(emptyToNull({
    ...parsed.data,
    show_countdown: parsed.data.show_countdown ?? false,
    enabled: parsed.data.enabled ?? true,
    priority: parsed.data.priority ?? 0,
  })).select('id').single();
  void logAudit(session, {
    action: 'promo.create', entity: 'promos', entity_id: created?.id ?? null,
    diff: { headline: parsed.data.headline, position: parsed.data.position },
  });
  bust();
}

export async function updatePromo(id: string, formData: FormData) {
  const session = await assertPermission('promos');
  const parsed = PromoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabaseAdmin().from('promos').update(emptyToNull({
    ...parsed.data,
    show_countdown: parsed.data.show_countdown ?? false,
    enabled: parsed.data.enabled ?? false,
    priority: parsed.data.priority ?? 0,
  })).eq('id', id);
  void logAudit(session, {
    action: 'promo.update', entity: 'promos', entity_id: id,
    diff: { headline: parsed.data.headline, enabled: parsed.data.enabled ?? false },
  });
  bust();
}

export async function togglePromo(id: string, enabled: boolean) {
  const session = await assertPermission('promos');
  await supabaseAdmin().from('promos').update({ enabled }).eq('id', id);
  void logAudit(session, {
    action: enabled ? 'promo.enable' : 'promo.disable',
    entity: 'promos', entity_id: id,
  });
  bust();
}

export async function deletePromo(formData: FormData) {
  const session = await assertPermission('promos');
  const id = formData.get('id') as string;
  const { data: target } = await supabaseAdmin().from('promos').select('headline').eq('id', id).single();
  await supabaseAdmin().from('promos').delete().eq('id', id);
  void logAudit(session, {
    action: 'promo.delete', entity: 'promos', entity_id: id,
    diff: { headline: target?.headline },
  });
  bust();
}
