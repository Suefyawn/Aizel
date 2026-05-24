// ============================================================================
// Transactional email via Resend. Phase 1.4.
//
// Every send is best-effort and never throws — email failure must not break
// an order placement or any other commit. Add new templates by exporting a
// `send<Thing>Email` function; keep the HTML inline (no JSX runtime cost on
// server actions).
//
// Required env:
//   RESEND_API_KEY   — server-only
//   OWNER_EMAIL      — where internal notifications go (new orders, low stock)
//   EMAIL_FROM       — verified Resend "from" address (default: orders@aizel.co.uk)
// ============================================================================

import { Resend } from 'resend';
import * as Sentry from '@sentry/nextjs';
import { log } from './logger';
import { brandPlusName } from './product-display';
import { supabaseAdmin } from './supabase';
import { SITE_URL } from './seo';
import { getRecipientsForEvent } from './notification-recipients';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// OWNER_EMAIL stays as the fallback recipient and as a reply-to address on
// outgoing customer mail. Active fan-out for new-order + low-stock alerts
// now goes through notification_recipients; this env var only kicks in when
// nobody is configured (or the lookup fails).
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'sooviaan@gmail.com';
const FROM = process.env.EMAIL_FROM ?? 'Aizel Orders <orders@aizel.co.uk>';
// SITE_URL is shared with the SEO helpers (lib/seo) so the logo image and
// every link in an email resolve to the same live origin. A broken logo in
// the inbox was the old local fallback pointing at the legacy WP domain.
// Resend free tier is 100 emails/day. Batch/marketing mail stops claiming
// slots at this cap so transactional order emails keep their headroom.
export const RESEND_DAILY_BATCH_CAP = 90;
// Hard ceiling on a single Resend API call — keeps a stalled request from
// hanging the caller (e.g. the newsletter send loop) forever.
const SEND_TIMEOUT_MS = 12000;
// Hard ceiling on the best-effort Supabase calls in the send path (the
// quota-claim RPC and the email_log insert). Without it, a stalled DB call
// could hang an email send — and a newsletter blast — indefinitely, which
// is exactly the admin-UI freeze the post-launch QA flagged.
const DB_TIMEOUT_MS = 8000;
// Aizel brand palette tokens used across the email templates. Names match
// the storefront CSS-var convention (--brand-pink === purple, --brand-yellow
// === gold) so a developer touching one surface intuits the other.
const BRAND_PINK = '#6B2C91';     // purple — primary accent / CTAs
const BRAND_YELLOW = '#D4A437';   // gold — top-edge stripe
const PAPER = '#FFFFFF';
const INK = '#111827';
const INK_700 = '#374151';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

// Logo URL — Resend lets us link to any public image. Using the same flower
// mark that the live site uses as its favicon so the email feels on-brand
// from the inbox preview onward.
const LOGO_URL = `${SITE_URL}/icon-192.png`;

// ─── Primitives ─────────────────────────────────────────────────────────────
// Race a promise against a timeout so a stalled call can't block the caller
// forever. Used for the best-effort Supabase calls in the send path.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

