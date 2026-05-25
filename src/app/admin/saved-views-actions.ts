'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';

// Per-staff saved filter views. v1 backs only /admin/orders but the
// `surface` column means we can add /admin/products / /admin/users
// without a new migration.
//
// Reads are owner-scoped (each staffer only sees their own views).
// Writes are owner-scoped too — no "edit someone else's view" path.
// Any staff session can save a view; we don't require a separate
// permission for it because they can't see surfaces they don't already
// have permission for.

const Surface = z.enum(['orders', 'products', 'customers']);
type SurfaceKind = z.infer<typeof Surface>;

const NameSchema  = z.string().trim().min(1).max(40);
const QuerySchema = z.string().max(1000);

export interface SavedView {
  id:    string;
  name:  string;
  query: string;
  created_at: string;
}

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

export async function listSavedViews(surfaceInput: string): Promise<SavedView[]> {
  const surfaceParsed = Surface.safeParse(surfaceInput);
  if (!surfaceParsed.success) return [];
  const session = await requireStaff();
  const { data } = await supabaseAdmin()
    .from('admin_saved_views')
    .select('id, name, query, created_at')
    .eq('user_id', session.id)
    .eq('surface', surfaceParsed.data)
    .order('created_at', { ascending: false });
  return (data ?? []) as SavedView[];
}

export async function saveView(input: {
  surface: SurfaceKind;
  name: string;
  query: string;
}): Promise<{ ok: true; view: SavedView } | { ok: false; error: string }> {
  const surfaceParsed = Surface.safeParse(input.surface);
  if (!surfaceParsed.success) return { ok: false, error: 'Unknown surface' };
  const nameParsed  = NameSchema.safeParse(input.name);
  if (!nameParsed.success)  return { ok: false, error: 'Name must be 1–40 chars' };
  const queryParsed = QuerySchema.safeParse(input.query);
  if (!queryParsed.success) return { ok: false, error: 'Query string too long' };

  const session = await requireStaff();
  const admin = supabaseAdmin();
  // Upsert on the unique (user_id, surface, lower(name)) index so the
  // operator can overwrite an existing view by typing the same name.
  const { data, error } = await admin
    .from('admin_saved_views')
    .upsert(
      {
        user_id: session.id,
        surface: surfaceParsed.data,
        name:    nameParsed.data,
        query:   queryParsed.data,
      },
      { onConflict: 'user_id,surface,name' },
    )
    .select('id, name, query, created_at')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(surfaceToPath(surfaceParsed.data));
  return { ok: true, view: data as SavedView };
}

export async function deleteView(id: string, surfaceInput: string): Promise<{ ok: boolean; error?: string }> {
  const surfaceParsed = Surface.safeParse(surfaceInput);
  if (!surfaceParsed.success) return { ok: false, error: 'Unknown surface' };
  const session = await requireStaff();
  // The user_id filter is the auth boundary — a staffer can only delete
  // their own views regardless of which id they post.
  const { error } = await supabaseAdmin()
    .from('admin_saved_views')
    .delete()
    .eq('id', id)
    .eq('user_id', session.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(surfaceToPath(surfaceParsed.data));
  return { ok: true };
}

// `customers` is the data concept; the page lives at /admin/users for
// historical reasons. The other surfaces match their routes 1:1.
function surfaceToPath(surface: SurfaceKind): string {
  if (surface === 'customers') return '/admin/users';
  return `/admin/${surface}`;
}
