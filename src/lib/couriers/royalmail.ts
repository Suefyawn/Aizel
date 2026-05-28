// ============================================================================
// Royal Mail Click & Drop adapter.
//
// Implements CourierAdapter against the Click & Drop API
// (https://api.parcel.royalmail.com/api/v1). One-click `book()` creates the
// order in Click & Drop, generates the postage label, and returns the tracking
// number + label so the order is marked shipped and the customer emailed.
//
// Auth: Bearer API key from Click & Drop → Settings → Integrations →
//       Click & Drop API.
//
// Required env:
//   ROYALMAIL_CLICKDROP_API_KEY   — the Click & Drop API auth key (server-only)
// Optional env:
//   ROYALMAIL_SERVICE_CODE          — RM service code for the standard
//                                     "Royal Mail" courier (e.g. Tracked 48).
//                                     Read it off your Click & Drop account.
//                                     If unset, the order is pushed without a
//                                     service code and your account's default
//                                     postage rule applies (no inline label).
//   ROYALMAIL_SERVICE_CODE_SPECIAL  — service code for "Royal Mail Special
//                                     Delivery".
//   ROYALMAIL_PACKAGE_FORMAT        — package format identifier
//                                     (default 'smallParcel').
//
// Delivery scans (out-for-delivery / delivered) are NOT available from
// Click & Drop — those need Royal Mail's separate Tracking API. So track() is
// reported as unsupported and delivery is confirmed via the customer's
// tracking link or manually. cancel() is unsupported here too — delete the
// order in the Click & Drop portal.
// ============================================================================

import type {
  CourierAdapter,
  BookingInput,
  BookingResult,
  CancelResult,
  TrackResult,
  Result,
} from './types';

const BASE_URL = 'https://api.parcel.royalmail.com/api/v1';
const TIMEOUT_MS = 20_000;

function apiKey(): string | undefined {
  return process.env.ROYALMAIL_CLICKDROP_API_KEY;
}

interface RoyalMailConfig {
  id: string;
  /** Env var to read this courier's RM service code from. */
  serviceCodeEnv: string;
}

// Shapes we read out of the Click & Drop create-orders response. The API
// returns far more than this; we only pluck what we persist.
interface CreatedOrder {
  orderIdentifier?: number;
  orderReference?: string;
  trackingNumber?: string | null;
  label?: string | null; // base64 PDF when label generation succeeds
}
interface CreateOrdersResponse {
  createdOrders?: CreatedOrder[];
  failedOrders?: Array<{ order?: { orderReference?: string }; errors?: Array<{ errorCode?: string; errorMessage?: string }> }>;
}

