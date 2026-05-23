// Display-name helpers for products. WP imports frequently store the brand
// inside `product.name` (e.g. brand="Kiko Milano", name="Kiko Milano 3D
// Hydra Lip Gloss"). Concatenating brand + name in titles / meta produces
// awkward duplicates ("Kiko Milano Kiko Milano 3D Hydra Lip Gloss"). These
// helpers normalize the casing and dedupe.
//
// Pure functions, no side effects — safe to call in server components and
// metadata factories.

/**
 * Strip a leading brand prefix from `name` if it already matches `brand`
 * (case-insensitive, whitespace-tolerant). Returns the trimmed name —
 * if the name doesn't start with the brand, returns the name unchanged.
 */
export function stripBrandPrefix(brand: string | null | undefined, name: string): string {
  if (!brand || !name) return (name ?? '').trim();
  const trimmedBrand = brand.trim();
  const trimmedName = name.trim();
  // Tokenize on whitespace + non-alphanumerics so "L'Oreal" vs "L Oreal"
  // and "RHODE" vs "Rhode" both match.
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const normBrand = normalize(trimmedBrand);
  const normName  = normalize(trimmedName);
  if (!normBrand || !normName.startsWith(normBrand)) return trimmedName;

  // Find the actual prefix length in the original string by re-scanning.
  // Skip the brand characters one normalized-codepoint at a time, then the
  // separators that follow.
  let i = 0;
  let consumed = 0;
  while (i < trimmedName.length && consumed < normBrand.length) {
    const ch = trimmedName[i].toLowerCase();
    if (/[a-z0-9]/.test(ch)) consumed++;
    i++;
  }
  // Eat any trailing separators ( spaces, dashes, dots, etc.)
  while (i < trimmedName.length && /[\s\-–—·.,:]/.test(trimmedName[i])) i++;
  const stripped = trimmedName.slice(i).trim();
  // Never return empty — fall back to the original name if the brand IS the name.
  return stripped || trimmedName;
}

/**
 * "Brand Name" composer that avoids duplication. Use anywhere we want a
 * combined display string (alt text, schema.org name, SERP title).
 *
 * Three modes:
 *   • No brand              → return the name as-is.
 *   • Name IS the brand     → return just `brand` (avoids "Argivital
 *                             Argivital" — the bug that motivated this
 *                             helper's strict equality guard).
 *   • Name starts with brand → strip the prefix, then re-prepend so the
 *                             casing is canonical ("CeraVe Hydrating
 *                             Cleanser" even if the row had "cerave
 *                             Hydrating Cleanser").
 *   • Otherwise              → `brand name`.
 */
export function brandPlusName(brand: string | null | undefined, name: string): string {
  if (!brand) return (name ?? '').trim();
  const trimmedBrand = brand.trim();
  const trimmedName = name.trim();
  if (!trimmedName) return trimmedBrand;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (normalize(trimmedBrand) === normalize(trimmedName)) {
    // The product name IS the brand — return one copy, not "X X".
    return trimmedBrand;
  }

  const safeName = stripBrandPrefix(brand, name);
  if (!safeName || normalize(safeName) === normalize(trimmedBrand)) {
    return trimmedBrand;
  }
  return `${trimmedBrand} ${safeName}`;
}
