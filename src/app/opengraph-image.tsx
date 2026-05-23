import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

// Root-level Open Graph image. Picked up automatically as <meta property="og:image">
// for every route that does NOT supply its own image (PDP, blog posts can still
// override via their metadata.openGraph.images). Generated at build time and
// cached — no per-request cost.
//
// 1200x630 is the canonical OG dimension (also satisfies Twitter `summary_large_image`).

export const runtime = 'nodejs';
export const alt = `${SITE_NAME} — Authentic hair & body care in the UK`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PAPER = '#FAF6EE';
const INK = '#0A0A0A';
const GOLD = '#D4A437';
const PURPLE = '#6B2C91';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: PAPER,
          backgroundImage: `
            radial-gradient(at 88% 12%, ${GOLD}55, transparent 50%),
            radial-gradient(at 10% 92%, ${PURPLE}44, transparent 55%)
          `,
          color: INK,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: PURPLE,
          }}
        >
          Aizel
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: 880,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: '-0.035em',
              lineHeight: 1.02,
            }}
          >
            <div style={{ display: 'flex' }}>
              <span>Hair you love</span>
              <span style={{ color: PURPLE }}>.</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span>Brands you trust</span>
              <span style={{ color: GOLD }}>.</span>
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#2A2A2A',
              lineHeight: 1.35,
              maxWidth: 760,
            }}
          >
            Authentic hair &amp; body care brands — Cantu, ORS, Palmer&apos;s, Kuza &amp; more. Free UK delivery over £15.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#2A2A2A',
            }}
          >
            aizel.co.uk
          </div>
          <div
            style={{
              display: 'flex',
              gap: 0,
              height: 12,
              width: 220,
              overflow: 'hidden',
              borderRadius: 3,
            }}
          >
            <div style={{ flex: 1, background: PURPLE }} />
            <div style={{ flex: 1, background: GOLD }} />
            <div style={{ flex: 1, background: INK }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
