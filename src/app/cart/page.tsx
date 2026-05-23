import { CartPage } from '@/sections/cart/CartPage';

// User-scoped state; noindex.
// Title intentionally just "Cart" — the root layout's title.template
// adds " | Aizel", so spelling out the brand here gave the doubled
// "Cart — Aizel | Aizel" the audit flagged.
export const metadata = {
  title: 'Cart',
  description: 'Review the items in your bag before checkout.',
  robots: { index: false, follow: false },
};

export default async function CartRoute({ searchParams }: { searchParams: Promise<{ restore?: string }> }) {
  const { restore } = await searchParams;
  return (
    <main className="fade-in">
      <CartPage restoreToken={restore ?? null} />
    </main>
  );
}
