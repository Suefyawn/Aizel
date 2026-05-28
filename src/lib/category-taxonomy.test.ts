import { describe, expect, it } from 'vitest';
import { departmentForProduct, taxonForCategory } from './category-taxonomy';

describe('departmentForProduct', () => {
  it('classifies exact leaf categories via the taxonomy', () => {
    expect(departmentForProduct({ category: 'Leave-In Conditioner' })).toBe('hair');
    expect(departmentForProduct({ category: 'Moisturisers' })).toBe('skincare');
    expect(departmentForProduct({ category: 'Cocoa & Shea Butter' })).toBe('body');
    expect(departmentForProduct({ category: 'Beard Care' })).toBe('grooming');
    expect(departmentForProduct({ category: 'Hair Tools' })).toBe('styling');
  });

  it('resolves higher-level labels products carry post-import', () => {
    expect(departmentForProduct({ category: 'Hair Care' })).toBe('hair');
    expect(departmentForProduct({ category: 'Body Care' })).toBe('body');
    expect(departmentForProduct({ category: 'Beauty & Skincare' })).toBe('skincare');
    expect(departmentForProduct({ category: 'Grooming' })).toBe('grooming');
  });

  it('never reads a non-hair product as hair (the aloe-vera bug)', () => {
    // Aloe vera as a skincare serum / face treatment must not say "curls".
    expect(departmentForProduct({ category: 'Serums & Treatments', subcategory: 'Aloe Vera' })).toBe('skincare');
    expect(departmentForProduct({ category: 'Face Masks' })).not.toBe('hair');
    expect(departmentForProduct({ category: 'Body Lotions' })).not.toBe('hair');
  });

  it('keeps hair signals as hair even when a skincare word appears', () => {
    // "Hair Treatments & Masks" contains "mask" but is hair.
    expect(departmentForProduct({ category: 'Hair Treatments & Masks' })).toBe('hair');
  });

  it('returns null (→ generic copy) when it cannot classify confidently', () => {
    // Residual / out-of-taxonomy categories (e.g. leftover supplements) and
    // empties should fall back rather than guess.
    expect(departmentForProduct({ category: 'Immunity' })).toBeNull();
    expect(departmentForProduct({ category: 'Bone Health' })).toBeNull();
    expect(departmentForProduct({ category: '' })).toBeNull();
    expect(departmentForProduct({ category: null, subcategory: null })).toBeNull();
  });
});

describe('taxonForCategory still only matches exact leaves', () => {
  it('returns null for higher-level labels (departmentForProduct handles those)', () => {
    expect(taxonForCategory('Hair Care')).toBeNull();
    expect(taxonForCategory('Conditioner')).not.toBeNull();
  });
});
