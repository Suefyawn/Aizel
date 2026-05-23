'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { z } from 'zod';
import { supabase, isDemo } from '@/lib/supabase';
import { newsletterLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import { sendNewsletterWelcomeEmail } from '@/lib/email';

// Newsletter signup server action — wired into the footer form, post-purchase
// opt-in, and the timed / exit-intent modal.
//
// Returns a discriminated state for `useActionState`:
//   { ok: true, email }            on success
//   { ok: false, error: string }   on validation / rate-limit failure
//
// In demo mode (no Supabase env) we still validate + rate-limit, but skip the
// DB insert and log the would-be subscription so the form feels real.

const SOURCE_VALUES = ['footer', 'modal', 'exit_intent', 'checkout', 'post_purchase'] as const;
const SignupSchema = z.object({
  email: z.string().email().max(254),
  source: z.enum(SOURCE_VALUES).default('footer'),
  // Honeypot — bots fill this; real users never see it.
  website: z.string().max(0).optional(),
});

export type NewsletterState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const raw = Object.fromEntries(formData);
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  const { email, source, website } = parsed.data;
  // Honeypot tripped — silent success so the bot moves on without learning anything.
  if (website) return { ok: true, email };

  const hdrs = await headers();
  const ip = ipFromHeaders(hdrs);
  const ua = hdrs.get('user-agent')?.slice(0, 240) ?? null;

  const rl = await newsletterLimiter.limit(ip);
  if (!rl.success) {
    return { ok: false, error: 'Too many requests, please try again later.' };
  }

  if (isDemo) {
    log.info('newsletter.demo_subscribe', { email, source });
    // Even in demo mode, fire the welcome email — it's how the merchant
    // verifies the template + Resend wiring before going live.
    after(() => sendNewsletterWelcomeEmail({ email, source }));
    return { ok: true, email };
  }

  try {
    const normalisedEmail = email.toLowerCase().trim();
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalisedEmail,
        source,
        user_agent: ua,
        ip_address: ip === 'unknown' ? null : ip,
      });
    if (error && error.code === '23505') {
      // Already subscribed — silently treat as success. We deliberately don't
      // send a second welcome email here so re-submitting the form (e.g. from
      // a different page) doesn't double-mail them.
      return { ok: true, email };
    }
    if (error) {
      log.error('newsletter.insert_failed', { error: error.message });
      return { ok: false, error: 'Something went wrong. Please try again.' };
    }
    // Fresh signup — schedule the welcome email to fire after the response is
    // sent. `after()` (Next 15+ stable) is needed instead of plain `void`
    // because Vercel can terminate the lambda once the action returns, which
    // was killing the post-Resend recordEmailLog write — emails arrived but
    // no email_log row landed, leaving delivered_at unreachable for the
    // webhook handler. `after()` guarantees the work runs to completion
    // without blocking the user-facing response.
    after(() => sendNewsletterWelcomeEmail({ email: normalisedEmail, source }));
    return { ok: true, email };
  } catch (err) {
    log.error('newsletter.unexpected', { error: (err as Error).message });
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
