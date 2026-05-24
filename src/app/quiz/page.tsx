// 1-hour ISR — the question bank only changes when we deliberately ship a
// new revision, and the candidate-product pool needs a refresh now and then
// so a brand-new SKU surfaces in the result rail without a redeploy.
export const revalidate = 3600;

import type { Metadata } from 'next';
import { getProducts } from '@/lib/supabase';
import { QuizClient } from './QuizClient';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Hair quiz — find your routine',
  description: 'Answer five questions about your hair and we\'ll recommend the right starting point from our UK Afro/Black hair-care brands.',
  path: '/quiz',
});

export default async function QuizPage() {
  // Pull the full product list once on the server so the result rail can
  // render synchronously after scoring — keeps the result-reveal animation
  // snappy without a network round-trip on the way to the result page.
  // Demo-mode short-circuit lives inside getProducts() so the page works
  // without Supabase too.
  const products = await getProducts();

  return (
    <main className="fade-in" style={{ padding: '48px 0 64px' }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <QuizClient products={products} />
      </div>
    </main>
  );
}
