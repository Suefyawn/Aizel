'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

function Countdown({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!endDate) return;
    const target = new Date(endDate).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft('Offer ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const d = Math.floor(h / 24);
      setTimeLeft(d > 0
        ? `${d}d ${h % 24}h ${m}m`
        : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!timeLeft) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', background: 'rgba(0,0,0,0.2)',
      borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
    }}>
      ⏱ {timeLeft}
    </span>
  );
}

interface PromoBannerProps {
  label: string;
  headline: string;
  subline: string;
  ctaText: string;
  ctaUrl: string;
  bgColor: string;
  textColor: string;
  endDate: string;
}

export function PromoBanner({ label, headline, subline, ctaText, ctaUrl, bgColor, textColor, endDate }: PromoBannerProps) {
  // On mobile this banner used to eat ~250 px of the first viewport (label
  // chip + headline + subline + CTA all stacked) so the user landed on the
  // home page looking at a promo, not the product hero. Tightened the
  // mobile spacing (12 / 16 / 18 instead of 20 / 24 / 24) and hid the
  // subline below 600 px — desktop still gets the full editorial card.
  return (
    <div className="promo-banner" style={{
      background: bgColor, color: textColor,
      padding: '20px 24px', textAlign: 'center',
      borderBottom: `3px solid rgba(255,255,255,0.2)`,
    }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{
            padding: '3px 12px', background: 'rgba(255,255,255,0.25)',
            borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            {label}
          </span>
          {endDate && <Countdown endDate={endDate} />}
        </div>

        {headline && (
          <div className="promo-banner-headline" style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>{headline}</div>
        )}
        {subline && (
          <div className="promo-banner-subline" style={{ fontSize: '0.875rem', opacity: 0.9 }}>{subline}</div>
        )}

        {ctaText && (
          <Link href={ctaUrl} style={{
            display: 'inline-block', marginTop: 4,
            padding: '8px 24px', background: 'rgba(255,255,255,0.2)',
            border: `1px solid rgba(255,255,255,0.4)`,
            borderRadius: 'var(--radius-pill)', color: textColor,
            fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.15s',
          }}>
            {ctaText} →
          </Link>
        )}
      </div>
    </div>
  );
}
