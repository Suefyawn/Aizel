import Image from 'next/image';

// The real aziel wordmark. Two tones share one transparent artwork so it sits
// on any surface: `ink` (charcoal) for light backgrounds, `cream` for the dark
// purple footer / overlays. Source PNGs are high-res (1379×631) and rendered
// small, so they stay crisp on retina. Height drives the size; width follows
// the artwork's aspect ratio.
const SRC = {
  ink: '/logo-ink.png',
  cream: '/logo-cream.png',
} as const;

const ASPECT = 1379 / 631;

export function LogoWordmark({
  tone = 'ink',
  height = 30,
  priority = false,
}: {
  tone?: 'ink' | 'cream';
  height?: number;
  priority?: boolean;
}) {
  const width = Math.round(height * ASPECT);
  return (
    <Image
      src={SRC[tone]}
      alt="aziel — premium cosmetics"
      width={width}
      height={height}
      priority={priority}
      sizes={`${width}px`}
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}
