// Stub catalog used when no Supabase env vars are configured. Lets
// `npm run dev` produce a browsable storefront on a fresh clone for
// design / a11y / responsive review.
//
// Never returned in production — gated on `isDemo` in lib/supabase.ts.

import type { BlogPost, Product, Category, Page } from '@/types';

const TS = '2026-05-22T12:00:00.000Z';

// Demo catalogue — a representative slice of the live eBay inventory
// (`gorgeousbeaut_0`). Real product titles, UK GBP prices and eBay-hosted
// thumbnails so a fresh clone can render the storefront end-to-end without
// Supabase. Replaced wholesale once the inventory has been imported.
export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-1', brand: 'Cantu', name: 'Avocado Hydrating Hair Care Set',
    slug: 'demo-cantu-avocado-hydrating-set',
    variant: 'Shampoo, conditioner, curl cream, mousse', price: 10.49, original_price: 13.99,
    category: 'Hair Care', subcategory: 'Shampoo & Conditioner',
    tag: 'Bestseller', stock: 24,
    image_url: 'https://i.ebayimg.com/images/g/r80AAeSw0k5p~LRO/s-l300.jpg',
    description: 'A full Cantu Avocado routine — shampoo, conditioner, curl cream and mousse — that hydrates and defines without weighing curls down.',
    short_description: 'Four-piece Cantu hydrating routine.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-2', brand: 'ApHogee', name: 'Two-Step Protein Treatment & Balancing Moisturizer',
    slug: 'demo-aphogee-two-step',
    variant: '2-piece kit', price: 8.99,
    category: 'Hair Care', subcategory: 'Hair Treatments & Masks',
    tag: 'Bestseller', stock: 31,
    image_url: 'https://i.ebayimg.com/images/g/sRYAAeSwg8FpA2o-/s-l300.jpg',
    description: 'The cult two-step protein treatment used in salons to rebuild damaged hair, paired with the balancing moisturizer that restores softness afterwards.',
    short_description: 'Salon-grade protein rebuild + moisturiser.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-3', brand: 'Kuza', name: 'Jamaican Black Castor Oil Set',
    slug: 'demo-kuza-jbco-set',
    variant: 'Original, Extra Dark, Coconut, Argan, Flaxseed', price: 10.77,
    category: 'Hair Care', subcategory: 'Hair Oils & Serums',
    tag: 'New', stock: 18,
    image_url: 'https://i.ebayimg.com/images/g/EeUAAeSwXBNp~Ize/s-l300.jpg',
    description: 'Five Kuza Jamaican Black Castor Oil variants — strengthen, nourish and seal moisture from scalp to tip.',
    short_description: 'Five-variant JBCO bundle.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-4', brand: 'Dabur', name: 'Amla Hair Oil',
    slug: 'demo-dabur-amla-hair-oil',
    variant: '100ml / 200ml / 300ml', price: 5.99,
    category: 'Hair Care', subcategory: 'Hair Oils & Serums',
    tag: 'Bestseller', stock: 60,
    image_url: 'https://i.ebayimg.com/images/g/f5gAAeSwumFpAj5v/s-l300.jpg',
    description: 'Traditional Amla hair oil — strengthens roots, conditions the scalp and adds a glossy finish.',
    short_description: 'Strengthening Amla hair oil.',
    kind: 'variable', status: 'published', created_at: TS,
  },
  {
    id: 'demo-5', brand: 'KeraCare', name: 'Styling & Conditioning Set of 8',
    slug: 'demo-keracare-styling-set',
    variant: 'UK-labelled 8-piece', price: 9.99,
    category: 'Hair Care', subcategory: 'Mousse & Hairspray',
    tag: 'Sale', stock: 12,
    image_url: 'https://i.ebayimg.com/images/g/B6MAAeSwyNZpHv8P/s-l300.jpg',
    description: 'KeraCare\'s UK-labelled set of eight styling and conditioning essentials — mists, mousses and gels for finished, frizz-free styles.',
    short_description: 'UK-labelled KeraCare 8-piece set.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-6', brand: 'Eco Style', name: 'Olive Oil Styling Gel 32oz',
    slug: 'demo-eco-style-olive-oil-gel',
    variant: '32oz', price: 8.58,
    category: 'Hair Care', subcategory: 'Edge Control & Gels',
    stock: 47,
    image_url: 'https://i.ebayimg.com/images/g/k~kAAeSwTyVppunE/s-l300.jpg',
    description: 'The 32oz Eco Style Olive Oil styling gel — maximum hold without flaking, ideal for slick edges and protective styles.',
    short_description: 'Long-hold olive oil styling gel.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-7', brand: 'got2b', name: 'Dry Shampoo Extra Texture',
    slug: 'demo-got2b-dry-shampoo',
    variant: '200ml', price: 7.49,
    category: 'Hair Care', subcategory: 'Mousse & Hairspray',
    stock: 26,
    image_url: 'https://i.ebayimg.com/images/g/-LwAAeSwZqJp~Guf/s-l300.jpg',
    description: 'Instant fresh-up dry shampoo with extra texture — perfect for second-day hair and pre-styling lift.',
    short_description: 'Texturising dry shampoo for second-day lift.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-8', brand: "Palmer's", name: 'Cocoa Butter Formula 270g',
    slug: 'demo-palmers-cocoa-butter-270g',
    variant: '270g', price: 9.98,
    category: 'Body Care', subcategory: 'Cocoa & Shea Butter',
    tag: 'Bestseller', stock: 38,
    image_url: 'https://i.ebayimg.com/images/g/~ZYAAeSw0wJpCJzK/s-l300.jpg',
    description: 'The original Palmer\'s Cocoa Butter Formula — softens, smooths and deeply moisturises dry skin all over the body.',
    short_description: 'Deeply moisturising cocoa butter.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-9', brand: "Ghana's Best", name: '100% Pure Shea Butter',
    slug: 'demo-ghanas-best-shea-butter',
    variant: '60g – 1kg', price: 4.99,
    category: 'Body Care', subcategory: 'Cocoa & Shea Butter',
    stock: 80,
    image_url: 'https://i.ebayimg.com/images/g/0F4AAeSwjCxpAkAB/s-l300.jpg',
    description: 'Unrefined 100% pure shea butter from Ghana — natural, multi-use moisturiser for skin and hair. Choose your size from 60g up to 1kg.',
    short_description: 'Unrefined pure shea butter.',
    kind: 'variable', status: 'published', created_at: TS,
  },
  {
    id: 'demo-10', brand: 'Vaseline', name: 'Petroleum Jelly',
    slug: 'demo-vaseline-petroleum-jelly',
    variant: '50ml / 100ml / 250ml', price: 4.99,
    category: 'Body Care', subcategory: 'Petroleum Jelly',
    stock: 120,
    image_url: 'https://i.ebayimg.com/images/g/Kv8AAeSwiLtpDNRi/s-l300.jpg',
    description: 'The original Vaseline Petroleum Jelly — deep moisture, dry-skin rescue, multi-use everyday essential.',
    short_description: 'Original Vaseline petroleum jelly.',
    kind: 'variable', status: 'published', created_at: TS,
  },
  {
    id: 'demo-11', brand: 'Ebin', name: 'Wonder Lace Bond Set',
    slug: 'demo-ebin-wonder-lace-bond-set',
    variant: 'Spray, remover, gel & glue', price: 5.49,
    category: 'Styling & Tools', subcategory: 'Wig & Lace Adhesives',
    tag: 'Bestseller', stock: 22,
    image_url: 'https://i.ebayimg.com/images/g/~RoAAeSwJxFpCc7x/s-l300.jpg',
    description: 'The viral Ebin Wonder Lace Bond kit — adhesive spray, remover, gel and glue for a flawless wig install that lasts all week.',
    short_description: 'Four-piece wig install kit.',
    kind: 'simple', status: 'published', created_at: TS,
  },
  {
    id: 'demo-12', brand: 'ORS', name: 'Bump Stopper Shaving Set',
    slug: 'demo-ors-bump-stopper-set',
    variant: 'Anti-bump spray, lotion & beard care', price: 7.99,
    category: 'Grooming', subcategory: 'Shaving',
    stock: 19,
    image_url: 'https://i.ebayimg.com/images/g/s4cAAeSwxp5pA4Pl/s-l300.jpg',
    description: 'Complete shave and beard-care set — anti-bump treatment spray, soothing lotion and beard care for irritation-free results.',
    short_description: 'Three-piece anti-bump shaving set.',
    kind: 'simple', status: 'published', created_at: TS,
  },
];

