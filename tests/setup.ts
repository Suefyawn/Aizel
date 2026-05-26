// Vitest global setup. Add stubs / env hooks here.
//
// STAFF_SESSION_SECRET has a hard floor of 16 chars (see session-secret.ts)
// — anything shorter falls back to the dev fallback, which makes the
// SHA-256 legacy-hash test mis-compute and fail.
process.env.STAFF_SESSION_SECRET ??= 'test-secret-at-least-16-chars-long';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon';
// email.test.ts needs RESEND_API_KEY set so the Resend singleton in
// email.ts constructs — otherwise `send()` short-circuits on the no-key
// warning path and the mocked emails.send never gets called.
process.env.RESEND_API_KEY ??= 'test-resend-key';
// Internal-alert recipient. notification-recipients falls back to OWNER_EMAIL
// when no row is configured (or the lookup throws — true in tests because
// supabaseAdmin() has no DB); without it the recipient list is empty and
// send() short-circuits before reaching the mocked Resend call.
process.env.OWNER_EMAIL ??= 'test-owner@example.com';