function money(n: number): string {
  // Always 2 decimal places + UK thousands grouping. The previous
  // `.toLocaleString()` defaulted to the runtime's locale (US in most CI)
  // and dropped trailing zeros so £12.5 / £1,200 / £12.50 / £1,200.00
  // could appear inconsistently on the same email — the receipt looked
  // unprofessional and reconciliation against Stripe broke.
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Build the unsubscribe link for a given recipient. Marketing emails (the
// newsletter sender) MUST pass the recipient's email; transactional emails
// (order confirmation, etc.) should NOT — they're not opt-in.
function unsubscribeFooter(recipient?: string): string {
  if (!recipient) return '';
  // Import lazily inside the function to avoid a top-level dep that would
  // force email.ts into the edge bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { unsubscribeUrl } = require('./unsubscribe-token') as typeof import('./unsubscribe-token');
  const url = unsubscribeUrl(SITE_URL, recipient);
  return `
    <br/>
    <a href="${url}" style="color:${MUTED}">Unsubscribe</a>
    ·
    <a href="${SITE_URL}/privacy" style="color:${MUTED}">Privacy</a>`;
}

interface ShellOpts {
  /** Marketing-mail recipient — adds the unsubscribe link to the footer.
   *  Leave undefined for transactional mail (order confirmations etc.). */
  marketingRecipient?: string;
}

function shell(inner: string, opts: ShellOpts = {}): string {
  return `
<div style="background:${PAPER};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;color:${INK};background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${LINE}">
    <!-- Branded header: cream band with the live-site flower mark + wordmark.
         The yellow stripe along the top is a subtle nod to the brand palette
         that survives even when an email client strips background images. -->
    <div style="height:4px;background:${BRAND_YELLOW}"></div>
    <div style="padding:20px 28px;background:${PAPER};display:flex;align-items:center;gap:12px;border-bottom:1px solid ${LINE}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:12px">
          <img src="${LOGO_URL}" width="36" height="36" alt="" style="display:block;border:0" />
        </td>
        <td style="vertical-align:middle">
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:${INK};letter-spacing:-0.3px">Aizel</span>
        </td>
      </tr></table>
    </div>
    <div style="padding:28px;line-height:1.55;font-size:15px;color:${INK_700}">${inner}</div>
    <div style="padding:18px 28px 22px;border-top:1px solid ${LINE};color:${MUTED};font-size:12px;line-height:1.6">
      <strong style="color:${INK}">Aizel</strong> · Authentic hair &amp; body care delivered across the UK<br/>
      <a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline">${SITE_URL.replace(/^https?:\/\//, '')}</a> ·
      <a href="${SITE_URL}/track" style="color:${MUTED};text-decoration:underline">Track an order</a> ·
      <a href="${SITE_URL}/page/contact" style="color:${MUTED};text-decoration:underline">Contact us</a>${unsubscribeFooter(opts.marketingRecipient)}
    </div>
  </div>
</div>`.trim();
}

// The Resend SDK's `emails.send` returns `{ data, error }` and only throws on
// transport/network failures. Validation errors — including the "domain not
// verified" / "invalid from address" failure modes — arrive on `result.error`
// and were silently swallowed by the old try/catch. We now surface every
// failure to Sentry with stable tags so the alert rule for
// `tags[resend_domain_unverified]:true` can fire before customers report
// missing order emails.
export function fromDomain(from: string): string {
  const angled = from.match(/<[^@]+@([^>]+)>/);
  if (angled) return angled[1];
  const bare = from.match(/@([^\s]+)/);
  return bare ? bare[1] : 'unknown';
}

// Append a row to email_log for every send attempt. Best-effort — a logging
// failure must never break (or slow to the point of failing) an email send.
// `resend_id` ties the row to later Resend webhook events (delivered/opened).
async function recordEmailLog(
  opts: { to: string | string[]; subject: string; kind?: 'transactional' | 'batch' },
  status: 'sent' | 'failed' | 'skipped',
  extra: { resendId?: string | null; error?: string } = {},
): Promise<void> {
  try {
    await withTimeout(
      supabaseAdmin().from('email_log').insert({
        recipient: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
        subject: opts.subject,
        kind: opts.kind ?? 'transactional',
        status,
        resend_id: extra.resendId ?? null,
        error: extra.error ? extra.error.slice(0, 500) : null,
      }),
      DB_TIMEOUT_MS,
      'email_log insert',
    );
  } catch {
    /* logging is best-effort */
  }
}

async function send(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** 'batch' mail (cron digests, marketing) yields once the daily Resend
   *  free-tier budget is nearly spent. Defaults to 'transactional', which
   *  always sends — order confirmations must never be dropped. */
  kind?: 'transactional' | 'batch';
}): Promise<boolean> {
  if (!resend) {
    log.warn('email.skip', { reason: 'RESEND_API_KEY not set', to: opts.to, subject: opts.subject });
    await recordEmailLog(opts, 'skipped', { error: 'RESEND_API_KEY not set' });
    return false;
  }
  // Free-tier guard: claim a slot in today's send budget. Fails open — a
  // quota-check error must never block an email from going out.
  try {
    const { data: allowed } = await withTimeout(
      supabaseAdmin().rpc('claim_email_send' as never, {
        p_kind: opts.kind ?? 'transactional',
        p_cap: RESEND_DAILY_BATCH_CAP,
      } as never),
      DB_TIMEOUT_MS,
      'claim_email_send',
    );
    if (allowed === false) {
      log.warn('email.skipped_quota', { to: opts.to, subject: opts.subject });
      await recordEmailLog(opts, 'skipped', { error: 'Daily send cap reached' });
      return false;
    }
  } catch {
    /* fail open */
  }
  try {
    // Cap the Resend call so a hung network request can't stall the caller
    // indefinitely (a newsletter blast would otherwise freeze the admin UI).
    const sendCall = resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    // If the timeout wins the race, the original call still settles later —
    // swallow a late rejection so it isn't flagged as unhandled.
    sendCall.catch(() => {});
    const result = await Promise.race([
      sendCall,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Resend send timed out')), SEND_TIMEOUT_MS),
      ),
    ]);
    if (result.error) {
      const errName = result.error.name;
      const errMsg = result.error.message ?? '';
      // The Resend API uses several distinct error names for the
      // "from-domain isn't verified" condition; collapse them into a single
      // tag so the alert filter stays simple.
      const domainUnverified =
        errName === 'invalid_from_address' ||
        /not\s+verified|unverified|domain/i.test(errMsg);
      log.error('email.send_failed', {
        to: opts.to, subject: opts.subject, errName, errMsg,
        statusCode: result.error.statusCode,
      });
      Sentry.captureMessage(`Resend ${errName}: ${errMsg}`, {
        level: 'error',
        tags: {
          email_send_failed: 'true',
          resend_error_name: errName,
          resend_domain_unverified: domainUnverified ? 'true' : 'false',
          from_domain: fromDomain(FROM),
        },
        extra: { to: opts.to, subject: opts.subject, statusCode: result.error.statusCode },
      });
      await recordEmailLog(opts, 'failed', { error: `${errName}: ${errMsg}` });
      return false;
    }
    log.info('email.sent', { to: opts.to, subject: opts.subject, id: result.data?.id });
    await recordEmailLog(opts, 'sent', { resendId: result.data?.id });
    return true;
  } catch (err) {
    log.error('email.send_failed', { to: opts.to, subject: opts.subject, err });
    Sentry.captureException(err, {
      tags: { email_send_failed: 'true', resend_error_name: 'transport_error', from_domain: fromDomain(FROM) },
      extra: { to: opts.to, subject: opts.subject },
    });
    await recordEmailLog(opts, 'failed', { error: (err as Error).message });
    return false;
  }
}

