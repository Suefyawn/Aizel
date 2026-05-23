// Seasonal storefront themes.
//
// A theme is a palette swap, nothing more. It is applied by setting a
// `data-theme` attribute on <html> (done server-side in src/app/layout.tsx
// from the `active_theme` site setting); the matching CSS-variable overrides
// live in src/styles/globals.css under `:root[data-theme="<key>"]`.
//
// To add a theme: add an entry here AND a matching block in globals.css.
// Keep the two in sync — this registry drives the admin picker, the CSS
// drives the actual colours.

export interface StoreTheme {
  key: string;
  label: string;
  /** One-line hint shown beside the option in the admin theme picker. */
  hint: string;
}

export const STORE_THEMES: StoreTheme[] = [
  { key: 'default',   label: 'Default',       hint: 'Aizel purple & gold' },
  { key: 'eid',       label: 'Eid / Festive', hint: 'Deep aubergine & gold' },
  { key: 'sale',      label: 'Sale / Promo',  hint: 'Bold violet & bright gold' },
  { key: 'christmas', label: 'Christmas',     hint: 'Plum-burgundy & warm gold' },
  { key: 'easter',    label: 'Easter',        hint: 'Soft lavender & champagne' },
];

const THEME_KEYS = new Set(STORE_THEMES.map(t => t.key));

/** Coerce a stored setting value to a known theme key (falls back to default). */
export function normalizeTheme(value: string | null | undefined): string {
  return value && THEME_KEYS.has(value) ? value : 'default';
}