function makeRoyalMailAdapter({ id, serviceCodeEnv }: RoyalMailConfig): CourierAdapter {
  return {
    id,
    capabilities: { book: true, cancel: false, track: false },

    isConfigured() {
      return Boolean(apiKey());
    },

    async book(input: BookingInput): Promise<Result<BookingResult>> {
      const key = apiKey();
      if (!key) {
        return { ok: false, message: 'Royal Mail API key is not configured (set ROYALMAIL_CLICKDROP_API_KEY).', code: 'not_configured' };
      }

      const serviceCode = process.env[serviceCodeEnv]?.trim() || undefined;
      const packageFormat = process.env.ROYALMAIL_PACKAGE_FORMAT?.trim() || 'smallParcel';

      const c = input.consignee;
      const weightInGrams = Math.max(1, Math.round((input.weightKg || 0.5) * 1000));
      const subtotal = input.items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0);
      const total = input.codAmount || subtotal;
      const shipping = Math.max(0, +(total - subtotal).toFixed(2));

      const order: Record<string, unknown> = {
        orderReference: input.orderNumber.slice(0, 40),
        recipient: {
          address: {
            fullName: [c.firstName, c.lastName].filter(Boolean).join(' ').slice(0, 210) || 'Customer',
            addressLine1: (c.address1 || '').slice(0, 100),
            addressLine2: (c.address2 || undefined)?.slice(0, 100),
            city: (c.city || '').slice(0, 100),
            county: (c.province || undefined)?.slice(0, 100),
            postcode: (c.zip || '').slice(0, 20),
            countryCode: (c.countryCode || 'GB').slice(0, 3),
          },
          phoneNumber: (c.phone || '').slice(0, 25) || undefined,
          emailAddress: (c.email || undefined)?.slice(0, 254),
        },
        // Billing address is handled by the integration's "use shipping address
        // for billing" setting (on by default), so we don't send a billing block.
        packages: [
          {
            weightInGrams,
            packageFormatIdentifier: packageFormat,
            contents: input.items.slice(0, 100).map(it => ({
              name: (it.description || 'Item').slice(0, 800),
              quantity: Math.max(1, Math.min(999999, it.quantity || 1)),
              unitValue: it.unitPrice || 0,
              unitWeightInGrams: it.weightKg ? Math.round(it.weightKg * 1000) : undefined,
            })),
          },
        ],
        orderDate: new Date().toISOString(),
        subtotal: +subtotal.toFixed(2),
        shippingCostCharged: shipping,
        total: +total.toFixed(2),
        currencyCode: input.currency || 'GBP',
        // Ask Click & Drop to generate + return the label so we get a tracking
        // number back immediately (tracking is assigned at label generation).
        label: { includeLabelInResponse: true },
        ...(serviceCode ? { postageDetails: { serviceCode } } : {}),
        ...(input.remarks ? { specialInstructions: input.remarks.slice(0, 500) } : {}),
      };

      let res: Response;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        res = await fetch(`${BASE_URL}/orders`, {
          method: 'POST',
          headers: {
            // Click & Drop expects the raw API key in the Authorization header
            // — NOT a "Bearer" token (per the official help-centre cURL example).
            'Authorization': key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ items: [order] }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
      } catch (e) {
        return { ok: false, message: 'Could not reach Royal Mail Click & Drop. Try again, or enter the tracking number manually.', code: 'network', raw: String(e) };
      }

      let body: CreateOrdersResponse;
      try {
        body = await res.json() as CreateOrdersResponse;
      } catch {
        body = {};
      }

      if (!res.ok) {
        const msg = body.failedOrders?.[0]?.errors?.[0]?.errorMessage
          || `Royal Mail rejected the order (HTTP ${res.status}).`;
        return { ok: false, message: msg, code: res.status, raw: body };
      }

      const failed = body.failedOrders?.[0];
      if (failed) {
        const msg = failed.errors?.map(e => e.errorMessage).filter(Boolean).join('; ')
          || 'Royal Mail could not create this order.';
        return { ok: false, message: msg, code: 'order_failed', raw: body };
      }

      const created = body.createdOrders?.[0];
      const tracking = created?.trackingNumber?.trim();
      if (!created) {
        return { ok: false, message: 'Royal Mail did not return an order — check the address and try again.', code: 'no_order', raw: body };
      }
      if (!tracking) {
        // Order created in Click & Drop but no label/tracking yet — usually a
        // missing or invalid service code, so no postage was applied.
        return {
          ok: false,
          message: serviceCode
            ? 'Royal Mail created the order but returned no tracking number — check the service code is valid for your account.'
            : 'Royal Mail created the order but returned no tracking — set ROYALMAIL_SERVICE_CODE so a label can be generated, or finish despatch in the Click & Drop portal.',
          code: 'no_tracking',
          raw: body,
        };
      }

      return {
        ok: true,
        trackingNumber: tracking,
        labelUrl: created.label ? `data:application/pdf;base64,${created.label}` : null,
        raw: body,
      };
    },

    async cancel(): Promise<Result<CancelResult>> {
      return { ok: false, message: 'Cancel a Royal Mail order in the Click & Drop portal.', code: 'not_supported' };
    },

    async track(): Promise<Result<TrackResult>> {
      return { ok: false, message: 'Royal Mail delivery tracking requires the separate Tracking API.', code: 'not_supported' };
    },
  };
}

export const royalMailAdapter = makeRoyalMailAdapter({ id: 'RoyalMail', serviceCodeEnv: 'ROYALMAIL_SERVICE_CODE' });
export const royalMailSpecialAdapter = makeRoyalMailAdapter({ id: 'RoyalMailSpecial', serviceCodeEnv: 'ROYALMAIL_SERVICE_CODE_SPECIAL' });
