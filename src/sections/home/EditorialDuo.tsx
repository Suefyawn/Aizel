'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Overline } from '@/components/ui/Overline';

// Editorial cards anchored beneath the hero. Each card now takes an `img`
// from the page (homepage picks a lead product image per category via
// getCategoryHeroImages). When no image resolves the gradient fallback
// ships a clean on-brand placeholder — never a broken-image icon.
const BASE_CARDS = [
  {
    title: 'Wash Day Essentials',
    subtitle: 'Hair Care Edit',
    cta: 'Shop Hair Care',
    href: '/shop?taxon=hair',
    // Pale purple — was #EFE3F3 (paler) / #F5E6CF (cream); the cream
    // tile read as a YellowPink hangover. Both fallbacks are now purple
    // tints at different lightnesses so the two cards stay distinct.
    fallbackColor: '#EFE3F3',
    alt: 'Curated shampoo, conditioner and treatment essentials',
  },
  {
    title: 'Butters & Oils',
    subtitle: 'Body Care Edit',
    cta: 'Shop Body Care',
    href: '/shop?taxon=body',
    fallbackColor: '#E2D2EB',
    alt: 'Cocoa butter, shea butter and body oils',
  },
];

interface DuoCardProps {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  img: string;
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

export function EditorialDuo({ hairImage = '', bodyImage = '' }: { hairImage?: string; bodyImage?: string }) {
  // Hydrate the static card metadata with the per-render images passed
  // from the homepage. Empty string is the documented "no image" signal
  // that DuoCard's gradient fallback handles.
  const cards = [
    { ...BASE_CARDS[0], img: hairImage },
    { ...BASE_CARDS[1], img: bodyImage },
  ];
  return (
    <section style={{ paddingBottom: 'var(--section-gap)' }}>
      <div className="container">
        <SectionDivider />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gutter)', marginTop: 'var(--section-gap)' }} className="duo-grid">
          {cards.map(c => <DuoCard key={c.title} {...c} />)}
        </div>
      </div>
    </section>
  );
}
