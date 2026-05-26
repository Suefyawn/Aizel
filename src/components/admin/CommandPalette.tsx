'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffSession, Permission } from '@/lib/permissions';
import { searchCommandPalette, type CommandSearchResult } from '@/app/admin/command-palette-actions';

// Universal ⌘K / Ctrl+K palette. Opens with a global keybind, lets the
// operator type to jump anywhere — admin pages, products, orders, or
// customers — without lifting their hands off the keyboard.
//
// Three result sources:
//   1. Static nav targets (Dashboard, Orders, Products, …) + quick
//      actions ("New product", "Open till", "Start stocktake") —
//      filtered against the staff's permission set.
//   2. Live product / order / customer search via the server action.
//   3. ↑ ↓ ↵ keyboard navigation; Esc closes.
//
// Patterned after Linear / Stripe / Notion — the "if you only ship one
// modern feature in the admin, ship this" piece.

interface NavTarget {
  label: string;
  hint?: string;             // shown right-aligned, e.g. "page" / "create" / "section"
  href: string;
  icon: string;
  permission?: Permission;
  ownerOnly?: boolean;
  /** Category for the result list header. */
  group: 'Go to' | 'Create' | 'Storefront';
}

// Static registry — kept here (not pulled from the sidebar) because the
// palette needs richer entries (quick actions, storefront pages) than
// the sidebar carries.
const TARGETS: NavTarget[] = [
  // ─── Go to … ─────────────────────────────────────────────────────────
  { group: 'Go to', label: 'Dashboard',       icon: '▣', href: '/admin/dashboard' },
  { group: 'Go to', label: 'Analytics',       icon: '◐', href: '/admin/analytics', permission: 'analytics' },
  { group: 'Go to', label: 'POS Till',        icon: '⌖', href: '/admin/pos',           permission: 'pos.operate' },
  { group: 'Go to', label: 'POS Dashboard',   icon: '◑', href: '/admin/pos/dashboard', permission: 'pos.operate' },
  { group: 'Go to', label: 'Orders',          icon: '◎', href: '/admin/orders',    permission: 'orders.view' },
  { group: 'Go to', label: 'Products',        icon: '◈', href: '/admin/products',  permission: 'products.view' },
  { group: 'Go to', label: 'Inventory',       icon: '⧉', href: '/admin/inventory', permission: 'products.view' },
  { group: 'Go to', label: 'Stocktake',       icon: '📋', href: '/admin/inventory/stocktake', permission: 'products.edit' },
  { group: 'Go to', label: 'Purchase orders', icon: '📦', href: '/admin/inventory/purchase-orders', permission: 'products.edit' },
  { group: 'Go to', label: 'Returns',         icon: '↩', href: '/admin/returns',   permission: 'returns' },
  { group: 'Go to', label: 'Customers',       icon: '◉', href: '/admin/users',     permission: 'customers.view' },
  { group: 'Go to', label: 'Segments',        icon: '⬢', href: '/admin/segments',  permission: 'customers.view' },
  { group: 'Go to', label: 'Coupons',         icon: '◇', href: '/admin/coupons',   permission: 'coupons' },
  { group: 'Go to', label: 'Promos',          icon: '✧', href: '/admin/promos',    permission: 'promos' },
  { group: 'Go to', label: 'Blog',            icon: '✦', href: '/admin/blog',      permission: 'blog' },
  { group: 'Go to', label: 'Reviews',         icon: '★', href: '/admin/reviews',   permission: 'reviews' },
  { group: 'Go to', label: 'Newsletter',      icon: '✉', href: '/admin/newsletter', permission: 'newsletter' },
  { group: 'Go to', label: 'Email blast',     icon: '⌁', href: '/admin/marketing/blast', permission: 'newsletter' },
  { group: 'Go to', label: 'Email log',       icon: '❏', href: '/admin/emails',    permission: 'settings' },
  { group: 'Go to', label: 'Activity log',    icon: '⌘', href: '/admin/audit',     ownerOnly: true },
  { group: 'Go to', label: 'Team',            icon: '⬡', href: '/admin/team',      ownerOnly: true },
  { group: 'Go to', label: 'Settings',        icon: '⚙', href: '/admin/settings',  permission: 'settings' },
  { group: 'Go to', label: 'My profile',      icon: '👤', href: '/admin/profile' },

  // ─── Create … ────────────────────────────────────────────────────────
  { group: 'Create', label: 'New product',         icon: '＋', href: '/admin/products/new', permission: 'products.edit' },
  { group: 'Create', label: 'New manual order',    icon: '＋', href: '/admin/orders/new',   permission: 'orders.edit' },
  { group: 'Create', label: 'New blog post',       icon: '＋', href: '/admin/blog/new',     permission: 'blog' },
  { group: 'Create', label: 'New stocktake',       icon: '＋', href: '/admin/inventory/stocktake', permission: 'products.edit', hint: 'opens list' },
  { group: 'Create', label: 'New purchase order',  icon: '＋', href: '/admin/inventory/purchase-orders/new', permission: 'products.edit' },
  { group: 'Create', label: 'Open the till',       icon: '⌖', href: '/admin/pos', permission: 'pos.operate' },

  // ─── Storefront — owner / staff peeking at the customer side ────────
  { group: 'Storefront', label: 'View storefront',  icon: '↗', href: '/' },
  { group: 'Storefront', label: 'View shop',        icon: '↗', href: '/shop' },
  { group: 'Storefront', label: 'View blog',        icon: '↗', href: '/blog' },
];

