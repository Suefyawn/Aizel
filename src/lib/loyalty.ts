// Loyalty + tier helpers shared by rewards page / checkout / admin.

import type { LoyaltyTier } from '@/types';

export const TIER_THRESHOLDS = {
  Silver: 1000,
  Gold:   5000,
} as const;

export function tierForLifetime(points: number): LoyaltyTier {
  if (points >= TIER_THRESHOLDS.Gold)   return 'Gold';
  if (points >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function nextTierTarget(points: number): { next: LoyaltyTier | null; needed: number } {
  if (points < TIER_THRESHOLDS.Silver) return { next: 'Silver', needed: TIER_THRESHOLDS.Silver - points };
  if (points < TIER_THRESHOLDS.Gold)   return { next: 'Gold',   needed: TIER_THRESHOLDS.Gold   - points };
  return { next: null, needed: 0 };
}

// Earn rules — match site_settings defaults; admin can override in DB.
// The actual server-side awarding is driven by Postgres functions, but the
// rewards page uses these labels for display.
export const EARN_RULES: { reason: string; label: string; description: string }[] = [
  { reason: 'welcome',        label: '+100 pts',  description: 'Welcome bonus when you sign up' },
  { reason: 'order_delivered',label: '10 pts / £100', description: 'Earned when your order is marked delivered' },
  { reason: 'review_approved',label: '+25 pts',   description: 'When a review you submit is approved' },
  { reason: 'referral_reward',label: '+500 pts',  description: 'When someone you referred completes their first order' },
  { reason: 'birthday',       label: '+200 pts',  description: 'On your birthday (set DOB on your profile)' },
];

export const REASON_LABELS: Record<string, string> = {
  welcome:           'Welcome bonus',
  order_delivered:   'Order delivered',
  review_approved:   'Review approved',
  referral_reward:   'Referral reward',
  redemption:        'Points redeemed',
  birthday:          'Birthday bonus',
  manual:            'Manual adjustment',
  refund_reversal:   'Refund reversed',
};
