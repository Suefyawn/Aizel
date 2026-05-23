import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Auth-aware Supabase client for server actions and server components.
// Reads the customer's session from the cookies set by the @supabase/ssr
// browser client, so RLS on per-user tables (addresses, subscriptions,
// order returns) sees the logged-in user.
//
// Replaces the old hand-rolled authedClient() helpers that manually parsed
// the sb-*-auth-token cookie — that parsing didn't understand @supabase/ssr's
// chunked / base64-prefixed cookie format.
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://demo.invalid';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'demo-anon-key';

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server actions CAN set cookies (session refresh); a Server
        // Component render cannot — the throw there is expected and safe
        // to swallow because the middleware refreshes the session cookie.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* read-only cookie context — ignore */
        }
      },
    },
  });
}
