import { pageMeta, jsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';
import { getBlogPosts } from '@/lib/supabase';
import { BlogPage } from '@/sections/blog/BlogPage';

// 10-min ISR — blog posts publish at most a few times per week.
export const revalidate = 600;

export const metadata = pageMeta({
  title: 'Aizel beauty journal',
  description:
    'Hair care routines, product reviews and styling tips from the Aizel editors. Plain-English, evidence-led, no influencer fluff.',
  path: '/blog',
});

export default async function BlogListPage() {
  const posts = await getBlogPosts();
  // Top 24 posts for the ItemList — newest first matches the listing
  // order (getBlogPosts sorts by date desc).
  const itemListPosts = posts.slice(0, 24);
  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
          ])),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(itemListLd(
            'Aizel blog posts',
            itemListPosts.map(p => ({
              name: p.title,
              path: `/blog/${p.slug}`,
            })),
          )),
        }}
      />
      <BlogPage posts={posts} />
    </main>
  );
}
