export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { STORE_THEMES, normalizeTheme } from '@/lib/themes';
import {
  inp, lbl, Section, Card, Divider, Toggle, ColorPicker,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/branding';

export default async function SettingsBrandingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Branding & theme"
        subtitle="Brand colours and the seasonal makeover — a one-switch palette + hero swap for Eid, Christmas, and the like."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section
            title="Brand colours"
            desc="Used by emails and storefront accents. CSS variables in globals.css are the source of truth for the storefront; these copies are for email + future theming."
          />
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Brand purple</label>
              <ColorPicker name="brand_pink"   value={g('brand_pink',   '#6B2C91')} label="Primary" />
            </div>
            <div>
              <label style={lbl}>Brand gold</label>
              <ColorPicker name="brand_yellow" value={g('brand_yellow', '#D4A437')} label="Accent" />
            </div>
            <div>
              <label style={lbl}>Ink (black)</label>
              <ColorPicker name="ink_900"      value={g('ink_900',      '#0A0A0A')} label="Text" />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Seasonal theme"
            desc="A full seasonal makeover — colour palette, a subtle background motif, and the homepage hero — all behind one switch. Use it for Eid, Christmas and the like; for everyday sales use the Homepage page (Sale / Announcement) instead. Storefront pages are edge-cached, so a change reaches all visitors within a few minutes."
          />
          <Divider />
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <label style={lbl}>Seasonal mode</label>
              <Toggle name="season_active" checked={g('season_active') === 'true'} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                While off, the storefront keeps its default palette, no motif and the normal hero — whatever season is picked below stays dormant. Turn this on when the season begins.
              </p>
            </div>

            <div>
              <label style={lbl} htmlFor="set-active-theme">Season</label>
              <select
                id="set-active-theme"
                name="active_theme"
                defaultValue={normalizeTheme(g('active_theme'))}
                style={inp}
              >
                {STORE_THEMES.map(t => (
                  <option key={t.key} value={t.key}>{t.label} — {t.hint}</option>
                ))}
              </select>
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Recolours the storefront and adds a faint matching background motif.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                Seasonal homepage hero
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#9ca3af' }}>
                Replaces the homepage hero while seasonal mode is on. Leave a field blank to keep your normal hero&apos;s value for it.
              </p>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={lbl}>Overline (small label above headline)</label>
                  <input name="season_hero_overline" defaultValue={g('season_hero_overline')} style={inp}
                    placeholder="Eid Mubarak" />
                </div>
                <div>
                  <label style={lbl}>Headline</label>
                  <textarea name="season_hero_headline" defaultValue={g('season_hero_headline').replace(/<br\/>/g, '\n')} rows={2} style={{ ...inp, resize: 'vertical' }}
                    placeholder="Celebrate the season" />
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Use a new line where you want a line break. Italics with HTML: &lt;em&gt;text&lt;/em&gt;
                  </p>
                </div>
                <div>
                  <label style={lbl}>Sub-text</label>
                  <textarea name="season_hero_subline" defaultValue={g('season_hero_subline')} rows={3} style={{ ...inp, resize: 'vertical' }} />
                </div>
                <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Button text</label>
                    <input name="season_hero_cta1_text" defaultValue={g('season_hero_cta1_text')} style={inp}
                      placeholder="Shop the Eid edit" />
                  </div>
                  <div>
                    <label style={lbl}>Button URL</label>
                    <input name="season_hero_cta1_url" defaultValue={g('season_hero_cta1_url')} style={inp}
                      placeholder="/shop" />
                  </div>
                </div>
                <div>
                  <ImageUpload name="season_hero_image_url" currentUrl={g('season_hero_image_url')} label="Seasonal hero image" aspect={4 / 3} />
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Recommended 800×700px or taller. Leave blank to keep your normal hero image.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
