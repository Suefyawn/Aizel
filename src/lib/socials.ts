// ============================================================================
// Social media links — owner-managed via admin Settings, stored in
// site_settings. The footer and the JSON-LD `sameAs` arrays both read from
// here so there is one source of truth (no hardcoded handles to drift).
// ============================================================================

export interface SocialPlatform {
  /** site_settings key the URL is stored under. */
  key: string;
  /** Display name (footer label + settings field label). */
  label: string;
  /** Example URL shown as the input placeholder. */
  placeholder: string;
  /** Whether this counts as a public profile for schema.org `sameAs`.
   *  WhatsApp is a contact channel, not an identifying profile, so it is
   *  excluded from `sameAs` but still rendered in the footer. */
  schemaProfile: boolean;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'social_instagram', label: 'Instagram',   placeholder: 'https://instagram.com/yourhandle',  schemaProfile: true },
  { key: 'social_facebook',  label: 'Facebook',    placeholder: 'https://facebook.com/yourpage',     schemaProfile: true },
  { key: 'social_tiktok',    label: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle',    schemaProfile: true },
  { key: 'social_youtube',   label: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel',  schemaProfile: true },
  { key: 'social_twitter',   label: 'X (Twitter)', placeholder: 'https://x.com/yourhandle',          schemaProfile: true },
  { key: 'social_pinterest', label: 'Pinterest',   placeholder: 'https://pinterest.com/yourhandle',  schemaProfile: true },
  { key: 'social_whatsapp',  label: 'WhatsApp',    placeholder: 'https://wa.me/923001234567',        schemaProfile: false },
];

export interface SocialLink {
  label: string;
  href: string;
}

// Owner input may omit the protocol ("instagram.com/foo"); a bare value would
// be treated as a relative path by the browser. Prepend https:// when no
// scheme is present so the link always resolves to the external profile.
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, '')}`;
}

/** Footer social links — every configured platform, in display order. */
export function socialLinks(settings: Record<string, string>): SocialLink[] {
  return SOCIAL_PLATFORMS
    .map(p => ({ label: p.label, href: normalizeUrl(settings[p.key] ?? '') }))
    .filter(s => s.href.length > 0);
}

/** schema.org `sameAs` — public profile URLs only (excludes WhatsApp). */
export function socialSameAs(settings: Record<string, string>): string[] {
  return SOCIAL_PLATFORMS
    .filter(p => p.schemaProfile)
    .map(p => normalizeUrl(settings[p.key] ?? ''))
    .filter(Boolean);
}
