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

export function BlogForm({ post }: { post?: BlogPost }) {
  const isEdit = Boolean(post);
  const boundAction = isEdit ? updateBlogPost.bind(null, post!.id) : createBlogPost;
  const [state, action, pending] = useActionState(boundAction, null);

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [imageUrl] = useState(post?.image_url ?? '');

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
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
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Title *</label>
            <input
              name="title" required
              value={title}
              onChange={e => { setTitle(e.target.value); if (!isEdit) setSlug(toSlug(e.target.value)); }}
              style={{ ...inp, fontSize: '1rem', fontWeight: 500 }}
              placeholder="Post title"
            />
          </div>

          {/* Slug */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>URL Slug *</label>
            <input
              name="slug" required
              value={slug}
              onChange={e => setSlug(e.target.value)}
              style={{ ...inp, fontFamily: 'monospace', fontSize: '0.8125rem' }}
              placeholder="post-url-slug"
            />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
              /blog/{slug || 'post-slug'}
            </span>
          </div>

          {/* Row: Category, Date, Read time */}
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Category *</label>
              <select name="category" required defaultValue={post?.category ?? ''} style={inp}>
                <option value="" disabled>Choose a category</option>
                {BLOG_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input name="date" type="date" required defaultValue={post?.date ?? today()} style={inp} />
            </div>
            <div>
              <label style={lbl}>Read Time *</label>
              <input name="read_time" required defaultValue={post?.read_time} style={inp} placeholder="5 min read" />
            </div>
          </div>

          {/* Cover Image */}
          <div style={{ marginBottom: 16 }}>
            <ImageUpload name="image_url" currentUrl={imageUrl} label="Cover Image" aspect={16 / 9} />
          </div>

          {/* Featured */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox" name="featured" id="featured"
              defaultChecked={post?.featured ?? false}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="featured" style={{ fontSize: '0.875rem', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              Featured post (shown prominently on the blog)
            </label>
          </div>

          {/* Excerpt */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Excerpt *</label>
            <textarea
              name="excerpt" required
              defaultValue={post?.excerpt}
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Short summary shown on the blog listing page…"
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 28 }}>
            <label style={lbl}>Body</label>
            <textarea
              name="body"
              defaultValue={post?.body ?? ''}
              rows={16}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace', fontSize: '0.8125rem' }}
              placeholder="Full post content (plain text or Markdown)…"
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={pending} style={{
              padding: '10px 24px', background: pending ? '#9ca3af' : '#C5286A',
              color: 'white', border: 'none', borderRadius: 7,
              fontSize: '0.875rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
            }}>
              {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Post'}
            </button>
            <Link href="/admin/blog" style={{
              padding: '10px 20px', background: 'white', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: 7,
              fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
