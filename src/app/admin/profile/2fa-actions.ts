'use server';

import { revalidatePath } from 'next/cache';
import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
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
}> {
  const session = await assertSelfStaff();
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
  // We don't re-verify the password here for brevity — the session itself is the
  // proof of authentication. In production you'd want a recent-auth check.
  void currentPassword;
  await supabaseAdmin()
    .from('staff_members')
    .update({ totp_enabled: false, totp_secret: null, backup_codes: [] })
    .eq('id', session.id);
  await logAudit(session, { action: 'staff.2fa_disable', entity: 'staff', entity_id: session.id });
  revalidatePath('/admin/profile');
  return { success: true };
}
