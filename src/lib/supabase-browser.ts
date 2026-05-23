import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Browser-side Supabase client. Uses @supabase/ssr's createBrowserClient so
// the session is stored in COOKIES (not localStorage) — that's what lets the
// middleware and server actions see the logged-in user. A plain createClient
// stored the session only in localStorage, which the server can't read, so
// the whole /account area bounced authenticated users back to /login.

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!client) {
    // Demo-mode fallback so the client doesn't throw on import when env vars
    // are unset (matches the server-side fallback in lib/supabase.ts).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.invalid';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';
    client = createBrowserClient(url, key);
  }
  return client;
}
