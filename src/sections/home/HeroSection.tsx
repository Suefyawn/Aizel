'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Overline } from '@/components/ui/Overline';

interface HeroSettings {
  overline: string;
  headline: string;
  subline: string;
  cta1Text: string;
  cta1Url: string;
  cta2Text: string;
  cta2Url: string;
  imageUrl: string;
  brands: string[];
}

const DEFAULTS: HeroSettings = {
  overline: 'Authentic Hair & Body Care · UK',
  headline: 'Hair you love.<br/><em>Brands you trust.</em>',
  subline: 'Authentic Cantu, ORS, Palmer\'s, Kuza, ApHogee and more — delivered fast across the UK. Free delivery on orders over £15.',
  cta1Text: 'Shop Hair Care',
  cta1Url: '/shop?taxon=hair',
  cta2Text: 'Shop Body Care',
  cta2Url: '/shop?taxon=body',
  imageUrl: '',
  brands: ['Cantu', 'ORS', "Palmer's", 'Kuza', 'ApHogee', 'KeraCare'],
};

// Soft, on-brand gradient that stands in for the hero photo until the
// merchant uploads one in admin/settings. Intentionally text-free — it
// looks like a deliberate design, not "broken admin chatter on the
// customer page".
const GradientFallback = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(at 78% 22%, rgba(212, 164, 55, 0.40), transparent 55%),
        radial-gradient(at 22% 78%, rgba(107, 44, 145, 0.30), transparent 55%),
        linear-gradient(135deg, #FAF6EE 0%, #F2EDE2 50%, #FAF6EE 100%)`,
    }}
  />
);

export function HeroSection({ settings }: { settings?: Partial<HeroSettings> }) {
  const s: HeroSettings = { ...DEFAULTS, ...settings };
  const [imgFailed, setImgFailed] = useState(false);

  // Convert newlines to <br/> for headline
  const headlineHtml = s.headline
    .replace(/\n/g, '<br/>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  return (
    <section style={{ padding: 0, borderBottom: '1px solid var(--line)' }}>
      <div className="container hero-grid" style={{
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', minHeight: 520, alignItems: 'center',
      }}>
        <div style={{ paddingRight: 48, paddingTop: 48, paddingBottom: 48 }}>
          <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>{s.overline}</Overline>
          <h1
            className="display-xl"
            style={{ marginBottom: 20 }}
            dangerouslySetInnerHTML={{ __html: headlineHtml }}
          />
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 400, marginBottom: 28 }}>
            {s.subline}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href={s.cta1Url} className="btn-primary">{s.cta1Text}</Link>
            {s.cta2Text && <Link href={s.cta2Url} className="btn-secondary">{s.cta2Text}</Link>}
          </div>
          {s.brands.length > 0 && (
            <div style={{ marginTop: 24, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              {s.brands.map(b => (
                <span key={b} style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>{b}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', alignSelf: 'stretch' }}>
          {s.imageUrl && !imgFailed ? (
            <Image
              src={s.imageUrl}
              alt="Aizel — Authentic hair &amp; body care brands"
              fill
              // Hero shot is the LCP — mark it `priority` so Next emits a
              // <link rel="preload"> and skips lazy-loading. `sizes`
              // matches the grid: 90vw on phones (single column), 45vw on
              // desktop (right column of a 1.1fr/0.9fr split).
              priority
              fetchPriority="high"
              sizes="(max-width: 900px) 100vw, 45vw"
              onError={() => setImgFailed(true)}
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <GradientFallback />
          )}
          <div aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: 0, width: 6, height: 80, background: 'var(--brand-yellow)' }} />
        </div>
      </div>
    </section>
  );
}