// ─── Templates ──────────────────────────────────────────────────────────────
interface OrderItemLine { name: string; qty: number; price: number; brand?: string; variant?: string }
interface OrderSummary {
  order_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  province?: string;
  total: number;
  items: OrderItemLine[];
  pay_method: string;
}

function renderItemsTable(items: OrderItemLine[]): string {
  return `
<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <thead><tr style="background:#f9fafb;text-align:left">
    <th style="padding:8px;font-size:13px;color:${MUTED}">Item</th>
    <th style="padding:8px;font-size:13px;color:${MUTED};text-align:right">Qty</th>
    <th style="padding:8px;font-size:13px;color:${MUTED};text-align:right">Price</th>
  </tr></thead>
  <tbody>
    ${items.map(i => `
      <tr style="border-top:1px solid #f3f4f6">
        <td style="padding:8px;font-size:14px">${escapeHtml((i.brand ? i.brand + ' ' : '') + i.name)}${i.variant ? ` <span style="color:${MUTED}">· ${escapeHtml(i.variant)}</span>` : ''}</td>
        <td style="padding:8px;font-size:14px;text-align:right">${i.qty}</td>
        <td style="padding:8px;font-size:14px;text-align:right">${money(i.price * i.qty)}</td>
      </tr>`).join('')}
  </tbody>
</table>`;
}

