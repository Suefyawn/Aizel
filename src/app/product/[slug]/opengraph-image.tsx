import { ImageResponse } from 'next/og';
import { getProductBySlug } from '@/lib/supabase';
import { SITE_NAME } from '@/lib/seo';
import { brandPlusName } from '@/lib/product-display';

// Per-PDP Open Graph image — overrides the root /opengraph-image.tsx for
// product pages so a shared link previews the actual product photo +
// title + price instead of the generic homepage card.
//
// Vercel ImageResponse renders on the edge at build time (for static
// params) and on-demand otherwise; the response is cached on the CDN so
// repeat shares cost nothing.

export const runtime = 'nodejs';
export const alt = 'Aizel product';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#FFFFFF';
const INK = '#0A0A0A';
const GOLD = '#D4A437';
const PURPLE = '#6B2C91';

export default async function ProductOgImage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug).catch(() => null);

  // Fallback to a brand card if the slug doesn't resolve — better than
  // 500-ing the OG endpoint, which would block the share preview entirely.
  if (!product) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: PAPER, color: PURPLE,
          fontSize: 96, fontWeight: 700, letterSpacing: '-0.03em',
          fontFamily: 'sans-serif',
        }}>
          {SITE_NAME}
        </div>
      ),
      { ...size },
    );
  }

  const title = brandPlusName(product.brand, product.name);
  const priceStr = `£${product.price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const onSale = product.original_price && product.original_price > product.price;
  const originalStr = onSale
    ? `£${product.original_price!.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        background: PAPER,
        backgroundImage: `radial-gradient(at 100% 0%, ${PURPLE}11, transparent 40%)`,
        fontFamily: 'sans-serif',
      }}>
        {/* Left column — image */}
        <div style={{
          width: 540, height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#FAFAFA',
          borderRight: `1px solid ${INK}10`,
        }}>
          {product.image_url ? (
            // Embed via <img>; ImageResponse handles fetching + scaling.
            <img
              src={product.image_url}
              alt=""
              width={460}
              height={460}
              style={{ objectFit: 'contain', maxWidth: 460, maxHeight: 460 }}
            />
          ) : (
            <div style={{ fontSize: 96, color: PURPLE, fontWeight: 700 }}>
              {(product.brand?.[0] ?? product.name[0] ?? 'A').toUpperCase()}
            </div>
          )}
        </div>

        {/* Right column — copy */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '64px 56px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            fontSize: 32, fontWeight: 700, color: PURPLE, letterSpacing: '-0.02em',
          }}>
            Aizel
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {product.brand && (
              <div style={{
                fontSize: 22, fontWeight: 600, color: '#6B7280',
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {product.brand}
              </div>
            )}
            <div style={{
              fontSize: 54, fontWeight: 700, color: INK,
              letterSpacing: '-0.025em', lineHeight: 1.08,
              // Clamp to ~3 visible lines so a very long product name
              // doesn't overflow the card edge.
              display: '-webkit-box',
              overflow: 'hidden',
              maxHeight: 200,
            }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{ fontSize: 56, fontWeight: 700, color: INK, letterSpacing: '-0.02em' }}>
                {priceStr}
              </span>
              {originalStr && (
                <span style={{ fontSize: 30, color: '#9CA3AF', textDecoration: 'line-through' }}>
                  {originalStr}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{
              fontSize: 22, fontWeight: 600, color: '#6B7280',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              Free UK delivery over £15
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
