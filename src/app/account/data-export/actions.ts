'use server';

import { createServerSupabase } from '@/lib/supabase-server';
import { assembleCustomerExport, type CustomerExport } from '@/lib/customer-data-export';

// Customer self-serve Article-15 export.
//
// Authenticates via @supabase/ssr (the cookie-bound session the storefront
// already uses everywhere else). Returns the SAME JSON shape the admin
// /admin/users/[id] export produces so the data subject's file is
// consistent regardless of who triggered it.
//
// Rate-limit consideration: an authenticated user generating their own
// export is bounded by the cost of one round-trip per click; we don't
// need a dedicated limiter on top of the global edge gates. If abuse
// shows up later (someone scripting it) the natural place to add a
// throttle is here, keyed by user_id + a sliding window.

export type ExportResult =
  | { ok: true; data: CustomerExport }
  | { ok: false; error: string };

export async function exportMyData(): Promise<ExportResult> {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Not signed in' };
  }
  try {
    const payload = await assembleCustomerExport(
      user.id,
      'self-serve by data subject',
    );
    return { ok: true, data: payload };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not build export';
    return { ok: false, error: msg };
  }
}