// ─── 1. Internal: new order (for the merchant) ──────────────────────────────
export async function sendNewOrderEmail(order: OrderSummary): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">New order — ${escapeHtml(order.order_number)}</h2>
    <p style="margin:0 0 4px"><strong>Customer:</strong> ${escapeHtml(order.first_name)} ${escapeHtml(order.last_name)}</p>
    <p style="margin:0 0 4px"><strong>Phone:</strong> ${escapeHtml(order.phone)}</p>
    <p style="margin:0 0 4px"><strong>City:</strong> ${escapeHtml(order.city)}${order.province ? `, ${escapeHtml(order.province)}` : ''}</p>
    <p style="margin:0 0 12px"><strong>Payment:</strong> ${escapeHtml(order.pay_method.toUpperCase())}</p>
    ${renderItemsTable(order.items)}
    <p style="margin:16px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(order.total)}</strong></p>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/orders" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ Open in admin</a></p>
  `);
  const recipients = await getRecipientsForEvent('order.new');
  await send({
    to: recipients,
    subject: `New order ${order.order_number} — ${money(order.total)}`,
    html,
  });
}

// ─── 2. Customer: order confirmation ────────────────────────────────────────
export async function sendOrderConfirmationEmail(args: OrderSummary & { email: string }): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Thanks for your order, ${escapeHtml(args.first_name)}!</h2>
    <p style="margin:0 0 16px;color:${INK};line-height:1.5">
      We've received your order <strong>${escapeHtml(args.order_number)}</strong> and will start preparing it shortly.
      You'll get an email when it ships.
    </p>
    ${renderItemsTable(args.items)}
    <p style="margin:8px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(args.total)}</strong></p>
    <p style="margin:20px 0 0">
      <a href="${SITE_URL}/track" style="display:inline-block;padding:10px 18px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Track your order</a>
    </p>
  `);
  await send({
    to: args.email,
    subject: `Order ${args.order_number} confirmed — Aizel`,
    html,
  });
}

// ─── 3. Customer: payment received (for card / bank transfer flows) ──────
export async function sendPaymentReceivedEmail(args: { email: string; first_name: string; order_number: string; total: number; method: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Payment received</h2>
    <p>Hi ${escapeHtml(args.first_name)} — we've received your ${escapeHtml(args.method)} payment of <strong>${money(args.total)}</strong> for order <strong>${escapeHtml(args.order_number)}</strong>.</p>
    <p>We're now preparing your order for shipment.</p>
  `);
  await send({ to: args.email, subject: `Payment received — ${args.order_number}`, html });
}

// ─── 4. Customer: shipped ────────────────────────────────────────────────────
export async function sendShippedEmail(args: { email: string; first_name: string; order_number: string; tracking_number?: string; courier?: string }) {
  const trackInfo = args.tracking_number
    ? `<p>Your tracking number: <strong style="font-family:monospace">${escapeHtml(args.tracking_number)}</strong>${args.courier ? ` (${escapeHtml(args.courier)})` : ''}</p>`
    : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Your order is on its way 🚚</h2>
    <p>Hi ${escapeHtml(args.first_name)} — your order <strong>${escapeHtml(args.order_number)}</strong> just shipped.</p>
    ${trackInfo}
    <p style="margin:20px 0 0">
      <a href="${SITE_URL}/track" style="display:inline-block;padding:10px 18px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Track shipment</a>
    </p>
  `);
  await send({ to: args.email, subject: `Shipped — ${args.order_number}`, html });
}

