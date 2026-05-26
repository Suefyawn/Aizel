// Regenerate Aizel favicons from the canonical LogoMark design.
// Single source of truth: src/components/ui/LogoMark.tsx
// (purple roundel + white geometric "A" stroke).
//
// Usage:
//   npm install --no-save png-to-ico   # one-time install (sharp is a transitive dep)
//   node scripts/regen-favicons.mjs    # writes all 6 icon files in-place
//
// Re-run whenever the brand mark changes — keeps every favicon size in
// sync with the React LogoMark component without hand-editing PNGs.
//
// Targets:
//   src/app/icon.png             — Next.js primary icon (512×512)
//   src/app/apple-icon.png       — iOS home-screen icon (180×180)
//   src/app/favicon.ico          — Legacy + IE fallback (multi-res 16/32/48)
//   public/icon-192.png          — PWA manifest 192
//   public/icon-512.png          — PWA manifest 512
//   public/icon-192-maskable.png — Android adaptive icon (192, 20% safe-area
//                                  padding on every edge so the OS mask
//                                  doesn't crop the mark).

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, unlinkSync } from 'node:fs';

const PURPLE = '#6B2C91';
const WHITE  = '#FFFFFF';

function svgAt(size, { padding = 0, maskable = false } = {}) {
  const safeSize = size - padding * 2;
  const stroke   = Math.max(1.4, safeSize / 12);
  const bg = maskable ? PURPLE : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${maskable ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
  <g transform="translate(${padding},${padding})">
    <svg width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="${PURPLE}"/>
      <path d="M8.4 17 L12 7 L15.6 17 M9.7 13.6 L14.3 13.6"
            stroke="${WHITE}" stroke-width="${stroke}"
            stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  </g>
</svg>`;
}

async function renderPng(size, outPath, opts = {}) {
  const svg = Buffer.from(svgAt(size, opts));
  await sharp(svg, { density: 300 })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log('wrote', outPath, '(' + size + '×' + size + ')');
}

async function main() {
  await renderPng(512, 'src/app/icon.png');
  await renderPng(180, 'src/app/apple-icon.png');
  await renderPng(192, 'public/icon-192.png');
  await renderPng(512, 'public/icon-512.png');
  await renderPng(192, 'public/icon-192-maskable.png', { padding: 38, maskable: true });

  // favicon.ico — multi-resolution (16, 32, 48). Modern browsers ignore it
  // in favour of the 512 above; this carries legacy IE / Edge cases.
  const tmp = ['/tmp/_favicon-16.png', '/tmp/_favicon-32.png', '/tmp/_favicon-48.png'];
  await renderPng(16, tmp[0]);
  await renderPng(32, tmp[1]);
  await renderPng(48, tmp[2]);
  const ico = await pngToIco(tmp);
  writeFileSync('src/app/favicon.ico', ico);
  console.log('wrote src/app/favicon.ico (16+32+48 multi-res)');
  tmp.forEach(p => { try { unlinkSync(p); } catch {} });
}

main().catch(e => { console.error(e); process.exit(1); });
