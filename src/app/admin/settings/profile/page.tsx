export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { SOCIAL_PLATFORMS } from '@/lib/socials';
import {
  inp, lbl, Section, Card, Divider, SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/profile';

export default async function SettingsProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Store profile"
        subtitle="Your store's identity — name, contact details, and links to your social profiles."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Store info" desc="Shown in email footers, structured data, and on the contact page." />
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Store name</label>
              <input name="store_name" defaultValue={g('store_name', 'Aizel')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <input name="currency" defaultValue={g('currency', 'GBP')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Store email</label>
              <input name="store_email" type="email" defaultValue={g('store_email')} style={inp}
                placeholder="hello@aizel.co.uk" />
            </div>
            <div>
              <label style={lbl}>Store phone</label>
              <input name="store_phone" type="tel" defaultValue={g('store_phone')} style={inp}
                placeholder="07123 456789" />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Social media"
            desc="Links to your social profiles. They appear in the site footer and feed the structured-data (sameAs) Google reads. Leave a field blank to hide that link."
          />
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {SOCIAL_PLATFORMS.map(p => (
              <div key={p.key}>
                <label style={lbl}>{p.label}</label>
                {/* type="text" (not "url") so a bare handle or scheme-less
                    URL still submits — normalizeUrl() in lib/socials.ts adds
                    https:// when missing. inputMode keeps the URL keyboard. */}
                <input
                  name={p.key}
                  type="text"
                  inputMode="url"
                  defaultValue={g(p.key)}
                  style={inp}
                  placeholder={p.placeholder}
                />
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Paste the full profile URL. WhatsApp shows in the footer only; the
            rest also identify the store to search engines.
          </p>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