// ─── 5. Customer: delivered ─────────────────────────────────────────────────
export async function sendDeliveredEmail(args: { email: string; first_name: string; order_number: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Delivered 🎉</h2>
    <p>Hi ${escapeHtml(args.first_name)} — your order <strong>${escapeHtml(args.order_number)}</strong> has been delivered. We hope you love it!</p>
    <p>Got a minute? <a href="${SITE_URL}/account/orders" style="color:${BRAND_PINK}">Leave a review</a> — it really helps other shoppers.</p>
  `);
  await send({ to: args.email, subject: `Delivered — ${args.order_number}`, html });
}

// ─── 6. Customer: cancelled ─────────────────────────────────────────────────
export async function sendCancelledEmail(args: { email: string; first_name: string; order_number: string; reason?: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Order cancelled</h2>
    <p>Hi ${escapeHtml(args.first_name)} — order <strong>${escapeHtml(args.order_number)}</strong> has been cancelled.</p>
    ${args.reason ? `<p>Reason: ${escapeHtml(args.reason)}</p>` : ''}
    <p>If you didn't request this, reply to this email and we'll look into it.</p>
  `);
  await send({ to: args.email, subject: `Cancelled — ${args.order_number}`, html, replyTo: OWNER_EMAIL });
}

// ─── 7. Customer: welcome (post-signup) ─────────────────────────────────────
export async function sendWelcomeEmail(args: { email: string; first_name?: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Welcome to Aizel${args.first_name ? `, ${escapeHtml(args.first_name)}` : ''}</h2>
    <p>We're glad you're here. Take a look at <a href="${SITE_URL}/shop" style="color:${BRAND_PINK}">what's new</a>, or <a href="${SITE_URL}/blog" style="color:${BRAND_PINK}">read our edit</a> for routines and reviews.</p>
  `, { marketingRecipient: args.email });
  await send({ to: args.email, subject: 'Welcome to Aizel', html, kind: 'batch' });
}

// ─── 8. Staff: temp password ────────────────────────────────────────────────
export async function sendStaffTempPasswordEmail(args: { email: string; name: string; tempPassword: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Your Aizel admin access</h2>
    <p>Hi ${escapeHtml(args.name)} — your temporary password is:</p>
    <p style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-radius:6px;font-family:monospace;font-size:18px"><strong>${escapeHtml(args.tempPassword)}</strong></p>
    <p>Log in at <a href="${SITE_URL}/admin" style="color:${BRAND_PINK}">${SITE_URL}/admin</a> and change it right away from your profile page.</p>
  `);
  await send({ to: args.email, subject: 'Aizel admin access', html });
}

// ─── 9. Customer: abandoned cart reminder ──────────────────────────────────
export async function sendAbandonedCartEmail(args: {
  email: string;
  first_name?: string;
  items: OrderItemLine[];
  total: number;
  restore_url: string;
  tier: 1 | 2 | 3;
  discount_code?: string;
  discount_pct?: number;
}): Promise<void> {
  const intro = args.tier === 1
    ? `Hi${args.first_name ? ` ${escapeHtml(args.first_name)}` : ''} — you left some things in your cart. They're still here whenever you're ready.`
    : args.tier === 2
    ? `Just a friendly nudge — your cart's still waiting. Tap the button below to pick up where you left off.`
    : `Last chance — your cart's about to expire.${args.discount_code ? ` Use code <strong>${escapeHtml(args.discount_code)}</strong> for ${args.discount_pct ?? 10}% off when you complete your order.` : ''}`;

  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">${args.tier === 3 ? 'Last chance' : 'You left something behind'}</h2>
    <p style="margin:0 0 16px;color:${INK};line-height:1.5">${intro}</p>
    ${renderItemsTable(args.items)}
    <p style="margin:8px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(args.total)}</strong></p>
    <p style="margin:24px 0 0;text-align:center">
      <a href="${args.restore_url}" style="display:inline-block;padding:12px 24px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Resume your cart →</a>
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: args.tier === 3
      ? `Last chance — your cart is about to expire`
      : args.tier === 2
      ? `Still thinking it over? Your cart's waiting`
      : `You left some things in your cart`,
    html,
    kind: 'batch',
  });
}

