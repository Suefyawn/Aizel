'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

// Editorial cards anchored beneath the hero. Title / subtitle / CTA /
// image are operator-managed via the admin Homepage page (table:
// homepage_content, kind='banner_card'). The homepage server component
// passes a `banners` array of 2 cards; if the operator has fewer than 2
// active rows, the section renders empty.
//
// The fallback colours below are used when an image either fails to load
// or isn't set yet. Two purple tints so the two cards stay visually
// distinct even in the gradient state.
const FALLBACK_COLORS = ['#EFE3F3', '#E2D2EB'];

interface BannerInput {
  title:    string;
  subtitle: string;
  cta:      string;
  href:     string;
  img:      string;
}

interface DuoCardProps extends BannerInput {
  alt: string;
  fallbackColor: string;
}

function DuoCard({ title, subtitle, cta, href, img, alt, fallbackColor }: DuoCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  // Treat empty-string `img` as "no image" so we render the gradient fallback
  // instead of letting next/image complain about a missing src.
  const hasImage = Boolean(img && !imgFailed);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
      >
        <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)', aspectRatio: '4/3', position: 'relative' }}>
          {hasImage ? (
            <Image
              src={img} alt={alt}
              fill
              // Two-up grid below the hero — half-width on desktop, full on
              // phone (per the .duo-grid mobile rule in globals.css).
              sizes="(max-width: 900px) 100vw, 50vw"
              onError={() => setImgFailed(true)}
              style={{
                objectFit: 'cover',
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 400ms ease-out',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${fallbackColor} 0%, ${fallbackColor}88 100%)` }} />
          )}
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)',
          }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>{subtitle}</Overline>
          <h2 className="display-l" style={{ fontSize: '2rem', marginBottom: 12 }}>{title}</h2>
          <span className="text-link">{cta}</span>
        </div>
      </div>
    </Link>
  );
}

export function EditorialDuo({ banners = [] }: { banners?: BannerInput[] }) {
  // Render up to 2 banners. If the operator only configured one, the
  // section degrades gracefully to a single full-width card rather than
  // shipping an empty slot.
  const cards = banners.slice(0, 2).map((b, i) => ({
    ...b,
    fallbackColor: FALLBACK_COLORS[i] ?? FALLBACK_COLORS[0],
    alt: b.title,
  }));
  if (cards.length === 0) return null;
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ display: 'grid', gridTemplateColumns: cards.length === 2 ? '1fr 1fr' : '1fr', gap: 'var(--gutter)', marginTop: 'var(--section-gap)' }} className="duo-grid">
          {cards.map(c => <DuoCard key={c.title} {...c} />)}
        </div>
      </div>
    </section>
  );
}