export const DEMO_CATEGORIES: Category[] = [
  { id: 'demo-cat-1', parent_id: null, slug: 'hair-care', name: 'Hair Care', description: null, image_url: undefined, sort_order: 0 },
  { id: 'demo-cat-2', parent_id: null, slug: 'body-care', name: 'Body Care', description: null, image_url: undefined, sort_order: 1 },
  { id: 'demo-cat-3', parent_id: null, slug: 'styling',   name: 'Styling & Tools', description: null, image_url: undefined, sort_order: 2 },
  { id: 'demo-cat-4', parent_id: null, slug: 'grooming',  name: 'Grooming', description: null, image_url: undefined, sort_order: 3 },
];

export const DEMO_BLOG_POSTS: BlogPost[] = [
  {
    id: 'demo-blog-1', slug: 'demo-wash-day-routine', title: 'A no-stress wash day routine for natural curls',
    excerpt: 'Cantu, ApHogee and a slow Sunday afternoon — the five-step routine that actually works.',
    category: 'Hair Care',
    date: '2026-05-10', read_time: '5 min read', featured: true, body: undefined, image_url: undefined, created_at: TS,
  },
  {
    id: 'demo-blog-2', slug: 'demo-jbco-explained', title: 'Jamaican Black Castor Oil, explained',
    excerpt: 'Original vs Extra Dark — which one your hair actually needs and how to use them.',
    category: 'Hair Care',
    date: '2026-05-04', read_time: '6 min read', featured: false, body: undefined, image_url: undefined, created_at: TS,
  },
  {
    id: 'demo-blog-3', slug: 'demo-cocoa-shea-difference', title: 'Cocoa vs shea butter — which one is right for you',
    excerpt: 'Both are body care heroes. Here\'s when to reach for each one (and when to layer both).',
    category: 'Body Care',
    date: '2026-04-28', read_time: '4 min read', featured: false, body: undefined, image_url: undefined, created_at: TS,
  },
];

