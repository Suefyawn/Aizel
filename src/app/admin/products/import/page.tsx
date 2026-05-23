import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ImportProductsClient } from './ImportProductsClient';

export default async function ImportProductsPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Products" />;
  }
  return <ImportProductsClient />;
}
