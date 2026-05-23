'use server';

// Anon-callable server action to capture an abandoned cart. Called from
// CheckoutPage when the user enters their email and has at least one cart
// item. Idempotent — the underlying RPC upserts on email.

import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { emailSchema } from '@/lib/validators';
import type { CartItem } from '@/types';

interface CartSnapshot {
  email: string;
  items: CartItem[];
  subtotal: number;
  user_id?: string | null;
}

export async function captureAbandonedCart(snapshot: CartSnapshot): Promise<{ ok: true; token?: string } | { ok: false; error: string }> {
  const parsedEmail = emailSchema.safeParse(snapshot.email);
  if (!parsedEmail.success) return { ok: false, error: 'invalid email' };
  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    return { ok: false, error: 'cart is empty' };
  }

  // Soft rate-limit by IP so we don't get hammered by a runaway client.
  const h = await headers();
  const { success } = await checkoutLimiter.limit(`abandoned:${ipFromHeaders(h)}`);
  if (!success) return { ok: false, error: 'rate limited' };

  const { data, error } = await supabase.rpc('capture_abandoned_cart' as never, {
    p_email:    snapshot.email,
    p_cart:     snapshot.items,
    p_subtotal: snapshot.subtotal,
    p_user_id:  snapshot.user_id ?? null,
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true, token: typeof data === 'string' ? data : undefined };
}
