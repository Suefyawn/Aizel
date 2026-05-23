// One-click newsletter unsubscribe.
//
// The email and HMAC token come from the link we put in every newsletter +
// transactional email (see `unsubscribeUrl()`). On GET we:
//   1. Verify the token matches the email
//   2. Flip `unsubscribed_at` on the matching `newsletter_subscribers` row
//   3. Render a confirmation (or a resubscribe button for an already-off row)
//
// We don't expose any other identifier here — the token IS the auth.

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { pageMeta } from '@/lib/seo';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';
import { isDemo } from '@/lib/supabase';
import { log } from '@/lib/logger';

export const metadata: Metadata = pageMeta({
  title: 'Newsletter — Unsubscribed',
  description: 'You have been removed from the Aizel mailing list.',
  path: '/newsletter/unsubscribe',
  noIndex: true,
});

type SearchParams = Promise<{ email?: string; token?: string; resubscribe?: string }>;

async function unsubscribeRow(email: string): Promise<{ ok: boolean; alreadyOff: boolean }> {
  if (isDemo) return { ok: true, alreadyOff: false };
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = sb.from('newsletter_subscribers') as any;
    const { data: existing } = await tbl
      .select('email, unsubscribed_at')
      .eq('email', email)
      .maybeSingle();
    if (!existing) {
      // Never on the list — silently treat as success (don't leak whether
      // an address is subscribed).
      return { ok: true, alreadyOff: true };
    }
    if (existing.unsubscribed_at) return { ok: true, alreadyOff: true };
    const { error } = await tbl
      .update({ unsubscribed_at: new Date().toISOString(), marketing_consent: false })
      .eq('email', email);
    if (error) {
      log.error('newsletter.unsubscribe_failed', { email, error: error.message });
      return { ok: false, alreadyOff: false };
    }
    return { ok: true, alreadyOff: false };
  } catch (err) {
    log.error('newsletter.unsubscribe_unexpected', { error: (err as Error).message });
    return { ok: false, alreadyOff: false };
  }
}

async function resubscribeRow(email: string): Promise<boolean> {
  if (isDemo) return true;
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = sb.from('newsletter_subscribers') as any;
    const { error } = await tbl
      .update({ unsubscribed_at: null, marketing_consent: true })
      .eq('email', email);
    return !error;
  } catch {
    return false;
  }
}

export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const { email, token, resubscribe } = await searchParams;
  const trimmed = email?.trim().toLowerCase() ?? '';
  const tokenOk = trimmed && token ? verifyUnsubscribeToken(trimmed, token) : false;

  // Invalid / missing token branch.
  if (!trimmed || !tokenOk) {
    return (
      <Center>
        <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
          Invalid unsubscribe link
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 20px' }}>
          The link you used is missing or out of date. To stop receiving emails, reply
          &ldquo;UNSUBSCRIBE&rdquo; to any newsletter or email{' '}
          <a href="mailto:privacy@aizel.co.uk" className="underline">privacy@aizel.co.uk</a>.
        </p>
        <Link href="/" className="btn-primary">Back to Aizel</Link>
      </Center>
    );
  }

  // Resubscribe path — user is opting back in after unsubscribing.
  if (resubscribe === '1') {
    const ok = await resubscribeRow(trimmed);
    return (
      <Center>
        <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
          {ok ? 'Welcome back' : 'Hmm, that didn’t work'}
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 24px' }}>
          {ok
            ? <>You’ll receive our next newsletter at <strong>{trimmed}</strong>. Unsubscribe anytime.</>
            : 'Please try again or reach out to support.'}
        </p>
        <Link href="/" className="btn-primary">Continue shopping</Link>
      </Center>
    );
  }

  // Default path — unsubscribe.
  const { ok, alreadyOff } = await unsubscribeRow(trimmed);
  return (
    <Center>
      <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
        {ok
          ? (alreadyOff ? 'Already unsubscribed' : 'You’ve been unsubscribed')
          : 'Something went wrong'}
      </h1>
      <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 24px' }}>
        {ok
          ? <>We won’t send marketing emails to <strong>{trimmed}</strong> anymore. You’ll still receive order receipts and shipping updates.</>
          : 'Please try again or email privacy@aizel.co.uk and we’ll handle it manually.'}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/" className="btn-primary">Back to Aizel</Link>
        {ok && (
          <Link
            href={`/newsletter/unsubscribe?email=${encodeURIComponent(trimmed)}&token=${token}&resubscribe=1`}
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Changed your mind? Resubscribe
          </Link>
        )}
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 520 }}>
          {children}
        </div>
      </section>
    </main>
  );
}
