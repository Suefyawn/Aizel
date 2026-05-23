'use client';

import { useEffect, useState } from 'react';

export interface TocHeading {
  id: string;
  text: string;
}

// Sticky "on this page" rail for the article's left margin. Scroll-spy
// highlights the section currently in view via IntersectionObserver.
export function BlogToc({ headings }: { headings: TocHeading[] }) {
  const [active, setActive] = useState<string>(headings[0]?.id ?? '');

  useEffect(() => {
    const els = headings
      .map(h => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    // The active band is a thin strip just below the sticky site header —
    // a heading becomes "active" as it scrolls up into that strip.
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-96px 0px -68% 0px', threshold: 0 },
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav className="blog-toc" aria-label="On this page">
      <p className="blog-toc-title">On this page</p>
      <ul>
        {headings.map(h => (
          <li key={h.id}>
            <a href={`#${h.id}`} className={active === h.id ? 'is-active' : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
