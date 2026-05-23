import { ProductForm } from '@/components/admin/ProductForm';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Vendor } from '@/types';

export default async function NewProductPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Products" />;
  }
  // vendors RLS has no policy — read with the service role.
  const { data } = await supabaseAdmin().from('vendors').select('*').order('name');
  return <ProductForm vendors={(data ?? []) as Vendor[]} />;
}
