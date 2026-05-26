// ============================================================================
// Domain types. Mirrors the schema in supabase/migrations/.
// ============================================================================

export type OrderStatus =
  | 'payment_pending'
  | 'payment_failed'
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PayMethod = 'cod' | 'card' | 'bank' | 'gift_card' | 'manual' | 'cash' | 'split';

// Customer-facing labels for each status. Used on /track, account/orders, admin order detail.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  payment_pending: 'Awaiting payment',
  payment_failed:  'Payment failed',
  pending:         'Order received',
  processing:      'Preparing',
  shipped:         'Shipped',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
  returned:        'Returned',
  refunded:        'Refunded',
};

// Forward-progress states shown on the /track timeline.
export const ORDER_TIMELINE_STEPS: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

export type ProductKind = 'simple' | 'variable' | 'bundle' | 'external';
export type ProductStatus = 'draft' | 'published' | 'archived';

export interface Product {
  id: string;
  /** Canonical brand name, e.g. "CeraVe" / "PIXI" / "NARS". NULL for own-label
   *  Aizel-curated products that don't have a consumer-facing brand. Migration
   *  077 dropped the NOT NULL constraint on the DB column. */
  brand: string | null;
  name: string;
  variant?: string;
  price: number;
  original_price?: number;
  /** Legacy single-category text. Prefer `categories` (M2M) via ProductWithCategories. */
  category: string;
  subcategory?: string;
  tag?: string;
  slug: string;
  stock: number;
  /** When false, the product is always sellable and its stock count is
   *  not tracked (services, made-to-order, etc.). */
  track_inventory?: boolean;
  /** Per-unit cost. Used for margin reporting only — never customer-facing.
   *  The legacy column name `vendor_cost` is kept so the DB column doesn't
   *  need a rename migration. */
  vendor_cost?: number | null;
  /** Per-product re-order threshold. When stock drops to or below this
   *  number the product appears on the low-stock dashboard / inventory
   *  "Needs attention" view. NULL = inherit the system default (5). */
  reorder_point?: number | null;
  image_url?: string;
  description?: string;
  short_description?: string;
  how_to_use?: string;
  ingredients?: string;
  tax_class_id?: string | null;
  kind?: ProductKind;
  status?: ProductStatus;
  weight_grams?: number | null;
  wp_product_id?: number | null;
  created_at?: string;
  /** Set by a DB trigger on every UPDATE. Used by the admin product
   *  editor to render a "Saved 2 minutes ago" badge in the sticky
   *  save bar — Stripe / Notion-style at-a-glance confirmation. */
  updated_at?: string;
  // Migration 076 — homepage curation flags.
  is_bestseller?: boolean | null;
  is_featured?: boolean | null;
  // Migration 136 — "free-from" claims used by the collection-page filter
  // rail. Values are kebab-case tokens (sulphate-free, silicone-free,
  // paraben-free, mineral-oil-free) so the filter URL stays short and
  // server-side matching is a single Postgres text[] && operator.
  free_from?: string[] | null;
  // Migration 137 — POS scanning. SKU is the operator's internal code;
  // barcode is the EAN/UPC/GTIN printed on the box.
  sku?: string | null;
  barcode?: string | null;
  // Migration 081 — admin-controlled SEO + content fields.
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
  key_benefits?: ProductKeyBenefit[] | null;
  faq?: ProductFaqItem[] | null;
  usage_tips?: string | null;
  social_proof?: string | null;
  /** Aggregate of approved product_reviews, maintained by a DB trigger.
   *  `rating` is NULL when there are no approved reviews. */
  rating?: number | null;
  review_count?: number;
}

export interface ProductKeyBenefit {
  /** Optional unicode/emoji glyph rendered before the text. */
  icon?: string;
  text: string;
}

export interface ProductFaqItem {
  q: string;
  a: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  wp_term_id?: number | null;
}

export interface ProductAttribute {
  id: string;
  slug: string;
  name: string;
  visible_on_pdp: boolean;
  usable_in_filter: boolean;
  sort_order: number;
}

