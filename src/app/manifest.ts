import type { MetadataRoute } from 'next';

// Web App Manifest — makes the storefront installable as a PWA on mobile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aizel',
    short_name: 'Aizel',
    description: 'Authentic hair & body care brands — delivered across the UK.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF6EE',
    theme_color: '#6B2C91',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['shopping', 'lifestyle', 'beauty'],
    lang: 'en-GB',
  };
}
