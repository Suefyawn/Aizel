'use client';

import { useEffect, useState } from 'react';

// ─── Blog share strip ─────────────────────────────────────────────────────
// Renders below the post hero. WhatsApp + Copy-link + native Web Share
// (mobile) + Facebook share. Native share button shows only when the
// browser exposes navigator.share (mostly mobile). The Copy-link button
// flips to "Copied ✓" for 1.5s for feedback.
//
// All four targets are URL-only (no API keys, no third-party scripts)
// so this works on the free Vercel + Supabase tier with zero overhead.

interface Props {
  title: string;
  /** Absolute, canonical URL of the post — e.g.
   *  "https://www.aizel.co.uk/blog/<slug>". Must be absolute: Facebook's
   *  sharer 500s on a relative `u=` param, and the link is server-rendered
   *  so a relative path would ship to crawlers. The server caller builds it
   *  with absoluteUrl(). */
  url: string;
  excerpt?: string | null;
}

export function BlogShareStrip({ title, url, excerpt }: Props) {
  const [copied, setCopied] = useState(false);
  // navigator.share is browser-only — detect it after mount so the server
  // render and the first client render agree (only the mount-gated "More"
  // button depends on it). The share URL itself is a prop, so it is
  // byte-identical on both sides and needs no mount gate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const text = excerpt ? `${title} — ${excerpt}` : title;

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers without Permission for clipboard — degrade silently;
      // the link is already visible in the URL bar.
    }
  };

  const handleNativeShare = async () => {
    if (!('share' in navigator)) return;
    try {
      await navigator.share({ title, text: excerpt ?? title, url });
    } catch {
      /* user cancelled */
    }
  };

  const hasNative = mounted && typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div
      role="group"
      aria-label="Share this article"
      style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        margin: '24px 0 8px',
      }}
    >
      <span style={{
        fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-500)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4,
      }}>Share</span>

      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        style={btnStyle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span>WhatsApp</span>
      </a>

      <a
        href={fbHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        style={btnStyle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 12a10 10 0 10-11.6 9.9V14.9h-2.5V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.3 0-1.7.8-1.7 1.6V12h2.9l-.5 2.9h-2.4v7A10 10 0 0022 12z" />
        </svg>
        <span>Facebook</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
        style={{
          ...btnStyle,
          background: copied ? 'var(--success, #16a34a)' : btnStyle.background,
          color: copied ? '#fff' : btnStyle.color,
          borderColor: copied ? 'transparent' : (btnStyle.border as string),
          cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </>
          )}
        </svg>
        <span>{copied ? 'Copied' : 'Copy link'}</span>
      </button>

      {hasNative && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label="Share via system share sheet"
          style={{ ...btnStyle, cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>More</span>
        </button>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px',
  background: 'transparent', color: 'var(--ink-700)',
  border: '1px solid var(--line)', borderRadius: 999,
  fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-ui)',
  textDecoration: 'none',
  transition: 'background 150ms, color 150ms',
};
