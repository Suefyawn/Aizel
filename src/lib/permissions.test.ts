import { describe, expect, it } from 'vitest';
import {
  can, canAny, expandLegacyPermissions, ALL_PERMISSIONS,
  type StaffSession,
} from './permissions';

const baseSession: StaffSession = {
  id: 's1', email: 'manager@aizel.co.uk', name: 'Test',
  permissions: [], isOwner: false, roleId: null, roleName: null,
};

describe('can()', () => {
  it('returns true for owners regardless of perm', () => {
    expect(can({ ...baseSession, isOwner: true }, 'analytics_errors')).toBe(true);
  });

  it('returns true when perm is present', () => {
    expect(can({ ...baseSession, permissions: ['analytics_traffic'] }, 'analytics_traffic')).toBe(true);
  });

  it('returns false when perm is absent', () => {
    expect(can({ ...baseSession, permissions: ['orders.view'] }, 'analytics_errors')).toBe(false);
  });

  it('distinguishes view / edit / delete on the same resource', () => {
    const s: StaffSession = { ...baseSession, permissions: ['orders.view'] };
    expect(can(s, 'orders.view')).toBe(true);
    expect(can(s, 'orders.edit')).toBe(false);
    expect(can(s, 'orders.delete')).toBe(false);
  });

  it('treats null/undefined session as no access', () => {
    expect(can(null, 'orders.view')).toBe(false);
    expect(can(undefined, 'orders.view')).toBe(false);
  });
});

describe('canAny()', () => {
  it('returns true when at least one perm matches', () => {
    const s: StaffSession = { ...baseSession, permissions: ['analytics_traffic'] };
    expect(canAny(s, ['analytics', 'analytics_traffic', 'analytics_errors'])).toBe(true);
  });

  it('returns false when none match', () => {
    const s: StaffSession = { ...baseSession, permissions: ['orders.view'] };
    expect(canAny(s, ['analytics', 'analytics_traffic', 'analytics_errors'])).toBe(false);
  });

  it('passes through for owners', () => {
    expect(canAny({ ...baseSession, isOwner: true }, ['settings'])).toBe(true);
  });
});

describe('expandLegacyPermissions()', () => {
  it('expands a legacy resource grant into its view/edit/delete permissions', () => {
    expect(expandLegacyPermissions(['orders'])).toEqual(
      expect.arrayContaining(['orders.view', 'orders.edit', 'orders.delete'])
    );
  });

  it('leaves already-split and unrelated permissions untouched', () => {
    expect(expandLegacyPermissions(['orders.view', 'blog'])).toEqual(['orders.view', 'blog']);
  });

  it('dedupes when a legacy grant and one of its children both appear', () => {
    const out = expandLegacyPermissions(['orders', 'orders.view']);
    expect(out.filter(p => p === 'orders.view')).toHaveLength(1);
  });
});

describe('ALL_PERMISSIONS', () => {
  it('exposes the split commerce permissions', () => {
    expect(ALL_PERMISSIONS).toContain('orders.view');
    expect(ALL_PERMISSIONS).toContain('products.edit');
    expect(ALL_PERMISSIONS).toContain('customers.delete');
  });
});
