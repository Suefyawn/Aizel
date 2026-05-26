// ============================================================================
// Courier adapter contract. Every API-backed courier (Royal Mail Shipping
// API, DPD WebShipper, Evri, etc.) implements this so the admin UI and
// shipment actions can talk to all of them through the same surface.
//
// `null` returns are the "best-effort failed, keep going" signal — the
// caller falls back to manual tracking-number entry. We never throw across
// this boundary so a single courier outage doesn't bring down the
// merchant's order flow.
// ============================================================================

export interface BookingInput {
  /** Internal order number (YP-XXXXXX) we'll pass as the courier's reference. */
  orderNumber: string;
  /** Buyer details — phone is mandatory for COD. */
  consignee: {
    firstName: string;
    lastName?: string;
    phone: string;             // 03xxxxxxxxx
    email?: string | null;
    address1: string;
    address2?: string | null;
    city: string;
    province?: string | null;
    zip?: string | null;
    countryCode?: string;      // default 'GB'
  };
  /** Total package weight in kilograms. Most couriers require ≥ 0.5 kg. */
  weightKg: number;
  /** Piece count for multi-box shipments. Defaults to 1. */
  pieces?: number;
  /** Amount to collect on delivery (GBP). 0 for prepaid. */
  codAmount: number;
  /** Currency — defaults to 'GBP'. */
  currency?: string;
  /** SKU lines for the customs / weight breakdown. */
  items: Array<{
    description: string;
    quantity: number;
    weightKg: number;
    unitPrice: number;
  }>;
  /** Free-text remarks visible on the label. */
  remarks?: string;
}

export interface BookingResult {
  ok: true;
  /** What the courier issued — store as shipments.tracking_number. */
  trackingNumber: string;
  /** PDF / URL of the printable label, if the courier returned one. */
  labelUrl?: string | null;
  /** Raw response body for debugging / audit. */
  raw?: unknown;
}

export interface CancelResult {
  ok: true;
  raw?: unknown;
}

export interface TrackEvent {
  status: string;             // already normalised via normaliseCourierStatus()
  description: string;
  occurredAt: string;         // ISO timestamp
}

export interface TrackResult {
  ok: true;
  events: TrackEvent[];
  /** Latest status — convenience field; same as events[0]?.status. */
  current?: string;
  raw?: unknown;
}

export type AdapterError = {
  ok: false;
  /** Human-readable message for the merchant. Never raw API jargon. */
  message: string;
  /** Underlying error code/status for the audit log. */
  code?: string | number;
  raw?: unknown;
};

export type Result<T> = T | AdapterError;

/**
 * Adapter capabilities. A courier that's purely "enter the tracking number
 * by hand" has every method returning AdapterError with code='not_supported'.
 */
export interface CourierAdapter {
  /** Stable id matching CourierProfile.id ('RoyalMail', 'DPD', etc.). */
  id: string;
  /** Whether this adapter has a live API (vs. manual-only). */
  capabilities: {
    book: boolean;
    cancel: boolean;
    track: boolean;
  };
  /** Whether the necessary env vars are set in this deployment. */
  isConfigured(): boolean;
  book(input: BookingInput): Promise<Result<BookingResult>>;
  cancel(trackingNumber: string): Promise<Result<CancelResult>>;
  track(trackingNumber: string): Promise<Result<TrackResult>>;
}
