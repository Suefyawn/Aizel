export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { Card, Section, SettingsPageHeader, StatusBanner, inp, lbl } from '@/components/admin/settings-controls';
import { CategoryChipPicker } from '@/components/admin/CategoryChipPicker';
import { createBlock, updateBlock, deleteBlock, moveBlock } from './actions';

// Admin Homepage / Featured content — visual card-based editor for the
// EditorialDuo banners and the "Shop by category" tile rows.
//
// One row per block, two render kinds:
//   • banner_card — the big editorial card with title + image + CTA
//   • category_row — a horizontal row of 4-6 tile cards (each linking
//     to a category landing page)
//
// Operator workflow:
//   1. Read the list of blocks (banners + tile rows) as preview cards.
//   2. Click "Edit" to expand the inline edit form for a single block.
//   3. Use ↑ / ↓ arrows to reorder, the toggle to show/hide, the trash
//      to delete. No raw slugs or sort_order numbers in the UI.
//   4. "Add a banner" or "Add a tile row" buttons append a fresh block.
//
// User-friendly principles applied throughout:
//   • Plain-English labels — "Headline", not "title"; "Photo", not "image_url".
//   • Live category chips, not free-text slug input.
//   • No sort_order spinners — up/down buttons.
//   • Each section has a "what does this control?" caption.

interface BlockRow {
  id: string;
  kind: 'banner_card' | 'category_row';
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  cta_href: string | null;
  image_url: string | null;
  category_slugs: string[];
  sort_order: number;
  active: boolean;
}

interface CategoryRow {
  slug: string;
  label: string;
  taxon_label: string;
}

export default async function FeaturedContentPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; edit?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Featured content" />;
  }

  const admin = supabaseAdmin();
  const [blocksResult, catsResult, sp] = await Promise.all([
    admin.from('homepage_content').select('id, kind, title, subtitle, cta_text, cta_href, image_url, category_slugs, sort_order, active').order('kind').order('sort_order'),
    // Categories joined with their parent taxon so the chip picker can
    // group them under section headings (Hair Care / Body Care / ...).
    admin.from('categories').select('slug, label, sort_order, taxons(label)').order('sort_order'),
    searchParams,
  ]);
  const blocks = (blocksResult.data ?? []) as BlockRow[];
  type RawCatRow = { slug: string; label: string; sort_order: number; taxons: { label: string } | { label: string }[] | null };
  const categories: CategoryRow[] = ((catsResult.data ?? []) as RawCatRow[]).map(c => {
    const t = Array.isArray(c.taxons) ? c.taxons[0] : c.taxons;
    return { slug: c.slug, label: c.label, taxon_label: t?.label ?? 'Other' };
  });

  const banners   = blocks.filter(b => b.kind === 'banner_card');
  const tileRows  = blocks.filter(b => b.kind === 'category_row');
  const editingId = sp.edit ?? null;

  return (
    <>
      <SettingsPageHeader
        title="Homepage content"
        subtitle="The two big banner cards below the hero, and the rows of small category tiles further down. Changes here go live on the homepage within a few seconds."
      />
      <StatusBanner saved={Boolean(sp.ok)} saveError={sp.error} />

      {/* ── Banner cards ───────────────────────────────────────────── */}
      <Card>
        <Section
          title="Banner cards"
          desc="Big editorial cards sitting under the hero. Up to two are shown side-by-side."
        />
        <div style={cardList}>
          {banners.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              categories={categories}
              kind="banner_card"
              isFirst={i === 0}
              isLast={i === banners.length - 1}
              editing={editingId === b.id}
            />
          ))}
          {banners.length === 0 && <EmptyHint kind="banner_card" />}
        </div>
        <details style={{ marginTop: 16 }}>
          <summary style={addBtn}>+ Add a banner card</summary>
          <NewBlockForm kind="banner_card" categories={categories} suggestedOrder={(banners.length + 1) * 10} />
        </details>
      </Card>

      {/* ── Tile rows ──────────────────────────────────────────────── */}
      <Card>
        <Section
          title="Shop-by-category rows"
          desc='Each row has a heading ("Hair Care", "Body & More" etc.) and 4-6 small tile cards that link to a category page.'
        />
        <div style={cardList}>
          {tileRows.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              categories={categories}
              kind="category_row"
              isFirst={i === 0}
              isLast={i === tileRows.length - 1}
              editing={editingId === b.id}
            />
          ))}
          {tileRows.length === 0 && <EmptyHint kind="category_row" />}
        </div>
        <details style={{ marginTop: 16 }}>
          <summary style={addBtn}>+ Add a tile row</summary>
          <NewBlockForm kind="category_row" categories={categories} suggestedOrder={(tileRows.length + 1) * 100} />
        </details>
      </Card>
    </>
  );
}

