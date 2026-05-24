'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// Order-confirmation toggle. Used to record that the customer has
// confirmed an order out-of-band (e.g. over WhatsApp) before we pick &
// pack it. Was previously bundled with the vendor-dispatch helpers in
// `vendor-actions.ts`; vendors went away when Aizel moved to a fully
// in-house catalogue, but the customer-confirmation step is still part
// of the dispatch checklist.

/** Toggle whether the customer has confirmed the order (typically over
 *  WhatsApp). Bound with the order id + target state by the order page. */
export async function setOrderConfirmed(orderId: string, confirmed: boolean) {
  const session = await assertPermission('orders.edit');
  await supabaseAdmin()
    .from('orders')
    .update({ confirmed_at: confirmed ? new Date().toISOString() : null })
    .eq('id', orderId);
  void logAudit(session, {
    action: confirmed ? 'order.customer_confirmed' : 'order.confirmation_cleared',
    entity: 'orders', entity_id: orderId,
  });
  revalidatePath(`/admin/orders/${orderId}`);
}
