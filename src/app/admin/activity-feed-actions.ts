'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';

// Dashboard activity feed. Reads audit_log + adds enough hydration
// (order number, customer name, product name) that each row is a
// human-readable headline without a JOIN in the UI.
//
// We deliberately keep the surface small and DON'T return raw diffs
// — the existing /admin/audit page handles forensic browsing, this
// is the "what's happening right now" glance widget.

export type ActivityActorKind = 'owner' | 'staff' | 'customer' | 'system' | 'gateway';
export type ActivityEntityKind = 'order' | 'customer' | 'product' | 'review' | 'subscription' | 'newsletter' | 'unknown';

export interface ActivityItem {
  id: string;
  action: string;
  actor_kind: ActivityActorKind;
  actor_label: string;       // who did it — readable
  entity_kind: ActivityEntityKind;
  entity_label: string;      // what it was about — readable
  href: string | null;       // click-through, or null when there's no detail page
  created_at: string;
}

interface AuditRow {
  id: string;
  action: string;
  actor_kind: string;
  actor_email: string | null;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

function entityHref(entity: string | null, entityId: string | null): string | null {
  if (!entity || !entityId) return null;
  if (entity === 'order')    return `/admin/orders/${entityId}`;
  if (entity === 'customer') return `/admin/users/${entityId}`;
  if (entity === 'product')  return `/admin/products/${entityId}`;
  return null;
}

function normaliseEntity(e: string | null): ActivityEntityKind {
  if (e === 'order' || e === 'customer' || e === 'product' || e === 'review' || e === 'subscription' || e === 'newsletter') return e;
  return 'unknown';
}

function actorLabel(row: AuditRow): string {
  if (row.actor_kind === 'system')   return 'System';
  if (row.actor_kind === 'gateway')  return 'Payment gateway';
  if (row.actor_kind === 'customer') return row.actor_email ?? 'A customer';
  // staff / owner
  return row.actor_email ?? (row.actor_kind === 'owner' ? 'Owner' : 'Staff');
}

export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
  // The widget sits on the dashboard which already gates on the
  // analytics perms — but this action is also a public-ish server
  // action so we re-check defensively.
  await assertPermission('analytics');

  const admin = supabaseAdmin();
  const { data } = await admin
    .from('audit_log')
    .select('id, action, actor_kind, actor_email, entity, entity_id, diff, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as AuditRow[];

  // Hydrate entity names so each row can stand alone. One IN query
  // per entity kind — usually under 60 rows total.
  const orderIds   = new Set<string>();
  const userIds    = new Set<string>();
  const productIds = new Set<string>();
  for (const r of rows) {
    if (!r.entity_id) continue;
    if (r.entity === 'order')    orderIds.add(r.entity_id);
    if (r.entity === 'customer') userIds.add(r.entity_id);
    if (r.entity === 'product')  productIds.add(r.entity_id);
  }

  const [orderRows, profileRows, productRows] = await Promise.all([
    orderIds.size > 0
      ? admin.from('orders').select('id, order_number, total, first_name, last_name').in('id', Array.from(orderIds))
      : Promise.resolve({ data: [] as Array<{ id: string; order_number: string; total: number; first_name: string | null; last_name: string | null }> }),
    userIds.size > 0
      ? admin.from('profiles').select('id, first_name, last_name, email').in('id', Array.from(userIds))
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }> }),
    productIds.size > 0
      ? admin.from('products').select('id, name, brand').in('id', Array.from(productIds))
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; brand: string | null }> }),
  ]);

  const orderById   = new Map((orderRows.data   ?? []).map(o => [o.id, o]));
  const profileById = new Map((profileRows.data ?? []).map(p => [p.id, p]));
  const productById = new Map((productRows.data ?? []).map(p => [p.id, p]));

  return rows.map<ActivityItem>(r => {
    const ek = normaliseEntity(r.entity);
    let entity_label = '';
    if (ek === 'order' && r.entity_id) {
      const o = orderById.get(r.entity_id);
      entity_label = o ? `Order ${o.order_number}` : 'an order';
    } else if (ek === 'customer' && r.entity_id) {
      const p = profileById.get(r.entity_id);
      const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '';
      entity_label = name || p?.email || 'a customer';
    } else if (ek === 'product' && r.entity_id) {
      const p = productById.get(r.entity_id);
      entity_label = p ? `${p.brand ? `${p.brand} ` : ''}${p.name}` : 'a product';
    } else {
      entity_label = r.entity ?? '';
    }

    return {
      id: r.id,
      action: r.action,
      actor_kind: (r.actor_kind as ActivityActorKind) ?? 'system',
      actor_label: actorLabel(r),
      entity_kind: ek,
      entity_label,
      href: entityHref(r.entity, r.entity_id),
      created_at: r.created_at,
    };
  });
}