export interface AttributeValue {
  id: string;
  attribute_id: string;
  slug: string;
  value: string;
  color_hex?: string | null;
  image_url?: string | null;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  image_url?: string | null;
  weight_grams?: number | null;
  enabled: boolean;
  sort_order: number;
  /** Resolved attribute selections — populated by joins in queries. */
  attributes?: { attribute_id: string; value_id: string }[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  variant_id?: string | null;
  url: string;
  alt?: string | null;
  sort_order: number;
}

export interface ProductRelation {
  product_id: string;
  related_product_id: string;
  kind: 'cross_sell' | 'upsell' | 'related' | 'grouped';
  sort_order: number;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  body_html: string;
  excerpt?: string | null;
  status: 'draft' | 'published' | 'archived';
  meta_title?: string | null;
  meta_description?: string | null;
  show_in_footer: boolean;
  sort_order: number;
}

export interface Redirect {
  id: string;
  from_path: string;
  to_path: string;
  status_code: 301 | 302 | 307 | 308;
  source: 'manual' | 'wp_import' | 'admin';
  hit_count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  read_time: string;
  featured?: boolean;
  body?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem extends Product {
  qty: number;
  /** Set when adding a specific variant of a variable product. */
  variant_id?: string | null;
  /** Human-readable summary of the variant selection, e.g. "Shade: Coral · Size: 250ml". */
  variant_label?: string | null;
}

export interface Order {
  id?: string;
  order_number: string;
  email?: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  province?: string;
  zip?: string;
  pay_method: PayMethod;
  subtotal: number;
  shipping: number;
  total: number;
  items: CartItem[];
  status?: OrderStatus;
  tracking_number?: string;
  courier?: string;
  user_id?: string;
  coupon_code?: string;
  discount_amount?: number;
  notes?: string;
  /** WP legacy fields populated by the importer. */
  legacy_wp_order_id?: number | null;
  legacy_wp_customer_id?: number | null;
  created_at?: string;
  /** Set by the review-requests cron once the post-delivery review email
   *  has been sent. NULL/undefined = not yet asked. */
  review_request_sent_at?: string | null;
  /** Set when staff mark the customer as having confirmed the order
   *  (typically over WhatsApp). NULL = not yet confirmed. */
  confirmed_at?: string | null;
}

/** A bank / mobile-wallet account customers transfer to for "Bank Transfer"
 *  orders. Stored as a JSON array in site_settings (`pay_bank_accounts`). */
export interface BankAccount {
  /** Bank name — e.g. "Barclays", "HSBC", "Monzo". */
  label: string;
  /** Account holder name. */
  title: string;
  /** Sort code + account number (display string). */
  number: string;
  /** IBAN — optional. */
  iban?: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note?: string;
  actor_kind: 'customer' | 'staff' | 'system' | 'gateway';
  actor_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type CouponDiscountType = 'percent' | 'fixed_cart' | 'fixed_product' | 'free_shipping';

export interface Coupon {
  id: string;
  code: string;
  /** Legacy column; prefer `discount_type`. */
  type: 'percent' | 'fixed';
  discount_type?: CouponDiscountType;
  value: number;
  min_order: number;
  max_order?: number | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  individual_use?: boolean;
  exclude_sale_items?: boolean;
  free_shipping?: boolean;
  usage_limit_per_user?: number | null;
  product_ids?: string[];
  excluded_product_ids?: string[];
  category_ids?: string[];
  excluded_category_ids?: string[];
  email_restrictions?: string[];
  description?: string | null;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  dob?: string | null;
  referral_code?: string | null;
  referred_by_code?: string | null;
  created_at: string;
}

export interface LoyaltyAccount {
  user_id: string;
  points_balance: number;
  lifetime_points: number;
  updated_at: string;
}

export type LoyaltyReason =
  | 'welcome' | 'order_delivered' | 'review_approved' | 'referral_reward'
  | 'redemption' | 'birthday' | 'manual' | 'refund_reversal';

export interface LoyaltyLedgerEntry {
  id: string;
  user_id: string;
  delta: number;
  reason: LoyaltyReason;
  order_id: string | null;
  note: string | null;
  created_at: string;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold';

export interface GiftCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  expires_at: string | null;
  active: boolean;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  zip: string | null;
  is_default: boolean;
  created_at: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  active: boolean;
}

export interface ShippingRate {
  id: string;
  zone_id: string;
  rate: number;
  free_shipping_threshold: number | null;
  label: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export interface TaxClass {
  id: string;
  name: string;
  rate_percent: number;
  inclusive: boolean;
}

export interface Payment {
  id: string;
  order_id: string;
  gateway: 'cod' | 'bank' | 'manual' | 'gift_card' | 'stripe' | 'paypal';
  amount: number;
  currency: string;
  status: 'initiated' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
  txn_ref: string | null;
  raw_payload?: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
}

export type ReorderSubscriptionStatus = 'active' | 'paused' | 'cancelled';

// "Subscribe & Save" — a recurring reorder *reminder* for consumable
// wellness products. Not auto-billing; see migration 088.
export interface ReorderSubscription {
  id: string;
  user_id: string;
  email: string;
  product_id: string;
  variant_id: string | null;
  interval_days: number;
  status: ReorderSubscriptionStatus;
  next_reminder_at: string;
  last_reminded_at: string | null;
  reminder_count: number;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string | null;
  author_name: string;
  reviewer_email?: string | null;
  rating: number;
  body: string;
  approved: boolean;
  verified_purchase: boolean;
  photo_urls: string[];
  helpful_count: number;
  brand_reply: string | null;
  created_at: string;
}
