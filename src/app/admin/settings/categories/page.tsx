export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { Card, Section, SettingsPageHeader, StatusBanner, inp, lbl } from '@/components/admin/settings-controls';
import {
  createTaxon, updateTaxon, deleteTaxon, moveTaxon,
  createCategory, updateCategory, deleteCategory, moveCategory,
} from './actions';

// Categories CMS — operator-managed taxonomy that drives the header
// mega-menu, the shop filter sidebar, the /shop?taxon=… and
// /shop?category=… URL resolution, and the landing-page descriptions.
//
// Two-tier model: Sections (Hair Care, Body Care, …) → Categories
// (Shampoo & Conditioner, Hair Oils & Serums, …). Renaming a category
// propagates to every matching `products.category` row in the same
// action — see actions.ts.
//
// UI principles: each Section is its own card; each Category is a row
// inside that card with a one-line preview + an "Edit" disclosure that
// opens the full form. No raw sort_order numbers — ↑/↓ buttons.

interface TaxonRow {
  id: string; key: string; label: string; tagline: string | null;
  description: string | null; sort_order: number;
}
interface CategoryRow {
  id: string; slug: string; label: string; description: string | null;
  taxon_id: string; sort_order: number; product_count: number;
}

export default async function CategoriesCmsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; edit?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Categories" />;
  }

  const admin = supabaseAdmin();
  const [{ data: taxons }, { data: categories }, { data: counts }, sp] = await Promise.all([
    admin.from('taxons').select('id, key, label, tagline, description, sort_order').order('sort_order'),
    admin.from('categories').select('id, slug, label, description, taxon_id, sort_order').order('sort_order'),
    admin.from('products').select('category'),
    searchParams,
  ]);

  const byLabel: Record<string, number> = {};
  for (const row of ((counts ?? []) as Array<{ category: string | null }>)) {
    if (row.category) byLabel[row.category] = (byLabel[row.category] ?? 0) + 1;
  }
  const cats: CategoryRow[] = ((categories ?? []) as CategoryRow[]).map(c => ({
    ...c, product_count: byLabel[c.label] ?? 0,
  }));
  const taxonsList = (taxons ?? []) as TaxonRow[];
  const catsByTaxon: Record<string, CategoryRow[]> = {};
  for (const c of cats) (catsByTaxon[c.taxon_id] ??= []).push(c);

  const editingId = sp.edit ?? null;

  return (
    <>
      <SettingsPageHeader
        title="Categories"
        subtitle="The shop's taxonomy. Sections drive the header mega-menu; the categories inside each Section drive the filter sidebar on /shop. Changes here go live within a few seconds."
      />
      <StatusBanner saved={Boolean(sp.ok)} saveError={sp.error} />

      {/* ── Sections (taxons) ────────────────────────────────────────── */}
      <Card>
        <Section
          title="Sections"
          desc="Top-level shop sections. Each becomes a tab in the header mega-menu."
        />
        <div style={cardList}>
          {taxonsList.map((t, i) => {
            const childCount = (catsByTaxon[t.id] ?? []).length;
            const editing = editingId === t.id;
            return (
              <div key={t.id} style={blockCard}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={blockTitle}>{t.label}</h3>
                      <span style={smallChip}>{childCount} categor{childCount === 1 ? 'y' : 'ies'}</span>
                      <span style={mutedTag}>/shop?taxon={t.key}</span>
                    </div>
                    {t.tagline && <div style={blockSubtitle}>{t.tagline}</div>}
                  </div>
                  <div style={ctrlGroup}>
                    <ReorderButtons action={moveTaxon} id={t.id} isFirst={i === 0} isLast={i === taxonsList.length - 1} />
                    <a href={editing ? '?' : `?edit=${t.id}`} style={editLink}>{editing ? 'Cancel' : 'Edit'}</a>
                  </div>
                </div>
                {editing && (
                  <form action={updateTaxon} style={editForm}>
                    <input type="hidden" name="id"         value={t.id} />
                    <input type="hidden" name="sort_order" value={t.sort_order} />
                    <Field name="label"   label="Section name"   defaultValue={t.label}            required placeholder="e.g. Hair Care" />
                    <Field name="key"     label="URL key"        defaultValue={t.key}              required placeholder="e.g. hair" hint="Used in URLs like /shop?taxon=hair — lowercase, letters, digits and hyphens only." />
                    <Field name="tagline" label="Tagline"        defaultValue={t.tagline ?? ''}             placeholder="e.g. Shampoo, oils, curl & styling" />
                    <TextareaField name="description" label="Landing-page description" defaultValue={t.description ?? ''} hint="Shows on the section's shop page and as the meta description for search engines." />
                    <FormActions deleteAction={deleteTaxon} deleteId={t.id} deleteHint={childCount > 0 ? `${childCount} categor${childCount === 1 ? 'y is' : 'ies are'} still in this section — move them out first.` : 'This section is empty — safe to delete.'} deleteDisabled={childCount > 0} />
                  </form>
                )}
              </div>
            );
          })}
          {taxonsList.length === 0 && (
            <div style={emptyHint}>No sections yet. Add the first one below.</div>
          )}
        </div>
        <details style={{ marginTop: 16 }}>
          <summary style={addBtn}>+ Add a section</summary>
          <form action={createTaxon} style={{ ...editForm, marginTop: 12 }}>
            <Field name="label"   label="Section name"   required placeholder="e.g. Makeup" />
            <Field name="key"     label="URL key"        required placeholder="e.g. makeup" hint="Lowercase letters, digits and hyphens." />
            <Field name="tagline" label="Tagline"                 placeholder="e.g. Lipstick, brows, lashes" />
            <input type="hidden" name="sort_order" value={(taxonsList.length + 1) * 10} />
            <button type="submit" style={btnPrimary}>Add section</button>
          </form>
        </details>
      </Card>

      {/* ── Categories grouped by section ───────────────────────────── */}
      {taxonsList.map(t => {
        const myCats = catsByTaxon[t.id] ?? [];
        return (
          <Card key={t.id}>
            <Section
              title={`${t.label} — categories`}
              desc={`Each becomes a filter chip on /shop?taxon=${t.key} and a landing page at /shop?category=…`}
            />
            <div style={cardList}>
              {myCats.map((c, i) => {
                const editing = editingId === c.id;
                return (
                  <div key={c.id} style={blockCard}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <h3 style={blockTitle}>{c.label}</h3>
                          <span style={smallChip}>{c.product_count} product{c.product_count === 1 ? '' : 's'}</span>
                          <span style={mutedTag}>/shop?category={c.slug}</span>
                        </div>
                      </div>
                      <div style={ctrlGroup}>
                        <ReorderButtons action={moveCategory} id={c.id} isFirst={i === 0} isLast={i === myCats.length - 1} />
                        <a href={editing ? '?' : `?edit=${c.id}`} style={editLink}>{editing ? 'Cancel' : 'Edit'}</a>
                      </div>
                    </div>
                    {editing && (
                      <form action={updateCategory} style={editForm}>
                        <input type="hidden" name="id"         value={c.id} />
                        <input type="hidden" name="sort_order" value={c.sort_order} />
                        <Field name="label" label="Category name" defaultValue={c.label} required placeholder="e.g. Shampoo & Conditioner" hint={c.product_count > 0 ? `Renaming will also update ${c.product_count} product${c.product_count === 1 ? '' : 's'} currently in this category.` : undefined} />
                        <Field name="slug"  label="URL slug" defaultValue={c.slug} placeholder="Auto-generated if blank" hint="Used in /shop?category=… URLs. Leave blank to auto-generate from the category name." />
                        <SelectField name="taxon_id" label="Section" defaultValue={c.taxon_id} options={taxonsList.map(tx => ({ value: tx.id, label: tx.label }))} hint="Which header section this category lives under." />
                        <TextareaField name="description" label="Landing-page description" defaultValue={c.description ?? ''} hint="Shows on the category's shop page and as the meta description." />
                        <FormActions deleteAction={deleteCategory} deleteId={c.id} deleteHint={c.product_count > 0 ? `${c.product_count} product${c.product_count === 1 ? ' is' : 's are'} in this category — reassign them first.` : 'This category has no products — safe to delete.'} deleteDisabled={c.product_count > 0} />
                      </form>
                    )}
                  </div>
                );
              })}
              {myCats.length === 0 && (
                <div style={emptyHint}>No categories yet in this section — add one below.</div>
              )}
            </div>
            <details style={{ marginTop: 16 }}>
              <summary style={addBtn}>+ Add a category to {t.label}</summary>
              <form action={createCategory} style={{ ...editForm, marginTop: 12 }}>
                <input type="hidden" name="taxon_id"   value={t.id} />
                <input type="hidden" name="sort_order" value={(myCats.length + 1) * 10} />
                <Field name="label" label="Category name" required placeholder="e.g. Lip Care" />
                <Field name="slug"  label="URL slug" placeholder="Auto-generated if blank" hint="Leave blank to auto-generate from the name." />
                <button type="submit" style={btnPrimary}>Add category</button>
              </form>
            </details>
          </Card>
        );
      })}
    </>
  );
}

