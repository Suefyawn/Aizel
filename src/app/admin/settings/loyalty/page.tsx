export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import {
  inp, lbl, Section, Card, Divider,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/loyalty';

export default async function SettingsLoyaltyPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Loyalty"
        subtitle="How customers earn and redeem loyalty points. Postgres triggers read these on every order, review and signup."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Earn & redeem" desc="Live values — the next order or sign-up uses whatever you save here." />
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Points per £spent</label>
              <input name="loyalty_points_per_pkr" type="number" step="0.01" min={0} defaultValue={g('loyalty_points_per_pkr', '0.1')} style={inp} />
            </div>
            <div>
              <label style={lbl}>£per point at redemption</label>
              <input name="loyalty_pkr_per_point" type="number" step="0.01" min={0} defaultValue={g('loyalty_pkr_per_point', '1')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Welcome points (signup)</label>
              <input name="loyalty_welcome_points" type="number" min={0} defaultValue={g('loyalty_welcome_points', '100')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Approved review points</label>
              <input name="loyalty_review_points" type="number" min={0} defaultValue={g('loyalty_review_points', '25')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Referrer reward (points)</label>
              <input name="loyalty_referral_points" type="number" min={0} defaultValue={g('loyalty_referral_points', '500')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Referee discount (%)</label>
              <input name="loyalty_referral_discount_pct" type="number" min={0} max={100} defaultValue={g('loyalty_referral_discount_pct', '10')} style={inp} />
            </div>
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
