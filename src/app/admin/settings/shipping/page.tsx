export const dynamic = 'force-dynamic';

import { getSiteSettings, supabaseAdmin } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { createZone, updateZone, deleteZone } from './actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import {
  inp, lbl, Section, Card, Divider, Toggle,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/shipping';

interface Zone {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

interface Rate {
  id: string;
  zone_id: string;
  rate: number;
  free_shipping_threshold: number | null;
  label: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

async function loadZones(): Promise<{ zone: Zone; rate: Rate | null }[]> {
  const sb = supabaseAdmin();
  const [zonesRes, ratesRes] = await Promise.all([
    sb.from('shipping_zones').select('*').order('sort_order', { ascending: true }),
    sb.from('shipping_rates').select('*'),
  ]);
  const zones = (zonesRes.data ?? []) as Zone[];
  const rates = (ratesRes.data ?? []) as Rate[];
  return zones.map(z => ({ zone: z, rate: rates.find(r => r.zone_id === z.id) ?? null }));
}

function ZoneFields({ zone, rate }: { zone?: Zone; rate?: Rate | null }) {
  return (
    <>
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Zone name</label>
          <input name="name" defaultValue={zone?.name ?? ''} required style={inp} placeholder="e.g. Karachi" />
        </div>
        <div>
          <label style={lbl}>Sort order</label>
          <input name="sort_order" type="number" defaultValue={zone?.sort_order ?? 0} style={inp} />
        </div>
      </div>
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Rate (GBP)</label>
          <input name="rate" type="number" min={0} defaultValue={rate?.rate ?? 4} required style={inp} />
        </div>
        <div>
          <label style={lbl}>Free shipping at (GBP, blank for never)</label>
          <input name="free_shipping_threshold" type="number" min={0} defaultValue={rate?.free_shipping_threshold ?? ''} style={inp} placeholder="e.g. 15" />
        </div>
      </div>
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Est. min days</label>
          <input name="estimated_days_min" type="number" min={0} defaultValue={rate?.estimated_days_min ?? ''} style={inp} />
        </div>
        <div>
          <label style={lbl}>Est. max days</label>
          <input name="estimated_days_max" type="number" min={0} defaultValue={rate?.estimated_days_max ?? ''} style={inp} />
        </div>
      </div>
      <div>
        <label style={lbl}>Active</label>
        <Toggle name="active" checked={zone?.active ?? true} />
      </div>
    </>
  );
}

export default async function SettingsShippingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp, zones] = await Promise.all([getSiteSettings(), searchParams, loadZones()]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Shipping & tax"
        subtitle="Default rates that apply when no zone matches, plus the per-zone overrides used by checkout."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      {/* ── Defaults ───────────────────────────────────────── */}
      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />
        <Card>
          <Section title="Default fallback" desc="Used when checkout can't match the customer's address to a zone below." />
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Default shipping rate (GBP)</label>
              <input name="default_shipping_rate" type="number" min={0} defaultValue={g('default_shipping_rate', '200')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Free shipping threshold (GBP)</label>
              <input name="free_shipping_threshold" type="number" min={0} defaultValue={g('free_shipping_threshold', '2500')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax rate (%)</label>
              <input name="tax_rate_percent" type="number" step="0.01" min={0} max={100} defaultValue={g('tax_rate_percent', '0')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax-inclusive pricing</label>
              <Toggle name="tax_inclusive" checked={g('tax_inclusive') === 'true'} />
            </div>
          </div>
        </Card>
        <SaveBar />
      </form>

      {/* ── Zones ──────────────────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
          Shipping zones
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#6b7280' }}>
          One named region per zone with its own rate. Checkout picks the first matching zone based on the customer&apos;s province.
        </p>
      </div>

      {/* Existing zones */}
      {zones.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '32px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginBottom: 24,
        }}>
          No zones yet — checkout falls back to the default above. Add one to start charging per region.
        </div>
      ) : (
        zones.map(({ zone, rate }) => (
          <div key={zone.id} style={{
            background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: 24, marginBottom: 12,
            opacity: zone.active ? 1 : 0.6,
          }}>
            <form action={updateZone.bind(null, zone.id)} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{zone.name}</div>
                {!zone.active && (
                  <span style={{ padding: '2px 10px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Inactive
                  </span>
                )}
              </div>
              <ZoneFields zone={zone} rate={rate} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button type="submit" style={{
                  padding: '8px 18px', background: '#111827', color: 'white',
                  border: 'none', borderRadius: 7, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                }}>
                  Save zone
                </button>
                <DeleteButton id={zone.id} action={deleteZone} confirmMsg={`Delete the "${zone.name}" zone? Its rate is removed too.`} />
              </div>
            </form>
          </div>
        ))
      )}

      {/* Add zone */}
      <details
        style={{ background: 'white', borderRadius: 10, padding: '12px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}
        open={zones.length === 0}
      >
        <summary style={{ cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: '#111827', padding: '8px 0' }}>
          + Add a zone
        </summary>
        <form action={createZone} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <ZoneFields />
          <div>
            <button type="submit" style={{
              padding: '10px 22px', background: '#C5286A', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}>
              Create zone
            </button>
          </div>
        </form>
      </details>

      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
        Province-to-zone mapping is currently seeded to "Pakistan — Nationwide" for every province. Per-province mapping UI lands in a follow-up.
      </p>
    </>
  );
}
