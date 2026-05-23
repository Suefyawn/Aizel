'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase as authedClient } from '@/lib/supabase-server';
import { addressSchema, parseForm, firstError } from '@/lib/validators';

// authedClient() is the @supabase/ssr server client — it reads the customer's
// session from cookies so RLS on `addresses` (auth.uid() = user_id) applies.

export type AddressActionResult = { error: string } | { success: true } | null;

export async function createAddress(
  _prev: AddressActionResult,
  formData: FormData
): Promise<AddressActionResult> {
  // Normalise the checkbox.
  const normalized = new FormData();
  for (const [k, v] of formData.entries()) normalized.append(k, v);
  normalized.set('is_default', formData.get('is_default') === 'on' ? 'true' : 'false');

  const parsed = parseForm(addressSchema, normalized);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const sb = await authedClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return { error: 'You must be signed in' };

  // If this address is the new default, clear the prior default first.
  if (parsed.data.is_default) {
    await sb.from('addresses').update({ is_default: false }).eq('user_id', user.user.id).eq('is_default', true);
  }

  const { error } = await sb.from('addresses').insert({ ...parsed.data, user_id: user.user.id });
  if (error) return { error: error.message };

  revalidatePath('/account/addresses');
  return { success: true };
}

export async function updateAddress(
  id: string,
  _prev: AddressActionResult,
  formData: FormData
): Promise<AddressActionResult> {
  const normalized = new FormData();
  for (const [k, v] of formData.entries()) normalized.append(k, v);
  normalized.set('is_default', formData.get('is_default') === 'on' ? 'true' : 'false');

  const parsed = parseForm(addressSchema, normalized);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const sb = await authedClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return { error: 'You must be signed in' };

  if (parsed.data.is_default) {
    await sb.from('addresses').update({ is_default: false }).eq('user_id', user.user.id).eq('is_default', true).neq('id', id);
  }

  const { error } = await sb.from('addresses').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/account/addresses');
  return { success: true };
}

// Return type kept as Promise<void> so these can be used directly with
// <form action={…}>. Errors surface through redirect(`?error=…`) which
// the page can read from searchParams.
export async function deleteAddress(formData: FormData): Promise<void> {
  const id = formData.get('id');
  if (typeof id !== 'string') return;
  const sb = await authedClient();
  const { error } = await sb.from('addresses').delete().eq('id', id);
  if (error) {
    redirect(`/account/addresses?error=${encodeURIComponent('Could not delete address: ' + error.message)}`);
  }
  revalidatePath('/account/addresses');
}

// Flip the `is_default` flag on one address. SET the new default FIRST,
// then clear every other default for this user. Worst-case interruption
// now leaves two defaults briefly, never zero (the old reverse order
// could leave the user with no default at all).
export async function setDefaultAddress(formData: FormData): Promise<void> {
  const id = formData.get('id');
  if (typeof id !== 'string') return;
  const sb = await authedClient();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) {
    redirect('/login?next=/account/addresses');
  }

  const { error: setErr } = await sb
    .from('addresses').update({ is_default: true } as never)
    .eq('id', id).eq('user_id', user.user.id);
  if (setErr) {
    redirect(`/account/addresses?error=${encodeURIComponent('Could not set default: ' + setErr.message)}`);
  }
  const { error: clrErr } = await sb
    .from('addresses').update({ is_default: false } as never)
    .eq('user_id', user.user.id).eq('is_default', true).neq('id', id);
  if (clrErr) {
    redirect(`/account/addresses?error=${encodeURIComponent('Default set, but couldn\'t clear previous: ' + clrErr.message)}`);
  }
  revalidatePath('/account/addresses');
}
