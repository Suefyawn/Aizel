import { redirect } from 'next/navigation';

// /admin/settings is now a landing route. The actual sub-pages live under
// /admin/settings/profile, /branding, /homepage, etc. — each focused on a
// single concern. Land on the first one by default so the URL is stable.
export default function SettingsIndex() {
  redirect('/admin/settings/profile');
}