// CMS-like pages — match the slugs in `src/lib/page-faqs.ts` so the FAQ
// JSON-LD + accordion can preview end-to-end without a database.
export const DEMO_PAGES: Page[] = [
  {
    id: 'demo-page-shipping', slug: 'shipping', title: 'Shipping Policy',
    status: 'published', show_in_footer: true, sort_order: 1,
    meta_title: 'Shipping Policy | Aizel',
    meta_description: 'UK delivery timelines, free-shipping thresholds, and courier partners.',
    excerpt: 'How orders ship across the UK.',
    body_html: '<p>Aizel ships across the United Kingdom via Royal Mail Tracked and DPD. Orders placed before 2 PM ship the same working day.</p><p>Free standard delivery on orders over £15; below that a flat fee is calculated at checkout based on parcel size and destination.</p>',
  },
  {
    id: 'demo-page-returns', slug: 'returns', title: 'Returns & Refunds',
    status: 'published', show_in_footer: true, sort_order: 2,
    meta_title: 'Returns & Refunds | Aizel',
    meta_description: 'Our 14-day return window, who pays for return shipping, and how refunds are issued.',
    excerpt: 'How returns and refunds work.',
    body_html: '<p>You can request a return within 14 days of delivery for unopened items in their original packaging. Damaged or wrong-item shipments are returned at our cost; other reasons are returned at the customer\'s cost.</p><p>Refunds are issued to the original payment method within 5 working days of receiving the returned item, or as store credit if you prefer a faster turnaround.</p>',
  },
  {
    id: 'demo-page-faq', slug: 'faq', title: 'Frequently Asked Questions',
    status: 'published', show_in_footer: true, sort_order: 3,
    meta_title: 'FAQ | Aizel',
    meta_description: 'Common questions about authenticity, order tracking, payment methods, and customer support.',
    excerpt: 'Common questions, answered.',
    body_html: '<p>Browse the most common questions about Aizel. Don\'t see your answer? <a href="/page/contact">Contact us</a> and we\'ll respond within one working day.</p>',
  },
  {
    id: 'demo-page-about', slug: 'about', title: 'About Aizel',
    status: 'published', show_in_footer: true, sort_order: 4,
    meta_title: 'About Us | Aizel',
    meta_description: 'Aizel stocks authentic Afro/Black hair and body care brands and delivers them fast across the UK.',
    excerpt: 'Authentic hair & body care in the UK.',
    body_html: '<p>Aizel brings together the Black hair and body care brands UK shoppers actually want — Cantu, ORS, Palmer\'s, Kuza, ApHogee, KeraCare, Eco Style and more — and delivers them across the United Kingdom. Authentic products, fair prices, fast UK shipping.</p>',
  },
  {
    id: 'demo-page-contact', slug: 'contact', title: 'Contact Us',
    status: 'published', show_in_footer: true, sort_order: 5,
    meta_title: 'Contact | Aizel',
    meta_description: 'Get in touch with Aizel customer support.',
    excerpt: 'Get in touch.',
    body_html: '<p>Reach us at <a href="mailto:hello@aizel.co.uk">hello@aizel.co.uk</a> Monday to Friday. Most enquiries are answered within one working day.</p>',
  },
];

export const DEMO_SITE_SETTINGS: Record<string, string> = {
  store_name: 'Aizel',
  store_email: 'hello@aizel.co.uk',
  currency: 'GBP',
  free_shipping_threshold: '15',
  default_shipping_rate: '4',
  announcement_active: 'true',
  announcement_text: 'DEMO MODE · Authentic hair & body care · Free UK delivery over £15',
  announcement_color: '#111827',
  promo_active: 'true',
  promo_label: 'New',
  promo_headline: 'A working preview without a database',
  promo_subline: 'Stub data so you can review layout, a11y, and responsive flow.',
  promo_cta_text: 'Browse the catalogue',
  promo_cta_url: '/shop',
  promo_bg_color: '#6B2C91',
  promo_text_color: '#ffffff',
  hero_headline: 'Hair you love.\n*Brands you trust.*',
  hero_subline: 'Authentic Cantu, ORS, Palmer\'s, Kuza, ApHogee and more — delivered fast across the UK. Free delivery over £15.',
  hero_cta1_text: 'Shop Hair Care',
  hero_cta1_url: '/shop?taxon=hair',
  hero_cta2_text: 'Shop Body Care',
  hero_cta2_url: '/shop?taxon=body',
  hero_brands: 'Cantu,ORS,Palmer\'s,Kuza,ApHogee,KeraCare,Eco Style',
};
