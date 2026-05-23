'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

const PATH = '/admin/settings/shipping';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

function err(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

function ok(): never {
  revalidatePath(PATH);
  revalidatePath('/', 'layout');
  redirect(`${PATH}?saved=1`);
}

interface ZoneFields {
  name: string;
  active: boolean;
  sort_order: number;
  rate: number;
  free_shipping_threshold: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

function parseZone(formData: FormData): ZoneFields {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) err('Zone name is required.');

  const rateRaw = (formData.get('rate') as string | null)?.trim() ?? '';
  const rate = Number(rateRaw);
  if (!Number.isFinite(rate) || rate < 0) err('Rate must be a non-negative number.');

  const freeThresholdRaw = (formData.get('free_shipping_threshold') as string | null)?.trim() ?? '';
  const free_shipping_threshold = freeThresholdRaw === '' ? null : Number(freeThresholdRaw);
  if (free_shipping_threshold !== null && (!Number.isFinite(free_shipping_threshold) || free_shipping_threshold < 0)) {
    err('Free-shipping threshold must be a non-negative number or blank.');
  }

  const sortRaw = (formData.get('sort_order') as string | null)?.trim() ?? '0';
  const sort_order = Number(sortRaw);
  if (!Number.isFinite(sort_order)) err('Sort order must be a number.');

  const minRaw = (formData.get('estimated_days_min') as string | null)?.trim() ?? '';
  const estimated_days_min = minRaw === '' ? null : Number(minRaw);
  const maxRaw = (formData.get('estimated_days_max') as string | null)?.trim() ?? '';
  const estimated_days_max = maxRaw === '' ? null : Number(maxRaw);

  return {
    name,
    active: formData.get('active') === 'true',
    sort_order,
    rate,
    free_shipping_threshold,
    estimated_days_min,
    estimated_days_max,
  };
}

export async function createZone(formData: FormData): Promise<void> {
  const session = await assertOwner();
  const z = parseZone(formData);

  const sb = supabaseAdmin();

  const { data: zone, error: zoneErr } = await sb
    .from('shipping_zones')
    .insert({ name: z.name, active: z.active, sort_order: z.sort_order })
    .select('id')
    .single();
  if (zoneErr) {
    if (zoneErr.code === '23505') err(`A zone named "${z.name}" already exists.`);
    err(zoneErr.message);
  }

  const { error: rateErr } = await sb.from('shipping_rates').insert({
    zone_id: zone!.id,
    rate: z.rate,
    free_shipping_threshold: z.free_shipping_threshold,
    label: 'Standard',
    estimated_days_min: z.estimated_days_min,
    estimated_days_max: z.estimated_days_max,
  });
  if (rateErr) {
    // Best effort: roll back the zone since the rate insert failed.
    await sb.from('shipping_zones').delete().eq('id', zone!.id);
    err(rateErr.message);
  }

  void logAudit(session, {
    action: 'shipping_zone.create',
    entity: 'shipping_zones',
    entity_id: zone!.id,
    diff: { name: z.name, rate: z.rate },
  });
  ok();
}

export async function updateZone(id: string, formData: FormData): Promise<void> {
  const session = await assertOwner();
  const z = parseZone(formData);

  const sb = supabaseAdmin();

  const { error: zoneErr } = await sb
    .from('shipping_zones')
    .update({ name: z.name, active: z.active, sort_order: z.sort_order })
    .eq('id', id);
  if (zoneErr) {
    if (zoneErr.code === '23505') err(`A zone named "${z.name}" already exists.`);
    err(zoneErr.message);
  }

  // Upsert the rate by zone_id — assume a single rate per zone for now.
  // If a row exists, update it; otherwise insert a fresh one.
  const { data: existingRate } = await sb
    .from('shipping_rates')
    .select('id')
    .eq('zone_id', id)
    .limit(1)
    .maybeSingle();

  const ratePatch = {
    zone_id: id,
    rate: z.rate,
    free_shipping_threshold: z.free_shipping_threshold,
    estimated_days_min: z.estimated_days_min,
    estimated_days_max: z.estimated_days_max,
    label: 'Standard',
  };

  if (existingRate?.id) {
    const { error: rateErr } = await sb.from('shipping_rates').update(ratePatch).eq('id', existingRate.id);
    if (rateErr) err(rateErr.message);
  } else {
    const { error: rateErr } = await sb.from('shipping_rates').insert(ratePatch);
    if (rateErr) err(rateErr.message);
  }

  void logAudit(session, {
    action: 'shipping_zone.update',
    entity: 'shipping_zones',
    entity_id: id,
    diff: { name: z.name, rate: z.rate },
  });
  ok();
}

export async function deleteZone(formData: FormData): Promise<void> {
  const session = await assertOwner();
  const id = formData.get('id') as string;
  if (!id) err('Missing zone id.');

  // shipping_rates and province_zones cascade on delete via FK.
  const { error } = await supabaseAdmin().from('shipping_zones').delete().eq('id', id);
  if (error) err(error.message);

  void logAudit(session, {
    action: 'shipping_zone.delete',
    entity: 'shipping_zones',
    entity_id: id,
  });
  ok();
}
