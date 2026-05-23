// Server-action authorization helpers. Use at the top of every `'use server'`
// function that mutates admin-scoped data.
//
// `assertOwner()` — strict owner-only (team, settings, dangerous CMS edits).
// `assertPermission('coupons')` — owner OR holder of the named permission.
//
// Both throw `Error('Unauthorized')` which Next.js surfaces as a 403-ish
// runtime error and Sentry captures via the global error handler.
//
// Both return the StaffSession on success so callers can pass it to
// `logAudit(session, ...)` without a second `getStaffSession()` call.

import { getStaffSession } from './staff-auth';
import { can, type Permission, type StaffSession } from './permissions';

export async function assertOwner(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

export async function assertPermission(perm: Permission): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new Error('Unauthorized');
  if (session.isOwner) return session;
  if (!can(session, perm)) throw new Error('Unauthorized');
  return session;
}
