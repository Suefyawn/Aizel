'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import type { NotificationEvent } from '@/lib/notification-recipients';

const VALID_EVENTS: NotificationEvent[] = ['order.new', 'inventory.low'];
const PATH = '/admin/settings/notifications';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

function err(message: string): never {
  redirect(`${PATH}?error=${encodeURIComponent(message)}`);
}

function ok(): never {
  revalidatePath(PATH);
  redirect(`${PATH}?saved=1`);
}

function parseEmail(formData: FormData): string {
  const raw = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) err('Please enter a valid email address.');
  return raw;
}

function parseEvents(formData: FormData): NotificationEvent[] {
  const picked = formData.getAll('events').map(v => String(v)) as NotificationEvent[];
  const validated = picked.filter(e => VALID_EVENTS.includes(e));
  if (validated.length === 0) err('Pick at least one event for this recipient.');
  return validated;
}

export async function addRecipient(formData: FormData): Promise<void> {
  const session = await assertOwner();
  const email = parseEmail(formData);
  const events = parseEvents(formData);

  // .select('id').single() so the audit row can carry entity_id — without it
  // an audit reader has to grep diff.email to find which recipient was added.
  const { data: created, error } = await supabaseAdmin()
    .from('notification_recipients')
    .insert({ email, events, enabled: true })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation on the email constraint.
    if (error.code === '23505') err(`${email} is already on the list — edit it instead.`);
    err(error.message);
  }

  void logAudit(session, {
    action: 'notification_recipient.create',
    entity: 'notification_recipients',
    entity_id: created?.id ?? null,
    diff: { email, events },
  });
  ok();
}

export async function updateRecipient(id: string, formData: FormData): Promise<void> {
  const session = await assertOwner();
  const events = parseEvents(formData);
  const enabled = formData.get('enabled') === 'true';

  const { error } = await supabaseAdmin()
    .from('notification_recipients')
    .update({ events, enabled })
    .eq('id', id);

  if (error) err(error.message);

  void logAudit(session, {
    action: 'notification_recipient.update',
    entity: 'notification_recipients',
    entity_id: id,
    diff: { events, enabled },
  });
  ok();
}

export async function deleteRecipient(formData: FormData): Promise<void> {
  const session = await assertOwner();
  const id = formData.get('id') as string;
  if (!id) err('Missing recipient id.');

  // .select('email').single() so the audit row records WHICH email was
  // deleted, not just the (now-gone) row id. After delete the row is gone, so
  // the only chance to capture the email is to ask Supabase to return the
  // deleted row in the same statement.
  const { data: deleted, error } = await supabaseAdmin()
    .from('notification_recipients')
    .delete()
    .eq('id', id)
    .select('email')
    .single();

  if (error) err(error.message);

  void logAudit(session, {
    action: 'notification_recipient.delete',
    entity: 'notification_recipients',
    entity_id: id,
    diff: { email: deleted?.email ?? null },
  });
  ok();
}
