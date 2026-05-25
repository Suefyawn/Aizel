'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { createBlogPost, updateBlogPost } from '@/app/admin/actions';
import { ImageUpload } from './ImageUpload';
import type { BlogPost } from '@/types';

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// Canonical blog taxonomy. Kept as a fixed dropdown (not free text) so the
// category list can't drift back into the WP-import mess of near-duplicate
// values — see migration 100. Add a new category here when one is needed.
const BLOG_CATEGORIES = [
  'Hair Care',
  'Body Care',
  'Styling & Tools',
  'Grooming',
  'Brand Spotlight',
  'How-To',
] as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem',
  fontWeight: 600, color: '#374151', marginBottom: 5,
};
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const hint: React.CSSProperties = { marginTop: 4, fontSize: '0.6875rem', color: '#6b7280' };

// One titled block of the form. Lifted from ProductForm so the two
// editors share visual rhythm — the audit flagged BlogForm reading
// "less professional" because the fields ran flat without grouping.
function Section({ title, desc, first, children }: {
  title: string; desc?: string; first?: boolean; children: React.ReactNode;
}) {
  return (
    <section style={{
      marginBottom: 24, paddingTop: first ? 0 : 24,
      borderTop: first ? 'none' : '1px solid #f3f4f6',
    }}>
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>{title}</h2>
      <p style={{ margin: '2px 0 16px', fontSize: '0.75rem', color: '#6b7280' }}>
        {desc ?? ' '}
      </p>
      {children}
    </section>
  );
}

export function BlogForm({ post }: { post?: BlogPost }) {
  const isEdit = Boolean(post);
  const boundAction = isEdit ? updateBlogPost.bind(null, post!.id) : createBlogPost;
  const [state, action, pending] = useActionState(boundAction, null);

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [imageUrl] = useState(post?.image_url ?? '');

  // Preview link — opens the storefront blog post in a new tab. Disabled
  // until there's a slug to point at (a draft with no slug yet would 404).
  const previewSlug = slug || post?.slug;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Link href="/admin/blog" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Blog
        </Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {isEdit ? 'Edit Post' : 'New Post'}
        </h1>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 820 }}>
        {state?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
            {state.error}
          </div>
        )}

        <form action={action}>
          {/* ── Basics ─────────────────────────────────────────────────── */}
          <Section title="Basics" first>
            <div style={{ marginBottom: 16, ...fieldWrap }}>
              <label style={lbl}>Title *</label>
              <input
                name="title" required
                value={title}
                onChange={e => { setTitle(e.target.value); if (!isEdit) setSlug(toSlug(e.target.value)); }}
                style={{ ...inp, fontSize: '1rem', fontWeight: 500 }}
                placeholder="e.g. The wash-day routine every coily-hair owner needs"
              />
            </div>
            <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={fieldWrap}>
                <label style={lbl}>Category *</label>
                <select name="category" required defaultValue={post?.category ?? ''} style={inp}>
                  <option value="" disabled>Choose a category</option>
                  {BLOG_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Date *</label>
                <input name="date" type="date" required defaultValue={post?.date ?? today()} style={inp} />
              </div>
              <div style={fieldWrap}>
                <label style={lbl}>Read time *</label>
                <input name="read_time" required defaultValue={post?.read_time} style={inp} placeholder="5 min read" />
              </div>
            </div>
          </Section>

          {/* ── URL ─────────────────────────────────────────────────────── */}
          <Section title="Page link" desc="The post's URL slug. Edit in the field below — kebab-case, no spaces.">
            <div style={fieldWrap}>
              <input
                name="slug" required
                value={slug}
                onChange={e => setSlug(e.target.value)}
                style={{ ...inp, fontFamily: 'monospace', fontSize: '0.8125rem' }}
                placeholder="post-url-slug"
              />
              <span style={hint}>
                /blog/{slug || 'post-slug'}
              </span>
            </div>
          </Section>

          {/* ── Cover image ─────────────────────────────────────────────── */}
          <Section title="Cover image" desc="Wide 16:9 image shown at the top of the post + on the blog listing card.">
            <ImageUpload name="image_url" currentUrl={imageUrl} label="" aspect={16 / 9} />
          </Section>

          {/* ── Excerpt + body ──────────────────────────────────────────── */}
          <Section title="Content" desc="The excerpt previews on the blog index; the body is what the customer reads.">
            <div style={{ marginBottom: 16, ...fieldWrap }}>
              <label style={lbl}>Excerpt *</label>
              <textarea
                name="excerpt" required
                defaultValue={post?.excerpt}
                rows={3}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
                placeholder="Short summary shown on the blog listing page…"
              />
              <span style={hint}>Aim for 100–180 characters. Compelling copy = more clicks from the index.</span>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Body</label>
              <textarea
                name="body"
                defaultValue={post?.body ?? ''}
                rows={16}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace', fontSize: '0.8125rem' }}
                placeholder="Full post content (plain text or Markdown)…"
              />
              <span style={hint}>Markdown supported — # headings, **bold**, *italics*, bullet lists, links.</span>
            </div>
          </Section>

          {/* ── Visibility ──────────────────────────────────────────────── */}
          <Section title="Visibility" desc="Featured posts get a star badge on the blog index and appear above the rest of the feed.">
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
              <input
                type="checkbox" name="featured"
                defaultChecked={post?.featured ?? false}
                style={{ marginTop: 2, accentColor: '#4A1A6B' }}
              />
              <span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Featured</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                  Pins the post to the top of the blog index with a ★ badge.
                </span>
              </span>
            </label>
          </Section>

          {/* ── Sticky save bar ─────────────────────────────────────────── */}
          <div
            className="adm-sticky-actions"
            style={{
              position: 'sticky', bottom: 0,
              marginTop: 8,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.94)',
              borderTop: '1px solid #e5e7eb',
              borderRadius: '0 0 10px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {pending
                ? 'Saving…'
                : isEdit
                  ? <>Editing <strong style={{ color: '#111827' }}>{post?.title ?? 'post'}</strong></>
                  : 'Drafting a new post'}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Preview — opens the storefront blog post in a new tab. */}
              {previewSlug && (
                <a
                  href={`/blog/${previewSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '9px 14px', background: 'white', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: 7,
                    fontSize: '0.8125rem', textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >Preview ↗</a>
              )}
              <Link href="/admin/blog" style={{
                padding: '9px 18px', background: 'white', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 7,
                fontSize: '0.8125rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}>
                Cancel
              </Link>
              <button type="submit" disabled={pending} style={{
                padding: '10px 24px', background: pending ? '#9ca3af' : '#4A1A6B',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Publish post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
