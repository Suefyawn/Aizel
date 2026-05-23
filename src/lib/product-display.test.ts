import { describe, expect, it } from 'vitest';
import { stripBrandPrefix, brandPlusName } from './product-display';

describe('stripBrandPrefix', () => {
  it('strips an exact brand prefix', () => {
    expect(stripBrandPrefix('Kiko Milano', 'Kiko Milano 3D Hydra Lip Gloss'))
      .toBe('3D Hydra Lip Gloss');
  });

  it('is case-insensitive', () => {
    expect(stripBrandPrefix('RHODE', 'rhode peptide lip treatment'))
      .toBe('peptide lip treatment');
  });

  it('tolerates extra separators between brand and name', () => {
    expect(stripBrandPrefix('NARS', 'NARS - Light Reflecting Foundation'))
      .toBe('Light Reflecting Foundation');
  });

  it('returns name unchanged when brand is missing from name', () => {
    expect(stripBrandPrefix('Skin1004', 'Madagascar Centella Ampoule'))
      .toBe('Madagascar Centella Ampoule');
  });

  it('handles apostrophes / punctuation in brand', () => {
    expect(stripBrandPrefix("L'Oreal", "L'Oreal Paris Lash Serum"))
      .toBe('Paris Lash Serum');
  });

  it('returns the original name when name IS just the brand', () => {
    expect(stripBrandPrefix('PIXI', 'PIXI')).toBe('PIXI');
  });

  it('handles empty inputs', () => {
    expect(stripBrandPrefix('', 'Foo')).toBe('Foo');
    expect(stripBrandPrefix('Foo', '')).toBe('');
  });
});

describe('brandPlusName', () => {
  it('composes without duplicating', () => {
    expect(brandPlusName('Kiko Milano', 'Kiko Milano 3D Hydra Lip Gloss'))
      .toBe('Kiko Milano 3D Hydra Lip Gloss');
  });

  it('adds the brand when missing from the name', () => {
    expect(brandPlusName('CeraVe', 'Moisturising Cream'))
      .toBe('CeraVe Moisturising Cream');
  });

  // Regression: launch-readiness audit found `og:title = "Argivital
  // Argivital"` on the Argivital PDP because the row has brand === name.
  it('does NOT double the brand when name IS the brand', () => {
    expect(brandPlusName('Argivital', 'Argivital')).toBe('Argivital');
    expect(brandPlusName('argivital', 'Argivital')).toBe('argivital');
    expect(brandPlusName('PIXI', 'PIXI')).toBe('PIXI');
  });

  it('handles null / empty brand', () => {
    expect(brandPlusName(null, 'Anti-Melasma Cream')).toBe('Anti-Melasma Cream');
    expect(brandPlusName(undefined, 'Anti-Melasma Cream')).toBe('Anti-Melasma Cream');
    expect(brandPlusName('', 'Anti-Melasma Cream')).toBe('Anti-Melasma Cream');
  });

  it('handles empty name with non-empty brand', () => {
    expect(brandPlusName('NARS', '')).toBe('NARS');
  });
});
