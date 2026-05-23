# Cowork Admin UX Audit — Yellow Pink

Your job: walk **every admin page** and judge it as a UX professional, then
produce a **page-by-page punch list** of concrete, fixable issues. The dev
team fixes straight from your list — so each item must be specific enough to
act on ("the X table has no default sort", not "the page feels off").

This is NOT a functional bug hunt (that's the storefront test plan). It's a
**usability + consistency + polish** review of the admin panel.

- **Admin:** https://yellow-pink.vercel.app/admin — ask the user for the
  owner login.
- Test on **desktop** primarily; spot-check **tablet** width too.

---

## 1. The lens — what "good" looks like

Judge every page against these. When something fails, that's a punch-list item.

1. **Clarity** — is it instantly obvious what the page is for and what the
   primary action is? Is there a clear page title + one-line purpose?
2. **Layout & hierarchy** — content grouped sensibly; scannable; the most
   important thing first; no wall of undifferentiated fields.
3. **Consistency** — cards, headings, buttons, inputs, tables, badges,
   spacing, empty states should look the **same across every admin page**.
   Flag anything that doesn't match the rest.
4. **Tables & lists** — sensible **default sort**, column choices that earn
   their place, readable density, a real empty state, pagination if long,
   row actions discoverable.
5. **Forms** — labelled fields, sensible grouping, good defaults, helper
   text where non-obvious, clear required markers, a sticky/visible save,
   and clear success + error feedback.
6. **Feedback** — every action shows a result (saved / failed / loading);
   destructive actions confirm; nothing fails silently.
7. **Navigation** — sidebar is clear; the active item is obvious; back-links
   and breadcrumbs where needed.
8. **Responsiveness** — usable at a tablet width; tables scroll rather than
   break the layout; no horizontal page scroll.
9. **Polish** — alignment, spacing, truncation, typography, colour use,
   icon quality. Cramped or misaligned = an item.
10. **Friction** — count the clicks for common tasks; flag anything that
    takes more steps than it should.

---

## 2. Pages to audit

Go through **all** of these. For each, first state *what decision/task the
page is meant to support*, then list its issues.

**Overview**
- `/admin/dashboard` — the morning check-in screen.
- `/admin/analytics` — revenue, AOV, segments, cohorts, traffic widgets.

**Catalogue**
- `/admin/products` — product list (search / filter / sort / bulk actions).
- `/admin/products/new` and editing a product (`/admin/products/<id>`) —
  the product form (recently revamped — sanity-check it).
- `/admin/products/import` — CSV import.
- `/admin/inventory` — stock levels + movement ledger + manual adjustment.

**Orders & fulfilment**
- `/admin/orders` — order list + filters.
- An order detail page (`/admin/orders/<id>`) — status, shipment,
  confirmation & vendor, timeline, the printable invoice.
- `/admin/vendors` — supplier list.
- `/admin/returns` — returns queue.

**Customers**
- `/admin/users` — customer list; `/admin/users/<id>` — customer profile.
- `/admin/segments` — customer segments.

**Marketing**
- `/admin/coupons` — coupons (create / edit / delete).
- `/admin/promos` — promo banners.
- `/admin/blog` — post list; `/admin/blog/new` + editing a post — the
  blog editor.
- `/admin/reviews` — review moderation queue.

**System**
- `/admin/audit` — the activity log.
- `/admin/team` — staff list; editing a staff member.
- `/admin/settings` — site settings (long multi-section form).
- `/admin/profile` — the staff member's own profile.
- `/admin` login screen.

---

## 3. Cross-cutting checks

Separate from per-page items, report these once:

- **Consistency matrix** — pick 5 things (card style, page header, primary
  button, table header, empty state) and note every page that deviates.
- **Sidebar** — labels, icons, ordering, active state, mobile drawer.
- **Tablet** — repeat a few key pages at ~900px; note anything that breaks.
- **Loading & errors** — how does each page look while data loads / if a
  query fails?
- **Tone & copy** — headings, button labels, helper text — consistent and
  plain?

## 4. Reporting format

One report, **grouped by page**, in sidebar order. For every issue:

```
[SEVERITY] <page> — short title
  What:     the specific problem
  Where:    the exact element / section
  Fix:      a concrete suggestion
```

Severity: **P1** the page is confusing or hard to use · **P2** awkward /
inconsistent · **P3** polish. Add a **CONSISTENCY** section for the
cross-page items.

## 5. Deliverable

- The per-page punch list.
- The consistency matrix.
- A short **priority list**: the 5 admin pages that most need work, worst
  first — so the fixes start where they matter most.
