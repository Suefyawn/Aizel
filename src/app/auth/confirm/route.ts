import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/seo';

// Landing route for the Supabase "Confirm signup" email link. Supabase
// verifies the emailed token, then redirects here with a PKCE `code`. We
// exchange it for a session server-side — which sets the auth cookies — so
// the now-confirmed customer lands in /account already signed in, with no
// client-side session race.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${SITE_URL}/account`);
    }
  }

  // No code, or an expired / already-used link — send them to sign in.
  return NextResponse.redirect(`${SITE_URL}/login`);
}
