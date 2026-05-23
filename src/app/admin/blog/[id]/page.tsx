import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BlogForm } from '@/components/admin/BlogForm';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('blog')) {
    return <NoAccess section="Blog" />;
  }
  const { id } = await params;
  const { data: post } = await supabase.from('blog_posts').select('*').eq('id', id).single();
  if (!post) notFound();
  return <BlogForm post={post} />;
}
