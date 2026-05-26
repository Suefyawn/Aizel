export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import {
  Section, Card, SaveBar, StatusBanner, SettingsPageHeader, inp, lbl,
} from '@/components/admin/settings-controls';
import { createTaxon, updateTaxon, deleteTaxon, createCategory, updateCategory, deleteCategory } from './actions';

// Categories CMS — operator-managed taxonomy that drives:
//   • the header mega-menu  (via layout.tsx → loadTaxonomy → Header)
//   • the shop page filter sidebar (categories within a taxon)
//   • the storefront category landing copy (description column)
//   • the /shop?taxon=… and /shop?category=… URL resolution
//
// Two-tier model: Taxons (Hair Care, Body Care, …) → Categories
// (Shampoo & Conditioner, Hair Oils & Serums, …). Products carry the
// category label as plain text; renames here propagate to every
// matching product row in the same transaction (see actions.ts).

interface TaxonRow {
  id: string; key: string; label: string; tagline: string | null;
  description: string | null; sort_order: number;
}
interface CategoryRow {
  id: string; slug: string; label: string; description: string | null;
  taxon_id: string; sort_order: number;
  /** Number of published products currently in this category. Drives the
   *  badge next to each row + the "can't delete" guard in the action. */
  product_count: number;
}

export default async function CategoriesCmsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Categories" />;
  }

  const admin = supabaseAdmin();
  const [{ data: taxons }, { data: categories }, { data: counts }, sp] = await Promise.all([
    admin.from('taxons').select('id, key, label, tagline, description, sort_order').order('sort_order'),
    admin.from('categories').select('id, slug, label, description, taxon_id, sort_order').order('sort_order'),
    // Per-category product count — single query, no per-row trip.
    admin.from('products').select('category', { count: 'exact' }),
    searchParams,
  ]);

  // Bucket product counts by category label so we can stamp a badge per row.
  const byLabel: Record<string, number> = {};
  for (const row of ((counts ?? []) as Array<{ category: string | null }>)) {
    if (row.category) byLabel[row.category] = (byLabel[row.category] ?? 0) + 1;
  }
  const cats: CategoryRow[] = ((categories ?? []) as CategoryRow[]).map(c => ({
    ...c,
    product_count: byLabel[c.label] ?? 0,
  }));
  const taxonsList = (taxons ?? []) as TaxonRow[];

  // Group categories by parent for rendering.
  const catsByTaxon: Record<string, CategoryRow[]> = {};
  for (const c of cats) {
    (catsByTaxon[c.taxon_id] ??= []).push(c);
  }

  return (
    <>
      <SettingsPageHeader
        title="Categories"
        subtitle="The shop's taxonomy — top-level Sections (header mega-menu) and the Categories under each Section (filter sidebar). Changes here propagate to the storefront within a few seconds."
      />
      <StatusBanner saved={Boolean(sp.ok)} saveError={sp.error} />

      {/* ── Sections (taxons) ────────────────────────────────────────── */}
      <Card>
        <Section
          title="Sections"
          desc="Top-level shop sections. Each one becomes a mega-menu item in the site header and a landing page at /shop?taxon=key."
        />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={th}>Label</th>
                <th style={th}>Key (URL)</th>
                <th style={th}>Tagline</th>
                <th style={{ ...th, width: 70 }}>Order</th>
                <th style={{ ...th, width: 160, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {taxonsList.map(t => {
                const childCount = (catsByTaxon[t.id] ?? []).length;
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td} colSpan={5}>
                      <form action={updateTaxon} style={rowGrid}>
                        <input type="hidden" name="id" value={t.id} />
                        <input name="label"      defaultValue={t.label}              required style={inp} />
                        <input name="key"        defaultValue={t.key}                required style={inp} placeholder="hair" />
                        <input name="tagline"    defaultValue={t.tagline ?? ''}              style={inp} placeholder="Shampoo, oils, curl & styling" />
                        <input name="sort_order" defaultValue={t.sort_order} type="number" min={0} style={{ ...inp, width: 60 }} />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button type="submit" style={btnPrimary}>Save</button>
                        </div>
                      </form>
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.75rem' }}>
                          Description &amp; delete · {childCount} categor{childCount === 1 ? 'y' : 'ies'}
                        </summary>
                        <form action={updateTaxon} style={{ marginTop: 8 }}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="key"        value={t.key} />
                          <input type="hidden" name="label"      value={t.label} />
                          <input type="hidden" name="tagline"    value={t.tagline ?? ''} />
                          <input type="hidden" name="sort_order" value={t.sort_order} />
                          <label style={lbl}>Landing description (shown as meta description and on the taxon landing page)</label>
                          <textarea
                            name="description"
                            defaultValue={t.description ?? ''}
                            rows={3}
                            style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                          />
                          <button type="submit" style={{ ...btnPrimary, marginTop: 6 }}>Save description</button>
                        </form>
                        <form action={deleteTaxon} style={{ marginTop: 12 }}>
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" style={btnDanger}>Delete section</button>
                          <span style={hintRed}>
                            {childCount > 0
                              ? ` (move ${childCount} categor${childCount === 1 ? 'y' : 'ies'} elsewhere first)`
                              : ' (this section has no categories — safe to delete)'}
                          </span>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* New taxon */}
          <form action={createTaxon} style={{ ...rowGrid, marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <input name="label"      placeholder="Section label (e.g. Makeup)"       required style={inp} />
            <input name="key"        placeholder="URL key (e.g. makeup)"             required style={inp} />
            <input name="tagline"    placeholder="Tagline (optional)"                         style={inp} />
            <input name="sort_order" placeholder="Order" defaultValue={(taxonsList.length + 1).toString()} type="number" min={0} style={{ ...inp, width: 60 }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="submit" style={btnPrimary}>Add section</button>
            </div>
          </form>
      </Card>

      {/* ── Categories grouped by taxon ─────────────────────────────── */}
      {taxonsList.map(t => {
        const myCats = catsByTaxon[t.id] ?? [];
        return (
          <Card key={t.id}>
            <Section
              title={`${t.label} — categories`}
              desc={`Categories under "${t.label}". Each becomes a filter chip on the shop sidebar and a landing page at /shop?category=slug.`}
            />
              {myCats.length === 0 && (
                <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 12px' }}>
                  No categories yet — add one below.
                </p>
              )}
              {myCats.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={th}>Label</th>
                      <th style={th}>Slug</th>
                      <th style={{ ...th, width: 100 }}>Section</th>
                      <th style={{ ...th, width: 60 }}>Order</th>
                      <th style={{ ...th, width: 80 }}>Products</th>
                      <th style={{ ...th, width: 180, textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myCats.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={td} colSpan={6}>
                          <form action={updateCategory} style={catRowGrid}>
                            <input type="hidden" name="id" value={c.id} />
                            <input name="label"      defaultValue={c.label}    required style={inp} />
                            <input name="slug"       defaultValue={c.slug}              style={inp} placeholder="auto" />
                            <select name="taxon_id"  defaultValue={c.taxon_id} required style={inp}>
                              {taxonsList.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
                            </select>
                            <input name="sort_order" defaultValue={c.sort_order} type="number" min={0} style={{ ...inp, width: 60 }} />
                            <span style={{ fontSize: '0.75rem', color: c.product_count > 0 ? '#374151' : '#9ca3af', whiteSpace: 'nowrap' }}>
                              {c.product_count}
                            </span>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button type="submit" style={btnPrimary}>Save</button>
                            </div>
                          </form>
                          <details style={{ marginTop: 6 }}>
                            <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.75rem' }}>
                              Description &amp; delete
                            </summary>
                            <form action={updateCategory} style={{ marginTop: 8 }}>
                              <input type="hidden" name="id"         value={c.id} />
                              <input type="hidden" name="label"      value={c.label} />
                              <input type="hidden" name="slug"       value={c.slug} />
                              <input type="hidden" name="taxon_id"   value={c.taxon_id} />
                              <input type="hidden" name="sort_order" value={c.sort_order} />
                              <label style={lbl}>Landing description (meta + landing-page intro)</label>
                              <textarea
                                name="description"
                                defaultValue={c.description ?? ''}
                                rows={3}
                                style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                              />
                              <button type="submit" style={{ ...btnPrimary, marginTop: 6 }}>Save description</button>
                            </form>
                            <form action={deleteCategory} style={{ marginTop: 12 }}>
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" style={btnDanger}>Delete category</button>
                              <span style={hintRed}>
                                {c.product_count > 0
                                  ? ` (${c.product_count} products are in this category — reassign first)`
                                  : ' (this category has no products — safe to delete)'}
                              </span>
                            </form>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* New category in this taxon */}
              <form action={createCategory} style={{ ...catRowGrid, marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                <input type="hidden" name="taxon_id" value={t.id} />
                <input name="label"      placeholder="Category label (e.g. Lip Care)" required style={inp} />
                <input name="slug"       placeholder="Slug (auto from label if blank)"        style={inp} />
                <select name="taxon_id"  defaultValue={t.id} required style={inp}>
                  {taxonsList.map(tx => <option key={tx.id} value={tx.id}>{tx.label}</option>)}
                </select>
                <input name="sort_order" placeholder="Order" defaultValue={(myCats.length + 1) * 10} type="number" min={0} style={{ ...inp, width: 60 }} />
                <span></span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button type="submit" style={btnPrimary}>Add category</button>
                </div>
              </form>
          </Card>
        );
      })}

      <SaveBar />
    </>
  );
}

// ── Local styles ────────────────────────────────────────────────────────
// Lightweight table/row styles — the settings-controls module covers
// inputs, labels, banners. We just add the few table-specific tokens here.

const th: React.CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  padding: '8px 10px',
};

const td: React.CSSProperties = {
  padding: '10px',
  verticalAlign: 'top',
};

const rowGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 2fr 80px auto',
  gap: 8,
  alignItems: 'center',
};

const catRowGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1.5fr 1fr 70px 70px auto',
  gap: 8,
  alignItems: 'center',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--brand-pink-cta, #6B2C91)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  padding: '6px 10px',
  background: '#fee2e2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: 6,
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const hintRed: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#dc2626',
  marginLeft: 8,
};