// ── Per-block preview card ─────────────────────────────────────────────
// Two states:
//   1. Collapsed (default) — thumbnail + title + quick controls.
//   2. Expanded (editing) — inline edit form with all fields.
// State lives in the URL (`?edit=<id>`) so the page is fully server-
// rendered and the Edit / Cancel buttons are plain links.

function BlockCard({
  block, categories, kind, isFirst, isLast, editing,
}: {
  block: BlockRow;
  categories: CategoryRow[];
  kind: 'banner_card' | 'category_row';
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
}) {
  const slugLabels = block.category_slugs.map(s => categories.find(c => c.slug === s)?.label ?? s);
  return (
    <div style={blockCard(!block.active)}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Thumbnail (banner image, or "row of small squares" for tile rows) */}
        {kind === 'banner_card' ? (
          <div style={thumb}>
            {block.image_url
              ? <img src={block.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ ...thumbFallback }}>No photo</div>}
          </div>
        ) : (
          <div style={{ ...thumb, background: 'transparent', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: '#e5e7eb', borderRadius: 4 }} />
            ))}
          </div>
        )}

        {/* Title + subtitle + tag chips */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{block.title || '(no headline)'}</h3>
            {!block.active && <span style={offTag}>Hidden</span>}
          </div>
          {block.subtitle && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{block.subtitle}</div>}
          {kind === 'banner_card' && block.cta_text && (
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
              CTA: <span style={{ fontWeight: 500, color: '#374151' }}>{block.cta_text}</span> → <span style={{ fontFamily: 'monospace' }}>{block.cta_href || '/shop'}</span>
            </div>
          )}
          {kind === 'category_row' && slugLabels.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {slugLabels.map(l => <span key={l} style={summaryChip}>{l}</span>)}
            </div>
          )}
        </div>

        {/* Per-row controls (reorder, edit, delete) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <form action={moveBlock}>
              <input type="hidden" name="id" value={block.id} />
              <input type="hidden" name="direction" value="up" />
              <button type="submit" style={iconBtn} disabled={isFirst} aria-label="Move up">↑</button>
            </form>
            <form action={moveBlock}>
              <input type="hidden" name="id" value={block.id} />
              <input type="hidden" name="direction" value="down" />
              <button type="submit" style={iconBtn} disabled={isLast} aria-label="Move down">↓</button>
            </form>
          </div>
          <a href={editing ? '?' : `?edit=${block.id}`} style={editBtn}>{editing ? 'Cancel' : 'Edit'}</a>
        </div>
      </div>

      {editing && (
        <BlockEditForm block={block} categories={categories} kind={kind} />
      )}
    </div>
  );
}

function BlockEditForm({
  block, categories, kind,
}: {
  block: BlockRow;
  categories: CategoryRow[];
  kind: 'banner_card' | 'category_row';
}) {
  return (
    <form action={updateBlock} style={editForm}>
      <input type="hidden" name="id"         value={block.id} />
      <input type="hidden" name="kind"       value={kind} />
      <input type="hidden" name="sort_order" value={block.sort_order} />

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Headline</label>
        <input name="title" defaultValue={block.title} required style={{ ...inp, width: '100%' }} placeholder={kind === 'banner_card' ? 'e.g. Wash Day Essentials' : 'e.g. Hair Care'} />
      </div>

      {kind === 'banner_card' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Small kicker line (shown above the headline)</label>
            <input name="subtitle" defaultValue={block.subtitle ?? ''} style={{ ...inp, width: '100%' }} placeholder="e.g. Hair Care Edit" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Button text</label>
              <input name="cta_text" defaultValue={block.cta_text ?? ''} style={{ ...inp, width: '100%' }} placeholder="e.g. Shop Hair Care" />
            </div>
            <div>
              <label style={lbl}>Button link</label>
              <input name="cta_href" defaultValue={block.cta_href ?? ''} style={{ ...inp, width: '100%' }} placeholder="e.g. /shop?taxon=hair" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Photo URL</label>
            <input name="image_url" defaultValue={block.image_url ?? ''} style={{ ...inp, width: '100%' }} placeholder="https://… or leave blank to auto-pick from category" />
            <p style={fieldHint}>Paste any image URL. If left blank we&apos;ll auto-pick a product photo from the linked category below.</p>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Linked category (for auto-pick image fallback)</label>
            <CategoryChipPicker name="category_slugs" categories={categories} initial={block.category_slugs} max={1} />
          </div>
        </>
      )}

      {kind === 'category_row' && (
        <>
          <input type="hidden" name="subtitle"  value={block.subtitle ?? ''} />
          <input type="hidden" name="cta_text"  value={block.cta_text ?? ''} />
          <input type="hidden" name="cta_href"  value={block.cta_href ?? ''} />
          <input type="hidden" name="image_url" value={block.image_url ?? ''} />
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Categories to show (pick 3-6)</label>
            <CategoryChipPicker name="category_slugs" categories={categories} initial={block.category_slugs} max={6} />
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
          <input type="hidden" name="active" value="false" />
          <input name="active" type="checkbox" defaultChecked={block.active} value="true" />
          Show on homepage
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={btnPrimary}>Save changes</button>
          <a href="?" style={btnSecondary}>Cancel</a>
        </div>
        <form action={deleteBlock} style={{ display: 'inline' }}>
          <input type="hidden" name="id" value={block.id} />
          <button type="submit" style={btnDanger}
            onClick={e => { if (!confirm('Delete this block? This cannot be undone.')) e.preventDefault(); }}>
            Delete block
          </button>
        </form>
      </div>
    </form>
  );
}

function NewBlockForm({
  kind, categories, suggestedOrder,
}: {
  kind: 'banner_card' | 'category_row';
  categories: CategoryRow[];
  suggestedOrder: number;
}) {
  return (
    <form action={createBlock} style={{ ...editForm, marginTop: 12 }}>
      <input type="hidden" name="kind"       value={kind} />
      <input type="hidden" name="sort_order" value={suggestedOrder} />

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Headline</label>
        <input name="title" required style={{ ...inp, width: '100%' }} placeholder={kind === 'banner_card' ? 'e.g. Wash Day Essentials' : 'e.g. Hair Care'} />
      </div>

      {kind === 'banner_card' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Small kicker line</label>
            <input name="subtitle" style={{ ...inp, width: '100%' }} placeholder="e.g. Hair Care Edit" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Button text</label>
              <input name="cta_text" defaultValue="Shop now" style={{ ...inp, width: '100%' }} />
            </div>
            <div>
              <label style={lbl}>Button link</label>
              <input name="cta_href" defaultValue="/shop" style={{ ...inp, width: '100%' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Photo URL (optional)</label>
            <input name="image_url" style={{ ...inp, width: '100%' }} placeholder="https://… or leave blank to auto-pick" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Linked category (for auto-pick image)</label>
            <CategoryChipPicker name="category_slugs" categories={categories} max={1} />
          </div>
        </>
      )}

      {kind === 'category_row' && (
        <>
          <input type="hidden" name="subtitle"  value="" />
          <input type="hidden" name="cta_text"  value="" />
          <input type="hidden" name="cta_href"  value="" />
          <input type="hidden" name="image_url" value="" />
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Categories to show (pick 3-6)</label>
            <CategoryChipPicker name="category_slugs" categories={categories} max={6} />
          </div>
        </>
      )}

      <input type="hidden" name="active" value="true" />
      <button type="submit" style={btnPrimary}>Add block</button>
    </form>
  );
}

function EmptyHint({ kind }: { kind: 'banner_card' | 'category_row' }) {
  return (
    <div style={emptyHint}>
      {kind === 'banner_card'
        ? "No banner cards yet. The two big editorial cards below the hero appear here."
        : "No category rows yet. Add a row to surface a curated set of shop categories on the homepage."}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const cardList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 };
const blockCard = (dimmed: boolean): React.CSSProperties => ({
  border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: 'white',
  opacity: dimmed ? 0.65 : 1, transition: 'opacity 150ms',
});
const thumb: React.CSSProperties = {
  width: 96, height: 72, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
  background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const thumbFallback: React.CSSProperties = { fontSize: '0.6875rem', color: '#9ca3af' };
const summaryChip: React.CSSProperties = {
  padding: '2px 7px', background: '#f3f4f6', color: '#374151',
  borderRadius: 4, fontSize: '0.6875rem', fontWeight: 500,
};
const offTag: React.CSSProperties = {
  padding: '1px 6px', background: '#fef3c7', color: '#92400e', borderRadius: 4,
  fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 4, border: '1px solid #d1d5db',
  background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.875rem', padding: 0,
};
const editBtn: React.CSSProperties = {
  padding: '4px 10px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem',
  textDecoration: 'none', textAlign: 'center', fontWeight: 500,
};
const addBtn: React.CSSProperties = {
  cursor: 'pointer', padding: '10px 14px', borderRadius: 6,
  background: '#f9fafb', border: '1px dashed #d1d5db',
  color: '#374151', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-block',
  listStyle: 'none',
};
const editForm: React.CSSProperties = {
  marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6',
};
const fieldHint: React.CSSProperties = {
  fontSize: '0.6875rem', color: '#9ca3af', margin: '4px 0 0', lineHeight: 1.4,
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 14px', background: 'var(--brand-pink-cta, #6B2C91)',
  color: 'white', border: 'none', borderRadius: 6,
  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', textDecoration: 'none',
};
const btnDanger: React.CSSProperties = {
  padding: '7px 12px', background: '#fee2e2', color: '#b91c1c',
  border: '1px solid #fecaca', borderRadius: 6,
  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
};
const emptyHint: React.CSSProperties = {
  padding: 16, background: '#f9fafb', borderRadius: 6,
  fontSize: '0.8125rem', color: '#6b7280', textAlign: 'center',
};
