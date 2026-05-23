'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

export async function saveSettings(formData: FormData): Promise<void> {
  const session = await assertOwner();

  // Deduplicate: last value wins, so checkbox "true" overrides hidden "false".
  // Also drop any key starting with '$' — those are Next.js server-action
  // binding inputs ($ACTION_ID_…, $ACTION_REF_…, etc.) that should never
  // end up in the site_settings table (audit SEV-2). The DB now also has
  // a CHECK constraint refusing these keys; this is belt-and-braces.
  // `_redirect` is a meta field the sub-page sets so the action returns the
  // owner to the page they submitted from, not always `/admin/settings`.
  const map = new Map<string, string>();
  let redirectTarget = '/admin/settings';
  for (const [key, val] of formData.entries()) {
    if (typeof val !== 'string') continue;
    if (key.startsWith('$')) continue;
    if (key === '_redirect') {
      // Only allow paths under /admin/settings to prevent open-redirect.
      if (val.startsWith('/admin/settings')) redirectTarget = val;
      continue;
    }
    map.set(key, val);
  }

  const pairs = Array.from(map.entries()).map(([key, value]) => ({ key, value }));

  if (pairs.length) {
    // site_settings RLS allows public SELECT only; writes must go through
    // the service-role client (this action is owner-gated above).
    const { error } = await supabaseAdmin().from('site_settings').upsert(pairs, { onConflict: 'key' });
    if (error) {
      redirect(`${redirectTarget}?error=${encodeURIComponent(error.message)}`);
    }
  }

  void logAudit(session, {
    action: 'settings.save',
    entity: 'site_settings',
    diff: { keys_updated: pairs.map(p => p.key) },
  });

  revalidatePath('/', 'layout');
  // Explicit page-level revalidation of the homepage too — the sale toggle
  // and other settings drive homepage sections, and the layout-level call
  // alone has been unreliable at refreshing the index render.
  revalidatePath('/', 'page');
  revalidatePath(redirectTarget);
  redirect(`${redirectTarget}?saved=1`);
}
