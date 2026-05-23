import { describe, expect, it } from 'vitest';
import { breadcrumbLd, jsonLd, productLd, truncateOnWord } from './seo';
import type { Product, ProductReview, ProductVariant } from '@/types';

const sampleProduct: Product = {
  id: 'p1', brand: 'CeraVe', name: 'Moisturizing Cream', slug: 'cerave-moisturizing-cream',
  price: 2400, category: 'Skincare', stock: 10, image_url: 'https://example.com/img.jpg',
  description: 'A cream',
};

function makeVariant(price: number, stock = 5): ProductVariant {
  return {
    id: 'v-' + price, product_id: 'p1', sku: null, price, stock,
    enabled: true, sort_order: 0,
  };
}

describe('SEO JSON-LD helpers', () => {
  it('builds a Product schema with availability based on stock', () => {
    const ld = productLd(sampleProduct);
    expect(ld['@type']).toBe('Product');
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/InStock');
  });

  it('marks out-of-stock products as OutOfStock', () => {
    const ld = productLd({ ...sampleProduct, stock: 0 });
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits aggregateRating when there are no reviews', () => {
    const ld = productLd(sampleProduct);
    expect(ld.aggregateRating).toBeUndefined();
  });

  it('computes aggregateRating from review array', () => {
    const reviews: Pick<ProductReview, 'rating'>[] = [{ rating: 5 }, { rating: 4 }, { rating: 5 }];
    const ld = productLd(sampleProduct, reviews);
    const ar = ld.aggregateRating as { ratingValue: number; reviewCount: number };
    expect(ar.reviewCount).toBe(3);
    expect(ar.ratingValue).toBeCloseTo(4.7, 1);
  });

  it('strips undefined when serialising via jsonLd', () => {
    const out = jsonLd({ a: 1, b: undefined, c: 'x' });
    expect(out).not.toMatch(/undefined/);
    expect(JSON.parse(out)).toEqual({ a: 1, c: 'x' });
  });

  it('emits AggregateOffer with low/high when variants span prices', () => {
    const variants = [makeVariant(2000), makeVariant(3500), makeVariant(2750)];
    const ld = productLd(sampleProduct, [], variants);
    const offer = ld.offers as { '@type': string; lowPrice: number; highPrice: number; offerCount: number };
    expect(offer['@type']).toBe('AggregateOffer');
    expect(offer.lowPrice).toBe(2000);
    expect(offer.highPrice).toBe(3500);
    expect(offer.offerCount).toBe(3);
  });

  it('uses a flat Offer when all variants share one price', () => {
    const variants = [makeVariant(2400), makeVariant(2400)];
    const ld = productLd(sampleProduct, [], variants);
    expect((ld.offers as { '@type': string })['@type']).toBe('Offer');
  });

  it('marks AggregateOffer OutOfStock when no variant has stock', () => {
    const variants = [makeVariant(2000, 0), makeVariant(2500, 0)];
    const ld = productLd({ ...sampleProduct, stock: 0 }, [], variants);
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/OutOfStock');
  });

  it('emits up to 5 review entries', () => {
    const reviews = Array.from({ length: 8 }, (_, i) => ({
      rating: 5, body: 'great ' + i, author_name: 'User ' + i, created_at: '2026-01-01',
    }));
    const ld = productLd(sampleProduct, reviews);
    expect((ld.review as unknown[]).length).toBe(5);
  });

  it('includes shipping + return policy on every offer', () => {
    const ld = productLd(sampleProduct);
    const offer = ld.offers as { shippingDetails: unknown; hasMerchantReturnPolicy: unknown };
    expect(offer.shippingDetails).toBeDefined();
    expect(offer.hasMerchantReturnPolicy).toBeDefined();
  });

  describe('truncateOnWord', () => {
    it('returns input unchanged when under the cap', () => {
      expect(truncateOnWord('Hello world', 60)).toBe('Hello world');
    });

    it('truncates at the last word boundary above 60% of cap', () => {
      const out = truncateOnWord('Kiko Milano 3D Hydra Lip Gloss 04 Pearly Peach Rose Limited Edition', 40);
      expect(out.endsWith('…')).toBe(true);
      expect(out.length).toBeLessThanOrEqual(41);
      // Trims trailing punctuation before the ellipsis.
      expect(out).not.toMatch(/[-,:;.]…$/);
    });

    it('hard-cuts when no word boundary is reachable', () => {
      // Single-word string longer than the cap — should still terminate cleanly.
      const out = truncateOnWord('SuperCalifragilisticExpialidocious', 12);
      expect(out.endsWith('…')).toBe(true);
    });

    it('handles empty / short input', () => {
      expect(truncateOnWord('', 60)).toBe('');
      expect(truncateOnWord('a', 60)).toBe('a');
    });
  });

  it('builds breadcrumb with positional list', () => {
    const ld = breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/shop' },
    ]);
    const list = ld.itemListElement as Array<{ position: number; name: string }>;
    expect(list[0].position).toBe(1);
    expect(list[1].name).toBe('Shop');
  });
});
