// Subscribe & Save shared constants. Kept in a plain module (not the
// 'use server' actions file, which may only export async functions).

// Reorder cadences offered to customers. Mirrors the CHECK constraint in
// migration 088 — keep the two in sync.
export const SUBSCRIPTION_INTERVALS = [30, 45, 60, 90] as const;
