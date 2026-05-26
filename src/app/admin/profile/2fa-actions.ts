'use server';

import { revalidatePath } from 'next/cache';
import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession, verifyPassword } from '@/lib/staff-auth';
import { generateSecret, otpauthUrl, verifyTotp } from '@/lib/totp';
import { logAudit } from '@/lib/audit';

async function assertSelfStaff() {
  const session = await getStaffSession();
  if (!session || session.isOwner) throw new Error('Owner uses legacy admin password — 2FA not applicable.');
  return session;
}

// Stored as hex SHA-256 so a DB leak can't be replayed. Compared by
// canonicalising the input the same way (lowercase, no whitespace).
function hashBackupCode(plain: string): string {
  return createHash('sha256').update(plain.replace(/\s+/g, '').toLowerCase()).digest('hex');
}

// ─── Begin enrollment: generate a fresh secret, return otpauth:// URL + the secret ─
export async function begin2faEnrollment(): Promise<{
  secret: string;
  url: string;
  error?: string;
}> {
  const session = await assertSelfStaff();
  // Audit fix: refuse to start a fresh enrollment for a user who already
  // has 2FA active — otherwise a stolen session can click "begin
  // enrollment" and silently set totp_enabled=false, knocking 2FA off
  // until the legitimate user confirms a code. Force them to disable
  // first (which requires the password).
  const { data: existing } = await supabaseAdmin()
    .from('staff_members')
    .select('totp_enabled')
    .eq('id', session.id)
    .maybeSingle<{ totp_enabled: boolean | null }>();
  if (existing?.totp_enabled) {
    return { secret: '', url: '', error: '2FA is already enabled. Disable it first to re-enroll.' };
  }
  const secret = generateSecret();
  // Store as a *staged* secret — only commit it once the user verifies a code.
  await supabaseAdmin()
    .from('staff_members')
    .update({ totp_secret: secret, totp_enabled: false })
    .eq('id', session.id);
  return {
    secret,
    url: otpauthUrl({ secret, account: session.email, issuer: 'Aizel Admin' }),
  };
}

export async function confirm2faEnrollment(code: string): Promise<{ error?: string; backupCodes?: string[] }> {
  const session = await assertSelfStaff();
  const { data } = await supabaseAdmin().from('staff_members').select('totp_secret').eq('id', session.id).single();
  const secret = (data?.totp_secret as string | undefined) ?? null;
  if (!secret) return { error: 'No pending enrollment. Start over.' };
  if (!verifyTotp(secret, code)) return { error: 'Code did not match. Try the current 6-digit code.' };

  // Generate 10 plaintext backup codes for the user to write down, but only
  // store their SHA-256 hashes in the DB. The plaintext set is returned once
  // and never recoverable — user must save them now.
  const plaintext = Array.from({ length: 10 }, () => randomBytes(4).toString('hex'));
  const hashed = plaintext.map(hashBackupCode);
  await supabaseAdmin()
    .from('staff_members')
    .update({ totp_enabled: true, backup_codes: hashed })
    .eq('id', session.id);
  await logAudit(session, { action: 'staff.2fa_enable', entity: 'staff', entity_id: session.id });
  revalidatePath('/admin/profile');
  return { backupCodes: plaintext };
}

export async function disable2fa(currentPassword: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertSelfStaff();
  // Audit fix: require the password to disable 2FA. The cookie alone is
  // not enough — an XSS-leaked or shared-workstation session would
  // otherwise be able to strip 2FA in one call. Re-verify against the
  // hash in staff_members.
  if (!currentPassword || typeof currentPassword !== 'string') {
    return { error: 'Enter your current password to confirm.' };
  }
  const { data } = await supabaseAdmin()
    .from('staff_members')
    .select('password_hash, password_salt')
    .eq('id', session.id)
    .maybeSingle<{ password_hash: string; password_salt: string | null }>();
  if (!data) return { error: 'Account not found.' };
  const verified = verifyPassword(currentPassword, data.password_hash, data.password_salt);
  if (!verified.ok) return { error: 'Incorrect password.' };

  await supabaseAdmin()
    .from('staff_members')
    .update({ totp_enabled: false, totp_secret: null, backup_codes: [] })
    .eq('id', session.id);
  await logAudit(session, { action: 'staff.2fa_disable', entity: 'staff', entity_id: session.id });
  revalidatePath('/admin/profile');
  return { success: true };
}
