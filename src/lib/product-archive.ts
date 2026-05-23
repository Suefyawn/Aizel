import { supabaseAdmin } from '@/lib/supabase';

// Orders snapshot their line items as denormalised jsonb keyed by product id.
// A product that appears in any such snapshot must be archived rather than
// hard-deleted: Analytics joins those ids back to the products table for the
// display name, and the order detail view reads it too. Returns the subset of
// `ids` that have order history.
export async function productsWithOrderHistory(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (ids.length === 0) return found;
  const admin = supabaseAdmin();
  await Promise.all(
    ids.map(async id => {
      const { count } = await admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .contains('items', [{ id }]);
      if ((count ?? 0) > 0) found.add(id);
    }),
  );
  return found;
}
