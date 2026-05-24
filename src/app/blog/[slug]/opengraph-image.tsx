import { ImageResponse } from 'next/og';
import { getBlogPostBySlug } from '@/lib/supabase';
import { SITE_NAME } from '@/lib/seo';

// Per-post OG image for blog articles. Overrides the root /opengraph-image
// so a shared link previews the post's hero photo + title instead of the
// generic homepage card.

export const runtime = 'nodejs';
export const alt = 'Aizel journal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#FFFFFF';
const INK = '#0A0A0A';
const GOLD = '#D4A437';
const PURPLE = '#6B2C91';

export default async function PostOgImage({ params }: { params: { slug: string } }) {
  const post = await getBlogPostBySlug(params.slug).catch(() => null);

  if (!post) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: PAPER, color: PURPLE,
          fontSize: 96, fontWeight: 700, letterSpacing: '-0.03em',
          fontFamily: 'sans-serif',
        }}>
          {SITE_NAME} Journal
        </div>
      ),
      { ...size },
    );
  }

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        background: PAPER, fontFamily: 'sans-serif',
        backgroundImage: `radial-gradient(at 0% 100%, ${PURPLE}11, transparent 45%)`,
      }}>
        {post.image_url && (
          <div style={{
            width: 540, height: '100%', display: 'flex',
            background: '#FAFAFA',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt=""
              width={540}
              height={630}
              style={{ width: 540, height: 630, objectFit: 'cover' }}
            />
          </div>
        )}

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '64px 56px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            fontSize: 32, fontWeight: 700, color: PURPLE, letterSpacing: '-0.02em',
          }}>
            Aizel · Journal
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {post.category && (
              <div style={{
                fontSize: 22, fontWeight: 600, color: '#6B7280',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {post.category}
              </div>
            )}
            <div style={{
              fontSize: 56, fontWeight: 700, color: INK,
              letterSpacing: '-0.025em', lineHeight: 1.08,
              display: '-webkit-box', overflow: 'hidden', maxHeight: 260,
            }}>
              {post.title}
            </div>
            {post.excerpt && (
              <div style={{
                fontSize: 24, color: '#374151', lineHeight: 1.35,
                display: '-webkit-box', overflow: 'hidden', maxHeight: 96,
              }}>
                {post.excerpt}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{
              fontSize: 22, fontWeight: 600, color: '#6B7280',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              aizel.co.uk/blog
            </div>
            <div style={{ display: 'flex', height: 10, width: 160, overflow: 'hidden', borderRadius: 2 }}>
              <div style={{ flex: 1, background: PURPLE }} />
              <div style={{ flex: 1, background: GOLD }} />
              <div style={{ flex: 1, background: INK }} />
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