// ─── 10. Customer: back-in-stock ────────────────────────────────────────────
export async function sendBackInStockEmail(args: {
  email: string;
  product_name: string;
  product_url: string;
  image_url?: string;
}): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">It's back in stock!</h2>
    <p>The product you asked us to watch is now available again:</p>
    <p style="margin:14px 0"><strong>${escapeHtml(args.product_name)}</strong></p>
    ${args.image_url ? `<img src="${escapeHtml(args.image_url)}" alt="${escapeHtml(args.product_name)}" style="max-width:280px;border-radius:8px;border:1px solid #e5e7eb"/>` : ''}
    <p style="margin:24px 0 0">
      <a href="${escapeHtml(args.product_url)}" style="display:inline-block;padding:12px 24px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Shop now →</a>
    </p>
    <p style="margin:16px 0 0;color:${MUTED};font-size:12px">Stock moves fast — finish your order soon if you don't want to miss it.</p>
  `);
  await send({ to: args.email, subject: `Back in stock: ${args.product_name}`, html, kind: 'batch' });
}

// ─── 11.5. Customer: newsletter welcome ─────────────────────────────────────
// Fires immediately after a newsletter signup succeeds. Sets expectations
// (one email a fortnight, what's in it), confirms the email is on file, and
// gives a frictionless way to back out via the unsubscribe footer link.
export async function sendNewsletterWelcomeEmail(args: { email: string; source: string }): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">You're in 💌</h2>
    <p style="margin:0 0 14px">Thanks for joining the Aizel list. Here's what you can expect:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:${INK_700}">
      <li style="margin-bottom:6px"><strong>One email a fortnight</strong> — we never blast.</li>
      <li style="margin-bottom:6px">New drops, restock alerts, and a tightly-edited offer or two.</li>
      <li style="margin-bottom:6px">Hair-care routines and product guides from our editorial team.</li>
    </ul>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px">
      <tr><td style="background:${PAPER};border:1px dashed ${BRAND_PINK};border-radius:10px;padding:20px 24px;text-align:center">
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;letter-spacing:0.08em;text-transform:uppercase">A little welcome gift</p>
        <p style="margin:0 0 4px;color:${INK};font-size:26px;font-weight:700;letter-spacing:0.06em;font-family:'Courier New',monospace">WELCOME10</p>
        <p style="margin:0;color:${INK_700};font-size:13px">10% off your first order over £15. Apply it at checkout.</p>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;color:${INK_700}">
      Curious what we've already written? <a href="${SITE_URL}/blog" style="color:${BRAND_PINK};font-weight:600">Read the edit →</a>
    </p>
    <p style="margin:24px 0 0;text-align:center">
      <a href="${SITE_URL}/shop" style="display:inline-block;padding:12px 28px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;letter-spacing:0.02em">Start shopping</a>
    </p>
    <p style="margin:24px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      You're getting this because <strong>${escapeHtml(args.email)}</strong> just signed up via the
      <strong>${escapeHtml(args.source)}</strong> form. Wasn't you? Use the unsubscribe link below to remove it.
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: 'Welcome to Aizel — your fortnightly edit starts here',
    html,
    kind: 'batch',
  });
}

// ─── 11.5b. Newsletter broadcast (admin-composed campaign) ──────────────────
// Turns the merchant's plain-text newsletter body into branded HTML: blank
// lines split paragraphs, bare URLs become links. One call per recipient so
// the daily-cap guard in send() applies and addresses aren't leaked to each
// other.
function newsletterBodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const linked = escapeHtml(p).replace(
        /(https?:\/\/[^\s<]+)/g,
        url => `<a href="${url}" style="color:${BRAND_PINK};font-weight:600">${url}</a>`,
      );
      return `<p style="margin:0 0 14px;color:${INK_700};line-height:1.6">${linked.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}

