'use server';

import { revalidatePath } from 'next/cache';
import { headers, cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { reviewSchema, parseForm, firstError } from '@/lib/validators';

function findSupabaseAuthCookie(all: { name: string; value: string }[]): string | null {
  const c = all.find(c => /^sb-.+-auth-token$/.test(c.name));
  return c?.value ?? null;
}

export async function submitReview(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const h = await headers();
  const { success: rateOk } = await reviewLimiter.limit(ipFromHeaders(h));
  if (!rateOk) return { error: 'Please slow down — try again in a minute.' };

  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Best-effort: attribute to the signed-in user if we can resolve the token.
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const token = findSupabaseAuthCookie(cookieStore.getAll());
    if (token) {
      let accessToken: string | undefined;
      try {
        const parsedCookie = JSON.parse(token);
        accessToken = parsedCookie?.access_token;
      } catch { /* not JSON */ }
      if (accessToken) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await adminClient.auth.getUser(accessToken);
        userId = data.user?.id ?? null;
      }
    }
  } catch { /* non-fatal */ }

  // Verified-purchase derivation. Uses the new has_purchased_product RPC.
  let verified = false;
  if (userId || parsed.data.reviewer_email) {
    const { data } = await supabase.rpc('has_purchased_product' as never, {
      p_product_id: parsed.data.product_id,
      p_email:      parsed.data.reviewer_email || null,
      p_user_id:    userId,
    } as never);
    verified = Boolean(data);
  }

  // P1: only accept photo URLs from our own Supabase Storage bucket. Without
  // this restriction an attacker could submit reviews whose photo URLs point
  // at attacker-controlled hosts, embedding them on PDPs after approval.
  // Storage base URL is derived from the project's public URL so this is
  // resilient to a project change.
  const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^https?:\/\//, '');
  const allowedPrefix = supabaseHost ? `https://${supabaseHost}/storage/v1/object/public/` : null;
  const photoUrls: string[] = ((parsed.data.photo_urls ?? '') as string)
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => /^https?:\/\//i.test(s))
    .filter((s: string) => !allowedPrefix || s.startsWith(allowedPrefix))
    .slice(0, 6); // hard cap on photos per review

  const { error } = await supabase.from('product_reviews').insert({
    product_id:        parsed.data.product_id,
    user_id:           userId,
    author_name:       parsed.data.author_name,
    reviewer_email:    parsed.data.reviewer_email || null,
    rating:            parsed.data.rating,
    body:              parsed.data.body,
    photo_urls:        photoUrls,
    verified_purchase: verified,
    approved:          false,
  });
  if (error) return { error: error.message };

  revalidatePath(`/product`);
  return { success: true };
}

// ─── Helpful-vote action ───────────────────────────────────────────────────
import { createHash } from 'crypto';
export async function voteReviewHelpful(reviewId: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  const h = await headers();
  const { success: rateOk } = await reviewLimiter.limit(`helpful:${ipFromHeaders(h)}`);
  if (!rateOk) return { ok: false, error: 'rate limited' };

  const voterKey = createHash('sha256')
    .update(`${ipFromHeaders(h)}|${h.get('user-agent') ?? ''}|${reviewId}`)
    .digest('hex')
    .slice(0, 32);

  // Service-role client so we can write to review_helpful_votes (no public-write policy).
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  // Insert; ignore conflict (already voted).
  const { error: insErr } = await sb.from('review_helpful_votes').insert({
    review_id: reviewId, voter_key: voterKey,
  });
  if (insErr) {
    if (insErr.code === '23505') return { ok: true };   // already voted — no-op
    return { ok: false, error: insErr.message };
  }

  const { data, error } = await sb.rpc('bump_review_helpful' as never, { p_review_id: reviewId } as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: typeof data === 'number' ? data : undefined };
}
