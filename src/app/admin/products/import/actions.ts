'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { productInputSchema } from '@/lib/validators';

type CsvRow = Record<string, string>;

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Best-effort CSV row parser. */
function parseCsv(text: string): CsvRow[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        cur.push(field); lines.push(cur); cur = []; field = '';
      } else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); lines.push(cur); }
  if (lines.length < 2) return [];
  const header = lines[0].map(h => h.trim());
  return lines.slice(1).filter(r => r.some(c => c.trim() !== '')).map(r => {
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = (r[j] ?? '').trim();
    return obj;
  });
}

function normaliseRow(r: CsvRow): Record<string, unknown> | null {
  const brand   = r.brand || r.Brand || r['Brand Name'];
  const name    = r.name  || r.Name  || r['Product Name'];
  const price   = Number(r.price ?? r.Price ?? r['Sale price'] ?? r['Regular price']);
  const slug    = r.slug || r.Slug || toSlug(`${brand ?? ''} ${name ?? ''}`);
  const category = r.category || r.Category || r.Categories || 'Uncategorized';

  if (!brand || !name || !isFinite(price)) return null;

  return {
    brand: brand.trim(),
    name: name.trim(),
    slug,
    category: category.trim().split(',')[0].trim(),
    subcategory: r.subcategory || null,
    tag: r.tag || null,
    price,
    original_price: r.original_price ? Number(r.original_price) : null,
    stock: r.stock ? Number(r.stock) : 0,
    image_url: r.image_url || r['Images']?.split(',')[0]?.trim() || null,
    description: r.description || r.Description || null,
    short_description: r.short_description || r['Short description'] || null,
    how_to_use: r.how_to_use || null,
    ingredients: r.ingredients || null,
    kind: r.kind ?? 'simple',
  };
}

export interface ImportResult {
  parsed: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export async function importProductsFromCsv(csvText: string): Promise<ImportResult> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    return { parsed: 0, imported: 0, skipped: 0, errors: ['Unauthorized'] };
  }

  const rows = parseCsv(csvText);
  const errors: string[] = [];
  const valid: Record<string, unknown>[] = [];

  for (const [i, r] of rows.entries()) {
    const norm = normaliseRow(r);
    if (!norm) { errors.push(`row ${i + 2}: missing brand/name/price`); continue; }
    const parsed = productInputSchema.safeParse(norm);
    if (!parsed.success) {
      errors.push(`row ${i + 2}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }
    valid.push(parsed.data as Record<string, unknown>);
  }

  let imported = 0;
  for (let i = 0; i < valid.length; i += 50) {
    const batch = valid.slice(i, i + 50);
    // supabaseAdmin() — products write RLS blocks anon, and CSV import is
    // a staff-gated server action (assertPermission is enforced above), so
    // the service-role client is correct here.
    const { error } = await supabaseAdmin().from('products').upsert(batch, { onConflict: 'slug' });
    if (error) {
      errors.push(`batch ${Math.floor(i / 50)}: ${error.message}`);
    } else {
      imported += batch.length;
    }
  }

  await logAudit(session, {
    action: 'product.bulk_csv_import',
    entity: 'product',
    diff: { parsed: rows.length, imported, skipped: rows.length - valid.length, errorCount: errors.length },
  });

  revalidatePath('/admin/products');
  return { parsed: rows.length, imported, skipped: rows.length - valid.length, errors: errors.slice(0, 20) };
}
