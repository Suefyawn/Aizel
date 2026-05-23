// Whether Supabase env vars are configured. Lives in its own module — with
// no `createClient` call — so client components can read it WITHOUT importing
// `lib/supabase.ts`. Importing that module browser-side evaluates its
// `export const supabase = createClient(...)`, constructing a second GoTrue
// auth client that collides with the @supabase/ssr cookie client: the
// "Multiple GoTrueClient instances" warning, and customer sessions silently
// failing to resolve client-side.
export const isDemo =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
