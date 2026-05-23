'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Overline } from '@/components/ui/Overline';

// "Shop by category" — two equal pillars: Makeup & Skincare (outer) and
// Health & Wellness (inner). Tile images are passed in from the homepage:
// a curated editorial photo per category, all shot on a shared backdrop
// so the grid reads as one cohesive set.

export interface CategoryTile {
  label: string;
  href: string;
  image?: string;
}

export interface CategoryTileGroup {
  title: string;
  tiles: CategoryTile[];
}

function CatTile({ label, href, image }: CategoryTile) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ overflow: 'hidden', borderRadius: 'var(--radius-card)', position: 'relative', aspectRatio: '1' }}
      >
        {image && !imgFailed ? (
          <Image
            src={image} alt={label}
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 900px) 50vw, 25vw"
            onError={() => setImgFailed(true)}
            style={{
              objectFit: 'cover',
              transform: hovered ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 350ms ease-out',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, var(--paper2) 0%, #f0e6d8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Overline style={{ color: 'var(--ink-500)', fontSize: '0.75rem', textAlign: 'center' }}>{label}</Overline>
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: hovered
            ? 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.12) 100%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)',
          transition: 'background 300ms ease-out',
          display: 'flex', alignItems: 'flex-end', padding: 14,
        }}>
          <Overline style={{ color: '#fff', fontSize: '0.8125rem', letterSpacing: '0.12em' }}>{label}</Overline>
        </div>
      </div>
    </Link>
  );
}

export function CategoryTiles({ groups }: { groups: CategoryTileGroup[] }) {
  return (
    <section style={{ padding: 'var(--section-gap) 0' }}>
      <div className="container">
        <Overline style={{ display: 'block', marginBottom: 6 }}>Shop by category</Overline>
        <h2 className="display-l" style={{ fontSize: '1.75rem', margin: '0 0 32px' }}>
          Beauty, <em style={{ fontStyle: 'italic' }}>inside out</em>
        </h2>
        {groups.map(group => (
          <div key={group.title} style={{ marginBottom: 32 }}>
            <Overline style={{ display: 'block', marginBottom: 14, color: 'var(--ink-500)' }}>{group.title}</Overline>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="cat-grid">
              {group.tiles.map(t => <CatTile key={t.label} {...t} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
