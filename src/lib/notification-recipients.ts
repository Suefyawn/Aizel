// Multi-recipient internal notifications.
//
// Resolves the set of email addresses that should receive a given internal
// alert. The notification_recipients table is the source of truth; if no
// recipient subscribes to an event, falls back to OWNER_EMAIL so behaviour
// is unchanged for stores that haven't configured the new UI yet.
//
// All callers must be best-effort — a recipient lookup failure must never
// stall an order placement or block any other commit. On any error we fall
// back to OWNER_EMAIL too — or to an empty list if even OWNER_EMAIL is unset,
// in which case the caller skips the send rather than routing it to a baked-in
// developer address.

import { supabaseAdmin } from './supabase';
import { log } from './logger';

const FALLBACK_EMAIL: string | null = process.env.OWNER_EMAIL?.trim() || null;

export type NotificationEvent = 'order.new' | 'inventory.low';

export const NOTIFICATION_EVENTS: { key: NotificationEvent; label: string; desc: string }[] = [
  {
    key: 'order.new',
    label: 'New orders',
    desc: 'Every time a customer places an order. One email per order.',
  },
  {
    key: 'inventory.low',
    label: 'Low stock',
    desc: 'Daily digest when any product drops below 5 units in stock.',
  },
];

export interface NotificationRecipient {
  id: string;
  email: string;
  events: NotificationEvent[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Return the email addresses that should receive a given event.
 *  Falls back to OWNER_EMAIL when no recipient is configured or on a lookup
 *  error. Returns an empty list when OWNER_EMAIL is also unset — callers
 *  must treat that as "skip the send" rather than routing internal alerts
 *  anywhere unintended. */
export async function getRecipientsForEvent(event: NotificationEvent): Promise<string[]> {
  const fallback = FALLBACK_EMAIL ? [FALLBACK_EMAIL] : [];
  try {
    const { data, error } = await supabaseAdmin()
      .from('notification_recipients')
      .select('email')
      .eq('enabled', true)
      .contains('events', [event]);
    if (error) throw error;
    const recipients = (data ?? []).map((r: { email: string }) => r.email);
    if (recipients.length > 0) return recipients;
    if (fallback.length === 0) {
      log.warn('notification.recipients.no_fallback', { event });
    }
    return fallback;
  } catch (err) {
    log.warn('notification.recipients.lookup_failed', {
      event,
      err: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

/** List every recipient (any event, enabled or not). Admin UI only. */
export async function listAllRecipients(): Promise<NotificationRecipient[]> {
  const { data } = await supabaseAdmin()
    .from('notification_recipients')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as NotificationRecipient[];
}

/** Returns the resolved fallback email so the admin UI can show the owner
 *  exactly which address acts as the default when nobody is configured.
 *  Null means OWNER_EMAIL is unset — the admin UI surfaces that as a warning. */
export function fallbackRecipientEmail(): string | null {
  return FALLBACK_EMAIL;
}
