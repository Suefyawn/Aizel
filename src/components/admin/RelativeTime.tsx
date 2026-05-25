'use client';

import { useEffect, useState } from 'react';

// Live "X seconds ago" / "2 minutes ago" / "3 hours ago" formatter that
// updates without a route re-fetch. Used in save bars and activity
// timestamps to give the admin a modern "this just happened" feel
// (Stripe / Linear / Notion all do this).
//
// Falls back to a stable absolute date for anything ≥ 30 days old.

interface Props {
  /** ISO timestamp. */
  iso: string;
  /** Optional prefix like "Saved" → "Saved 2 minutes ago". */
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

function format(diffMs: number): string {
  if (diffMs < 0) return 'in the future';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return null as unknown as string;
}

export function RelativeTime({ iso, prefix, className, style }: Props) {
  const [now, setNow] = useState(() => Date.now());

  // Tick every 30 seconds — fine-grained enough that "2 minutes ago"
  // feels live, cheap enough that 100 of these on a page is fine.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const diff = now - new Date(iso).getTime();
  const rel = format(diff);
  const text = rel ?? new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString('en-GB')}
      className={className}
      style={style}
    >
      {prefix ? `${prefix} ${text}` : text}
    </time>
  );
}
