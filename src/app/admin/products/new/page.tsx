import { ProductForm } from '@/components/admin/ProductForm';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

export default async function NewProductPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products.edit')) {
    return <NoAccess section="Products" />;
  }
  return <ProductForm />;
}
