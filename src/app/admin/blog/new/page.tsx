import { BlogForm } from '@/components/admin/BlogForm';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

export default async function NewBlogPostPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('blog')) {
    return <NoAccess section="Blog" />;
  }
  return <BlogForm />;
}