export async function sendNewsletterBroadcastEmail(args: {
  email: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  const html = shell(newsletterBodyToHtml(args.body), { marketingRecipient: args.email });
  return send({ to: args.email, subject: args.subject, html, kind: 'batch' });
}

// ─── 11.6. Customer: reorder reminder (Subscribe & Save) ────────────────────
// Fired by the daily cron when a reorder_subscriptions row falls due. Nudges
// the customer to restock a consumable they subscribed to, and carries the
// SUBSCRIBE10 code so the "Save" half of Subscribe & Save is honoured.
export async function sendReorderReminderEmail(args: {
  email: string;
  product_name: string;
  product_url: string;
  image_url?: string;
  interval_days: number;
}): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">Running low?</h2>
    <p style="margin:0 0 14px">It's been about ${args.interval_days} days — time to restock <strong>${escapeHtml(args.product_name)}</strong> before you run out.</p>
    ${args.image_url ? `<p style="margin:0 0 18px"><img src="${escapeHtml(args.image_url)}" alt="${escapeHtml(args.product_name)}" style="max-width:220px;border-radius:10px;border:1px solid #e5e7eb"/></p>` : ''}
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px">
      <tr><td style="background:${PAPER};border:1px dashed ${BRAND_PINK};border-radius:10px;padding:18px 22px;text-align:center">
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;letter-spacing:0.08em;text-transform:uppercase">Your subscriber discount</p>
        <p style="margin:0 0 4px;color:${INK};font-size:24px;font-weight:700;letter-spacing:0.06em;font-family:'Courier New',monospace">SUBSCRIBE10</p>
        <p style="margin:0;color:${INK_700};font-size:13px">10% off this reorder over £15. Apply it at checkout.</p>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${escapeHtml(args.product_url)}" style="display:inline-block;padding:12px 28px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;letter-spacing:0.02em">Reorder now</a>
    </p>
    <p style="margin:24px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      You set up this reminder via Subscribe &amp; Save. Change the schedule or cancel any time from
      <a href="${SITE_URL}/account/subscriptions" style="color:${BRAND_PINK}">your subscriptions</a>.
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: `Time to reorder ${args.product_name}`,
    html,
    kind: 'batch',
  });
}

