'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email';

// Welcome email for new accounts. Signup runs client-side (supabase.auth
// .signUp), so the login form calls this right after a successful signup,
// passing the new user's id from the signUp response.
//
// The id is re-verified here against the auth record via the service role —
// the recipient address is read from that verified row, never from the
// client — and we only send for an account created in the last few minutes.
// That keeps this from being usable to blast arbitrary addresses.
const FRESH_SIGNUP_MS = 10 * 60 * 1000;

export async function sendSignupWelcomeEmail(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId);
    const user = data?.user;
    if (error || !user?.email) return;

    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    if (!createdAt || Date.now() - createdAt > FRESH_SIGNUP_MS) return;

    await sendWelcomeEmail({ email: user.email });
  } catch {
    // Best-effort — a failed welcome email must never affect signup.
  }
}
