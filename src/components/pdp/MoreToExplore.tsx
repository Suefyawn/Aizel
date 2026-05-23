import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import type { Product } from '@/types';

// PDP cross-link rails. The product page otherwise links out only through
// its breadcrumb and the "Pairs With" rail; these two rails point shoppers
// (and crawlers) at the brand listing and the category listing, each with
// up to four sibling products. The rail headers link to the matching
// /shop filter so the PDP stops being a near dead-end for internal links.
interface Props {
  brand: string | null;
  category: string;
  brandProducts: Product[];
  categoryProducts: Product[];
  /** Current product + products already shown above, so rails don't repeat them. */
  excludeIds: string[];
}

function Rail({ heading, href, linkLabel, products, style }: {
  heading: string;
  href: string;
  linkLabel: string;
  products: Product[];
  style?: CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <Overline>{heading}</Overline>
        <Link href={href} className="text-link" style={{ whiteSpace: 'nowrap' }}>{linkLabel}</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
        {products.map(p => <ProductTile key={p.id} product={p} />)}
      </div>
    </div>
  );
}

export function MoreToExplore({ brand, category, brandProducts, categoryProducts, excludeIds }: Props) {
  const seen = new Set(excludeIds);
  const brandRow = brandProducts.filter(p => !seen.has(p.id)).slice(0, 4);
  brandRow.forEach(p => seen.add(p.id));
  const categoryRow = categoryProducts.filter(p => !seen.has(p.id)).slice(0, 4);

  // Require >= 2 so a rail never renders as a lone, sparse tile. A small
  // category fully consumed by the "Pairs With" rail above simply collapses.
  const showBrand = Boolean(brand) && brandRow.length >= 2;
  const showCategory = Boolean(category) && categoryRow.length >= 2;
  if (!showBrand && !showCategory) return null;

  return (
    <section style={{ padding: '64px 0' }}>
      <div className="container">
        {showBrand && (
          <Rail
            heading={`More from ${brand}`}
            href={`/shop?brand=${encodeURIComponent(brand as string)}`}
            linkLabel={`Shop all ${brand} →`}
            products={brandRow}
          />
        )}
        {showCategory && (
          <Rail
            heading={`More in ${category}`}
            href={`/shop?category=${encodeURIComponent(category)}`}
            linkLabel={`Shop all ${category} →`}
            products={categoryRow}
            style={showBrand ? { marginTop: 56 } : undefined}
          />
        )}
      </div>
    </section>
  );
}