// ─── 11.7. Customer: post-delivery review request ──────────────────────────
// Fired by the daily cron a few days after an order is delivered. Asks the
// customer to review what they bought, linking each product straight to its
// PDP review form.
export async function sendReviewRequestEmail(args: {
  email: string;
  first_name?: string;
  order_number: string;
  products: { name: string; slug: string; image_url?: string | null }[];
}): Promise<void> {
  if (args.products.length === 0) return;

  const rows = args.products.map(p => `
    <tr>
      <td style="padding:8px 12px 8px 0;width:56px">
        ${p.image_url
          ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" width="56" height="56" style="border-radius:8px;border:1px solid #e5e7eb;object-fit:cover"/>`
          : ''}
      </td>
      <td style="padding:8px 0;font-size:14px;color:${INK}">${escapeHtml(p.name)}</td>
      <td style="padding:8px 0;text-align:right">
        <a href="${SITE_URL}/product/${encodeURIComponent(p.slug)}#reviews"
           style="color:${BRAND_PINK};font-weight:600;font-size:13px;text-decoration:none;white-space:nowrap">Write a review →</a>
      </td>
    </tr>`).join('');

  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">How did it go?</h2>
    <p style="margin:0 0 14px">Hi ${escapeHtml(args.first_name ?? 'there')} — your order <strong>${escapeHtml(args.order_number)}</strong> landed a few days ago, so you've had a chance to try it out.</p>
    <p style="margin:0 0 18px">A quick, honest review helps the next UK shopper pick well — and it only takes a minute.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px">${rows}</table>
    <p style="margin:22px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      Approved reviews earn loyalty points — a small thank-you for sharing.
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: `How was your order ${args.order_number}?`,
    html,
    kind: 'batch',
  });
}

// ─── 11.9. Customer: win-back nudge (background job) ───────────────────────
// Fired by the daily cron when a customer's most recent delivered order
// sits in a 60–90 day "lapsed" window without a follow-up purchase. Aizel's
// category (hair/body consumables) has a natural 6–8 week reorder cycle,
// so 60+ days is the point at which we can credibly say "you'd be running
// low by now" without sounding presumptuous about much-shorter routines.
//
// Voice: warm, low-pressure, brand-led. Carries the WELCOMEBACK15 code so
// the nudge has an actual incentive — pure "we miss you" emails convert
// poorly compared to a small explicit discount.
export async function sendWinBackEmail(args: {
  email: string;
  first_name?: string;
  /** Days since last delivery, rounded down — surfaces in the subject
   *  ("It's been 64 days") so the message feels specific, not boilerplate. */
  days_since: number;
  /** One representative product the customer last bought, shown as the
   *  thumbnail anchor so the email isn't a wall of text. Optional. */
  last_product?: { name: string; slug: string; image_url?: string | null };
}): Promise<void> {
  const greet = args.first_name ? `Hi ${escapeHtml(args.first_name)}, ` : '';
  const productCta = args.last_product
    ? `
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px">
        <tr>
          <td style="width:88px;padding-right:14px">
            ${args.last_product.image_url
              ? `<img src="${escapeHtml(args.last_product.image_url)}" alt="${escapeHtml(args.last_product.name)}" width="88" height="88" style="border-radius:10px;border:1px solid #e5e7eb;object-fit:cover"/>`
              : ''}
          </td>
          <td style="vertical-align:middle">
            <p style="margin:0 0 4px;color:${MUTED};font-size:12px;letter-spacing:0.06em;text-transform:uppercase">Reorder last time&apos;s favourite</p>
            <p style="margin:0;color:${INK};font-size:15px;font-weight:600;line-height:1.35">${escapeHtml(args.last_product.name)}</p>
            <p style="margin:8px 0 0">
              <a href="${SITE_URL}/product/${encodeURIComponent(args.last_product.slug)}"
                 style="color:${BRAND_PINK};font-weight:600;font-size:13px;text-decoration:none">View product →</a>
            </p>
          </td>
        </tr>
      </table>`
    : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">It&apos;s been a minute.</h2>
    <p style="margin:0 0 14px">${greet}your last Aizel order landed about ${args.days_since} days ago — if your routine&apos;s anything like ours, you&apos;ll be down to the dregs by now.</p>
    <p style="margin:0 0 18px">Restock this fortnight and we&apos;ll knock 15% off — our way of saying we miss you.</p>
    ${productCta}
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px">
      <tr><td style="background:${PAPER};border:1px dashed ${BRAND_PINK};border-radius:10px;padding:18px 22px;text-align:center">
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;letter-spacing:0.08em;text-transform:uppercase">Welcome-back discount</p>
        <p style="margin:0 0 4px;color:${INK};font-size:24px;font-weight:700;letter-spacing:0.06em;font-family:'Courier New',monospace">WELCOMEBACK15</p>
        <p style="margin:0;color:${INK_700};font-size:13px">15% off any order over £15. Valid for 14 days.</p>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${SITE_URL}/shop?taxon=hair" style="display:inline-block;padding:12px 28px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;letter-spacing:0.02em">Browse what&apos;s new</a>
    </p>
    <p style="margin:24px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      Not the right time? No worries — we&apos;ll always be a few clicks away when you&apos;re ready.
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: `It&apos;s been ${args.days_since} days — 15% off when you&apos;re ready`,
    html,
    kind: 'batch',
  });
}

// ─── 11. Owner: low-stock alert (background job) ────────────────────────────
export async function sendLowStockAlertEmail(args: { products: { name: string; brand: string; stock: number; slug: string }[] }) {
  if (!args.products.length) return;
  const rows = args.products.map(p =>
    `<tr><td style="padding:6px 8px;font-size:14px">${escapeHtml(brandPlusName(p.brand, p.name))}</td>
         <td style="padding:6px 8px;font-size:14px;text-align:right">${p.stock}</td></tr>`
  ).join('');
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Low stock alert</h2>
    <p>${args.products.length} product${args.products.length === 1 ? '' : 's'} dropped below the 5-unit threshold:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">${rows}</table>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/products" style="color:${BRAND_PINK};font-weight:600">→ Restock now</a></p>
  `);
  const recipients = await getRecipientsForEvent('inventory.low');
  await send({ to: recipients, subject: `Low stock — ${args.products.length} item${args.products.length === 1 ? '' : 's'}`, html, kind: 'batch' });
}
