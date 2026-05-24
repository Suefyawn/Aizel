import type { Tier } from '@/lib/loyalty-tiers';

interface Props {
  tier: Tier;
  /** Optional progress slot — "£42 to Silver" — rendered next to the
   *  badge. Caller composes the copy so this stays a pure presentational
   *  component. Pass undefined to hide. */
  progress?: string;
  /** `size='lg'` for the /account hero card; default `md` for table cells
   *  and inline contexts (admin user list, order detail, etc.). */
  size?: 'sm' | 'md' | 'lg';
}

// Single visual treatment for loyalty tiers across the storefront +
// admin. The colours come from the tier itself so a future re-tune
// (different palette, new tier) is a one-file change.
export function TierBadge({ tier, progress, size = 'md' }: Props) {
  if (tier.key === 'none') {
    return (
      <span style={{ fontSize: size === 'lg' ? '0.8125rem' : '0.6875rem', color: 'var(--ink-500)' }}>
        {tier.tagline}
      </span>
    );
  }
  const pad =
    size === 'lg' ? '6px 14px' :
    size === 'sm' ? '2px 8px'  : '3px 10px';
  const fontSize =
    size === 'lg' ? '0.8125rem' :
    size === 'sm' ? '0.625rem'  : '0.6875rem';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{
        display: 'inline-block', padding: pad,
        background: tier.bg, color: tier.fg,
        borderRadius: 20, fontSize, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        lineHeight: 1.1,
      }}>
        {tier.label}
      </span>
      {progress && (
        <span style={{ fontSize: size === 'lg' ? '0.8125rem' : '0.75rem', color: 'var(--ink-500)' }}>
          {progress}
        </span>
      )}
    </span>
  );
}