// ── Reusable field helpers ──────────────────────────────────────────────

function Field({ name, label, defaultValue, required, placeholder, hint }: {
  name: string; label: string; defaultValue?: string; required?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <div style={fieldGroup}>
      <label style={lbl}>{label}{required && ' *'}</label>
      <input name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} style={{ ...inp, width: '100%' }} />
      {hint && <p style={fieldHint}>{hint}</p>}
    </div>
  );
}

function TextareaField({ name, label, defaultValue, hint }: {
  name: string; label: string; defaultValue?: string; hint?: string;
}) {
  return (
    <div style={fieldGroup}>
      <label style={lbl}>{label}</label>
      <textarea name={name} defaultValue={defaultValue} rows={3} style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
      {hint && <p style={fieldHint}>{hint}</p>}
    </div>
  );
}

function SelectField({ name, label, defaultValue, options, hint }: {
  name: string; label: string; defaultValue?: string; options: Array<{ value: string; label: string }>; hint?: string;
}) {
  return (
    <div style={fieldGroup}>
      <label style={lbl}>{label}</label>
      <select name={name} defaultValue={defaultValue} style={{ ...inp, width: '100%' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p style={fieldHint}>{hint}</p>}
    </div>
  );
}

function ReorderButtons({ action, id, isFirst, isLast }: {
  action: (formData: FormData) => Promise<void>; id: string; isFirst: boolean; isLast: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value="up" />
        <button type="submit" style={iconBtn} disabled={isFirst} aria-label="Move up">↑</button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value="down" />
        <button type="submit" style={iconBtn} disabled={isLast} aria-label="Move down">↓</button>
      </form>
    </div>
  );
}

function FormActions({ deleteAction, deleteId, deleteHint, deleteDisabled }: {
  deleteAction: (formData: FormData) => Promise<void>;
  deleteId: string;
  deleteHint: string;
  deleteDisabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={btnPrimary}>Save changes</button>
        <a href="?" style={btnSecondary}>Cancel</a>
      </div>
      <div style={{ textAlign: 'right' }}>
        <form action={deleteAction} style={{ display: 'inline' }}>
          <input type="hidden" name="id" value={deleteId} />
          <button type="submit" style={{ ...btnDanger, opacity: deleteDisabled ? 0.5 : 1, cursor: deleteDisabled ? 'not-allowed' : 'pointer' }}
            disabled={deleteDisabled}
            onClick={e => { if (!deleteDisabled && !confirm('Delete this? This cannot be undone.')) e.preventDefault(); }}>
            Delete
          </button>
        </form>
        <p style={{ ...fieldHint, textAlign: 'right', marginTop: 4, maxWidth: 240 }}>{deleteHint}</p>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const cardList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 };
const blockCard: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, background: 'white' };
const blockTitle: React.CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' };
const blockSubtitle: React.CSSProperties = { fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 };
const smallChip: React.CSSProperties = { padding: '2px 8px', background: '#f3f4f6', color: '#374151', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 500 };
const mutedTag: React.CSSProperties = { fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace' };
const ctrlGroup: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 };
const iconBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 4, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.875rem', padding: 0 };
const editLink: React.CSSProperties = { padding: '5px 12px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem', textDecoration: 'none', textAlign: 'center', fontWeight: 500 };
const addBtn: React.CSSProperties = { cursor: 'pointer', padding: '10px 14px', borderRadius: 6, background: '#f9fafb', border: '1px dashed #d1d5db', color: '#374151', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-block', listStyle: 'none' };
const editForm: React.CSSProperties = { marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' };
const fieldGroup: React.CSSProperties = { marginBottom: 12 };
const fieldHint: React.CSSProperties = { fontSize: '0.6875rem', color: '#9ca3af', margin: '4px 0 0', lineHeight: 1.4 };
const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: 'var(--brand-pink-cta, #6B2C91)', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '7px 14px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 };
const emptyHint: React.CSSProperties = { padding: 16, background: '#f9fafb', borderRadius: 6, fontSize: '0.8125rem', color: '#6b7280', textAlign: 'center' };