function canSee(t: NavTarget, session: StaffSession): boolean {
  if (t.ownerOnly) return session.isOwner;
  if (session.isOwner) return true;
  if (t.permission) return session.permissions.includes(t.permission);
  return true;
}

export function CommandPalette({ session }: { session: StaffSession }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [searchResults, setSearchResults] = useState<CommandSearchResult[]>([]);
  const [, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // ── Global keybind: ⌘K (Mac) / Ctrl+K (Win/Linux) ─────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isPaletteKey = (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      if (isPaletteKey) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset state on close so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI state to an external trigger (the open flag) is the intended pattern
      setQ('');
      setActive(0);
      setSearchResults([]);
    } else {
      // Focus on next tick — autoFocus on the input works but only the
      // first time it mounts; we want focus every time the palette
      // reopens.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ── Live search via server action, debounced 200ms ────────────────
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing results on a query-too-short transition is the intended sync pattern
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const handle = setTimeout(() => {
      startSearch(async () => {
        try {
          const rows = await searchCommandPalette(q);
          setSearchResults(rows);
        } catch {
          setSearchResults([]);
        }
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [q, open]);

  // ── Static target filtering — fuzzy substring against label + group ─
  const filteredTargets = useMemo(() => {
    const visible = TARGETS.filter(t => canSee(t, session));
    const needle = q.trim().toLowerCase();
    if (!needle) return visible;
    return visible.filter(t =>
      t.label.toLowerCase().includes(needle) || t.group.toLowerCase().includes(needle),
    );
  }, [q, session]);

  // ── Combined ordered list for ↑↓ navigation ───────────────────────
  type Row =
    | { kind: 'target'; target: NavTarget; group: string }
    | { kind: 'result'; result: CommandSearchResult; group: string };
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    // Group static targets in declared order.
    const seenGroups = new Set<string>();
    for (const t of filteredTargets) {
      if (!seenGroups.has(t.group)) seenGroups.add(t.group);
      out.push({ kind: 'target', target: t, group: t.group });
    }
    // Append live search results grouped by kind.
    const kindLabel: Record<CommandSearchResult['kind'], string> = {
      product: 'Products', order: 'Orders', customer: 'Customers',
    };
    const byKind: Record<string, CommandSearchResult[]> = {};
    for (const r of searchResults) {
      (byKind[r.kind] ??= []).push(r);
    }
    for (const k of Object.keys(byKind)) {
      for (const r of byKind[k]) {
        out.push({ kind: 'result', result: r, group: kindLabel[k as CommandSearchResult['kind']] });
      }
    }
    return out;
  }, [filteredTargets, searchResults]);

  // Clamp active index when rows shrink.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp is a one-shot sync to a derived bound, not a feedback loop
    if (active >= rows.length) setActive(Math.max(0, rows.length - 1));
  }, [rows.length, active]);

  function pick(row: Row) {
    setOpen(false);
    const href = row.kind === 'target' ? row.target.href : row.result.href;
    // Storefront links open in a new tab so the operator doesn't lose
    // their admin context.
    if (row.kind === 'target' && row.target.group === 'Storefront') {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(href);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row);
    }
  }

  // Scroll the active row into view as the user arrows through.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-cmd-row="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  // Render groups in result order, inserting a header label when the
  // group changes.
  const renderedGroups: Array<{ group: string; startIndex: number; rows: Row[] }> = [];
  let i = 0;
  while (i < rows.length) {
    const g = rows[i].group;
    const groupRows: Row[] = [];
    while (i < rows.length && rows[i].group === g) {
      groupRows.push(rows[i]);
      i += 1;
    }
    renderedGroups.push({ group: g, startIndex: i - groupRows.length, rows: groupRows });
  }

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '10vh 16px 16px',
        zIndex: 9999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onListKeyDown}
        style={{
          width: '100%', maxWidth: 600,
          background: 'white', borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 12vh)',
        }}
      >
        {/* Search input */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span aria-hidden="true" style={{ fontSize: '1rem', color: '#9ca3af' }}>⌘</span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={e => { setQ(e.target.value); setActive(0); }}
            placeholder="Search products, orders, customers — or type to jump anywhere…"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '1rem', color: '#111827',
            }}
          />
          <kbd style={{
            padding: '2px 8px', background: '#f3f4f6', borderRadius: 5,
            fontSize: '0.6875rem', fontWeight: 600, color: '#6b7280',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}>esc</kbd>
        </div>

        {/* Result list */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              {q.trim().length < 2
                ? 'Start typing to search products, orders, customers, or jump to any page.'
                : `No matches for "${q}".`}
            </div>
          ) : renderedGroups.map(g => (
            <div key={g.group + g.startIndex}>
              <div style={{
                padding: '8px 18px 4px', fontSize: '0.6875rem', fontWeight: 700,
                color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {g.group}
              </div>
              {g.rows.map((row, j) => {
                const idx = g.startIndex + j;
                const isActive = idx === active;
                const label  = row.kind === 'target' ? row.target.label : row.result.title;
                const icon   = row.kind === 'target' ? row.target.icon  : kindIcon(row.result.kind);
                const hint   = row.kind === 'target' ? row.target.hint  : row.result.subtitle;
                return (
                  <button
                    type="button"
                    key={row.kind + '-' + idx}
                    data-cmd-row={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => pick(row)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '10px 18px',
                      background: isActive ? '#F5EFF8' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      color: isActive ? '#4A1A6B' : '#111827',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{
                      width: 24, textAlign: 'center', fontSize: '0.875rem',
                      color: isActive ? '#4A1A6B' : '#6b7280', flexShrink: 0,
                    }}>{icon}</span>
                    <span style={{ flex: 1, fontWeight: isActive ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                    {hint && (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                        {hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div style={{
          padding: '8px 18px', borderTop: '1px solid #f3f4f6',
          display: 'flex', gap: 16, fontSize: '0.6875rem', color: '#9ca3af',
        }}>
          <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> open</span>
          <span><kbd style={kbdStyle}>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}><kbd style={kbdStyle}>⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 5px', background: '#f3f4f6', borderRadius: 3,
  fontSize: '0.625rem', fontWeight: 600, color: '#6b7280',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};

function kindIcon(kind: CommandSearchResult['kind']): string {
  switch (kind) {
    case 'product':  return '◈';
    case 'order':    return '◎';
    case 'customer': return '◉';
  }
}
