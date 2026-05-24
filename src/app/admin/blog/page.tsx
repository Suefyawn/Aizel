export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { deleteBlogPost } from '@/app/admin/actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { BlogFilter } from '@/components/admin/BlogFilter';
import { Pagination } from '@/components/admin/Pagination';
import { AdminFab } from '@/components/admin/AdminFab';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { BlogPost } from '@/types';

const PAGE_SIZE = 20;

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('blog')) {
    return <NoAccess section="Blog" />;
  }
  const { q, category, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Get distinct categories for filter
  const { data: allPosts } = await supabase.from('blog_posts').select('category');
  const categories = Array.from(new Set((allPosts ?? []).map((p: { category: string }) => p.category))).sort() as string[];

  let countQuery = supabase.from('blog_posts').select('*', { count: 'exact', head: true });
  let dataQuery = supabase.from('blog_posts').select('*').order('date', { ascending: false }).range(from, to);

  if (category && category !== 'All') {
    countQuery = countQuery.eq('category', category);
    dataQuery = dataQuery.eq('category', category);
  }
  if (q) {
    countQuery = countQuery.ilike('title', `%${q}%`);
    dataQuery = dataQuery.ilike('title', `%${q}%`);
  }

  const [{ count: totalCount }, { data: posts }] = await Promise.all([countQuery, dataQuery]);
  const total = totalCount ?? 0;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Blog Posts</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{total} post{total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/blog/new" style={{
          padding: '10px 20px', background: '#4A1A6B', color: 'white',
          borderRadius: 8, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
        }}>
          + New Post
        </Link>
      </div>

      <Suspense fallback={null}>
        <BlogFilter total={total} categories={categories} />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {!posts || posts.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            {q || category ? 'No posts match your filters.' : <>No posts yet. <Link href="/admin/blog/new" style={{ color: '#4A1A6B' }}>Write the first one →</Link></>}
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Title', 'Category', 'Date', 'Read Time', 'Featured', 'Actions'].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(posts as BlogPost[]).map((p, i) => (
                <tr key={p.id} style={{
                  borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                  background: p.featured ? '#fffbeb' : 'transparent',
                }}>
                  <td data-label="Title" style={{ padding: '12px 16px', maxWidth: 300 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }} title={p.slug}>{p.slug}</div>
                  </td>
                  <td data-label="Category" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>{p.category}</td>
                  <td data-label="Date" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{p.date}</td>
                  <td data-label="Read time" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>{p.read_time}</td>
                  <td data-label="Featured" style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {p.featured ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', background: '#fef9c3', color: '#92400e', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>★ Featured</span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: '0.875rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link href={`/admin/blog/${p.id}`} style={{
                        padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                        borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                      }}>
                        Edit
                      </Link>
                      <DeleteButton
                        id={p.id}
                        action={deleteBlogPost}
                        confirmMsg={`Delete "${p.title}"?`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/blog" />
      </Suspense>

      <AdminFab href="/admin/blog/new" label="New post" />
    </div>
  );
}
