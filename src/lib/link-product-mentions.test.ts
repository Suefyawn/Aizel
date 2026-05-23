import { describe, expect, it } from 'vitest';
import { linkProductMentions } from './link-product-mentions';
import type { Product } from '@/types';

// Minimal Product stub — only the fields linkProductMentions reads.
function p(slug: string, brand: string, name: string): Product {
  return {
    id: slug,
    slug,
    brand,
    name,
    price: 0,
    stock: 1,
    image_url: '',
    description: '',
    category: 'makeup',
    subcategory: null,
    tag: null,
    benefits: null,
    skin_type: null,
    is_featured: false,
    is_active: true,
    created_at: '',
  } as unknown as Product;
}

describe('linkProductMentions', () => {
  const kiko = p('kiko-3d-hydra', 'Kiko Milano', 'Kiko Milano 3D Hydra Lip Gloss');
  const cerave = p('cerave-cleanser', 'CeraVe', 'CeraVe Hydrating Cleanser');

  it('returns the input unchanged when no products are provided', () => {
    expect(linkProductMentions('<p>Hello world</p>', [])).toBe('<p>Hello world</p>');
  });

  it('links the first mention of a product by full name', () => {
    const html = '<p>We love the Kiko Milano 3D Hydra Lip Gloss this season.</p>';
    const out = linkProductMentions(html, [kiko]);
    expect(out).toContain('href=');
    expect(out).toContain('/product/kiko-3d-hydra');
    expect(out).toContain('Kiko Milano 3D Hydra Lip Gloss');
  });

  it('prefers the longest match (full name over bare brand)', () => {
    const html = '<p>The Kiko Milano 3D Hydra Lip Gloss is a hit.</p>';
    const out = linkProductMentions(html, [kiko]);
    // The anchor must wrap the full phrase, not just "Kiko Milano".
    const m = out.match(/<a [^>]+>([^<]+)<\/a>/);
    expect(m?.[1]).toBe('Kiko Milano 3D Hydra Lip Gloss');
  });

  it('only links the first occurrence of a product', () => {
    const html = '<p>CeraVe Hydrating Cleanser is great. The CeraVe Hydrating Cleanser is also affordable.</p>';
    const out = linkProductMentions(html, [cerave]);
    const matches = out.match(/<a [^>]+>/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('does not link inside an existing <a>', () => {
    const html = '<p>See <a href="/x">CeraVe Hydrating Cleanser</a> review.</p>';
    const out = linkProductMentions(html, [cerave]);
    // No new anchor should be added inside the existing one.
    const matches = out.match(/<a [^>]+>/g) ?? [];
    expect(matches.length).toBe(1);
    expect(out).toContain('href="/x"');
  });

  it('does not link inside <code>', () => {
    const html = '<p>Compare with <code>CeraVe Hydrating Cleanser</code>.</p>';
    const out = linkProductMentions(html, [cerave]);
    expect(out).not.toContain('blog-product-link');
  });

  it('is case-insensitive', () => {
    const html = '<p>cerave hydrating cleanser is solid.</p>';
    const out = linkProductMentions(html, [cerave]);
    expect(out).toContain('blog-product-link');
  });

  it('handles punctuation around the phrase', () => {
    const html = "<p>(CeraVe Hydrating Cleanser) — try it.</p>";
    const out = linkProductMentions(html, [cerave]);
    expect(out).toContain('blog-product-link');
  });

  it('does not link a partial-word match', () => {
    // "Kiko Milano" appears as a substring of "KikoMilano" → no link.
    const html = '<p>KikoMilanoBrand is not the same.</p>';
    const out = linkProductMentions(html, [kiko]);
    expect(out).not.toContain('blog-product-link');
  });
});
