'use client';

import { useActionState } from 'react';
import { subscribeToNewsletter, type NewsletterState } from '@/app/newsletter/actions';

// Inline newsletter signup — sized + styled to drop into the footer column.
// `source` is propagated to the server action so we can later A/B which
// surface (footer / modal / checkout) actually converts.

interface NewsletterSignupProps {
  source?: 'footer' | 'modal' | 'exit_intent' | 'checkout' | 'post_purchase';
  placeholder?: string;
  ctaLabel?: string;
  /** Dark-on-light or light-on-dark — footer uses dark surface. */
  variant?: 'dark' | 'light';
}

export function NewsletterSignup({
  source = 'footer',
  placeholder = 'your@email.com',
  ctaLabel = 'Join',
  variant = 'dark',
}: NewsletterSignupProps) {
  const [state, formAction, pending] = useActionState<NewsletterState, FormData>(
    subscribeToNewsletter,
    null,
  );

  const success = state && 'ok' in state && state.ok;
  const error = state && 'ok' in state && !state.ok ? state.error : null;

  const isLight = variant === 'light';
  const inputBg   = isLight ? '#fff' : 'rgba(255, 255, 255,0.08)';
  const inputBdr  = isLight ? '1px solid var(--line)' : '1px solid rgba(255, 255, 255,0.15)';
  const inputColor = isLight ? 'var(--ink-900)' : 'var(--paper)';

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          fontSize: '0.8125rem',
          color: isLight ? 'var(--success)' : 'var(--paper)',
          fontFamily: 'var(--font-ui)',
          padding: '12px 14px',
          background: isLight ? '#f0fdf4' : 'rgba(45,106,79,0.18)',
          border: isLight ? '1px solid #bbf7d0' : '1px solid rgba(45,106,79,0.4)',
          borderRadius: 'var(--radius-card)',
          lineHeight: 1.5,
        }}
      >
        Thanks — you&apos;re on the list. Use code{' '}
        <strong style={{ letterSpacing: '0.04em' }}>WELCOME10</strong> for 10% off
        your first order over £30.
      </div>
    );
  }

  return (
    <form action={formAction} aria-label="Newsletter signup" noValidate>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot — display:none + tabIndex=-1 so a real keyboard user
          can't accidentally fill it. Spam bots tend to fill every input. */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      <div style={{ display: 'flex', gap: 0 }}>
        <label htmlFor={`nl-email-${source}`} className="sr-only">Email address</label>
        <input
          id={`nl-email-${source}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `nl-error-${source}` : undefined}
          style={{
            // `min-width: 0` lets the input shrink below the browser's
            // default 20-char content min so the footer column (~200px)
            // doesn't blow out horizontally. Without this, input+button
            // overflow the column and force the marquee to push wider.
            flex: 1, minWidth: 0, padding: '10px 12px',
            background: inputBg, border: inputBdr, borderRight: 'none',
            borderRadius: '3px 0 0 3px', color: inputColor,
            fontSize: '0.8125rem', outline: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        />
        <button
          type="submit"
          disabled={pending}
          // WCAG label-content-name-mismatch: the visible text must appear
          // at the start of the accessible name. Visible text is `ctaLabel`
          // (defaults to "Join"); the aria-label leads with the same word
          // so screen-reader announcement and visual button agree.
          aria-label={`${ctaLabel} the Aizel newsletter`}
          style={{
            padding: '10px 16px', background: 'var(--brand-pink-cta)', border: 'none',
            borderRadius: '0 3px 3px 0', color: '#fff', fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.06em', cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-ui)', textTransform: 'uppercase',
            opacity: pending ? 0.7 : 1,
            transition: 'opacity 150ms',
          }}
        >{pending ? '…' : ctaLabel}</button>
      </div>

      {error && (
        <div
          id={`nl-error-${source}`}
          role="alert"
          style={{
            marginTop: 8, fontSize: '0.75rem',
            color: isLight ? 'var(--error)' : '#fda4af',
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
