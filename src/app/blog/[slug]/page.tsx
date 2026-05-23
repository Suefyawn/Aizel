// ISR: cache for 10 min; admin blog edits call revalidatePath to bust.
export const revalidate = 600;

// Known limitation (Next 16): /blog/<unknown-slug> returns HTTP 200 with
// the not-found body rendered, not a clean 404. The body is correct; only
// the status header is wrong. Google can soft-404 from body content, so
// this is a tolerable SEO edge-case. Same limitation as /product/[slug] —
// see that file for context.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug, getBlogPosts, getProducts } from '@/lib/supabase';

// Prebuild every known post slug at build time so known posts get the
// fast SSG path. Unknown slugs still hit the runtime + notFound() path
// per the limitation noted above.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const posts = await getBlogPosts();
    return posts.map(p => ({ slug: p.slug }));
  } catch {
    return [];
  }
}
import { BlogPostPage } from '@/sections/blog/BlogPostPage';
import { pageMeta, jsonLd, articleLd, breadcrumbLd } from '@/lib/seo';
import type { Product } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};
  return pageMeta({
    title: post.title,
    description: post.excerpt ?? post.title,
    path: `/blog/${post.slug}`,
    image: post.image_url ?? undefined,
    type: 'article',
    keywords: post.category ? [post.category, 'Hair Care', 'Body Care', 'UK'] : undefined,
  });
}

export default async function BlogPostRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, allPosts, allProducts] = await Promise.all([
    getBlogPostBySlug(slug),
    getBlogPosts(),
    getProducts(),
  ]);
  if (!post) notFound();

  const relatedPosts = allPosts.filter(p => p.slug !== post.slug && p.category === post.category).slice(0, 2);

  // Related-products matching by taxon. Blog categories ("Bone Health",
  // "Fertility Support", "Men Health", etc.) don't map 1:1 to product
  // categories ("Bone Health" is shared; "Skincare" matches; everything
  // else needs a heuristic). Wellness-ish blog category → wellness
  // taxon products; everything else → category-string contains. Always
  // fall back to a random sample from the catalog so the rail never
  // goes empty on a niche post.
  const { categoriesForTaxon } = await import('@/lib/category-taxonomy');
  const wellnessCats = categoriesForTaxon('wellness') ?? [];
  const beautyCats = [
    ...(categoriesForTaxon('makeup') ?? []),
    ...(categoriesForTaxon('skincare') ?? []),
  ];
  const blogCat = (post.category ?? '').toLowerCase();
  const isWellness = /health|wellness|fertility|sleep|immun|bone|nutrition|men |women |female/.test(blogCat);
  const isBeauty = /skin|makeup|beauty|lip|cheek|highlight|brush|foundation/.test(blogCat);
  let relatedProducts: Product[] = allProducts.filter(p => {
    if (isWellness) return wellnessCats.includes(p.category);
    if (isBeauty)   return beautyCats.includes(p.category);
    return false;
  }).slice(0, 3);
  if (relatedProducts.length === 0) {
    // Fallback: a few featured/bestseller products so the section
    // always has something on niche / Uncategorized posts.
    relatedProducts = allProducts
      .filter(p => p.is_featured || p.is_bestseller)
      .slice(0, 3);
  }

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleLd(post)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ])),
        }}
      />
      <BlogPostPage post={post} relatedPosts={relatedPosts} relatedProducts={relatedProducts} />
    </main>
  );
}
