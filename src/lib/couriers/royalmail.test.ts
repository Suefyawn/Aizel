// Behaviour coverage for the Royal Mail Click & Drop adapter. Stubs global
// fetch so we can assert (a) the exact request we send to Click & Drop and
// (b) how each response shape (OBA label, OLP no-tracking, failedOrders,
// HTTP errors, network failure) maps onto the CourierAdapter contract — all
// without touching the live API.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { royalMailAdapter, royalMailSpecialAdapter } from './royalmail';
import type { BookingInput } from './types';

const KEY = 'test-clickdrop-key';

function input(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    orderNumber: 'YP-000123',
    consignee: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '07123456789',
      email: 'ada@example.com',
      address1: '12 Analytical Way',
      address2: 'Flat 2',
      city: 'London',
      province: 'Greater London',
      zip: 'EC1A 1BB',
      countryCode: 'GB',
    },
    weightKg: 0.75,
    codAmount: 0,
    currency: 'GBP',
    items: [
      { description: 'Silk scarf', quantity: 2, weightKg: 0.2, unitPrice: 19.99 },
    ],
    ...overrides,
  };
}

/** Builds a fake fetch Response with the given status + JSON body. */
function fakeResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ROYALMAIL_CLICKDROP_API_KEY = KEY;
  delete process.env.ROYALMAIL_SERVICE_CODE;
  delete process.env.ROYALMAIL_SERVICE_CODE_SPECIAL;
  delete process.env.ROYALMAIL_PACKAGE_FORMAT;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Parses the JSON body the adapter sent on the first fetch call. */
function sentBody() {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse((init as RequestInit).body as string);
}

describe('isConfigured', () => {
  it('is true when the key is set, false when absent', () => {
    expect(royalMailAdapter.isConfigured()).toBe(true);
    delete process.env.ROYALMAIL_CLICKDROP_API_KEY;
    expect(royalMailAdapter.isConfigured()).toBe(false);
  });

  it('declares book-only capabilities', () => {
    expect(royalMailAdapter.capabilities).toEqual({ book: true, cancel: false, track: false });
  });
});

describe('book — request construction', () => {
  it('POSTs to the Click & Drop orders endpoint with the RAW key (not Bearer)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {
      createdOrders: [{ orderIdentifier: 1, trackingNumber: 'AB123' }],
    }));

    await royalMailAdapter.book(input());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.parcel.royalmail.com/api/v1/orders');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe(KEY);              // raw key, no "Bearer "
    expect(headers.Authorization).not.toMatch(/^Bearer /);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('maps the order + recipient + package into the Click & Drop payload', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {
      createdOrders: [{ trackingNumber: 'AB123' }],
    }));

    await royalMailAdapter.book(input());
    const body = sentBody();
    const order = body.items[0];

    expect(order.orderReference).toBe('YP-000123');
    expect(order.recipient.address).toMatchObject({
      fullName: 'Ada Lovelace',
      addressLine1: '12 Analytical Way',
      addressLine2: 'Flat 2',
      city: 'London',
      county: 'Greater London',
      postcode: 'EC1A 1BB',
      countryCode: 'GB',
    });
    expect(order.recipient.emailAddress).toBe('ada@example.com');
    expect(order.recipient.phoneNumber).toBe('07123456789');
    expect(order.packages[0].weightInGrams).toBe(750);    // 0.75 kg
    expect(order.packages[0].contents[0]).toMatchObject({ name: 'Silk scarf', quantity: 2, unitValue: 19.99 });
    expect(order.label).toEqual({ includeLabelInResponse: true });
    expect(order.currencyCode).toBe('GBP');
  });

  it('omits postageDetails when no service code is configured', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { createdOrders: [{ trackingNumber: 'AB123' }] }));
    await royalMailAdapter.book(input());
    expect(sentBody().items[0].postageDetails).toBeUndefined();
  });

  it('includes postageDetails.serviceCode when ROYALMAIL_SERVICE_CODE is set', async () => {
    process.env.ROYALMAIL_SERVICE_CODE = 'TPN24';
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { createdOrders: [{ trackingNumber: 'AB123' }] }));
    await royalMailAdapter.book(input());
    expect(sentBody().items[0].postageDetails).toEqual({ serviceCode: 'TPN24' });
  });

  it('reads the Special-Delivery service code from its own env var', async () => {
    process.env.ROYALMAIL_SERVICE_CODE = 'TPN24';
    process.env.ROYALMAIL_SERVICE_CODE_SPECIAL = 'SD1';
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { createdOrders: [{ trackingNumber: 'AB123' }] }));
    await royalMailSpecialAdapter.book(input());
    expect(sentBody().items[0].postageDetails).toEqual({ serviceCode: 'SD1' });
  });

  it('defaults weight to 500 g when weightKg is falsy', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { createdOrders: [{ trackingNumber: 'AB123' }] }));
    await royalMailAdapter.book(input({ weightKg: 0 }));
    expect(sentBody().items[0].packages[0].weightInGrams).toBe(500);
  });
});

describe('book — response handling', () => {
  it('returns tracking + a data-URL label on a created order with a label', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {
      createdOrders: [{ trackingNumber: 'AB123456785GB', label: 'JVBERi0xLjQK' }],
    }));

    const r = await royalMailAdapter.book(input());
    expect(r).toMatchObject({
      ok: true,
      trackingNumber: 'AB123456785GB',
      labelUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    });
  });

  it('succeeds with labelUrl null when no label is returned (OLP-with-tracking)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {
      createdOrders: [{ trackingNumber: 'AB123456785GB' }],
    }));

    const r = await royalMailAdapter.book(input());
    expect(r).toMatchObject({ ok: true, trackingNumber: 'AB123456785GB', labelUrl: null });
  });

  it('fails with no_tracking when an order is created but no tracking comes back (OLP)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {
      createdOrders: [{ orderIdentifier: 99, trackingNumber: null }],
    }));

    const r = await royalMailAdapter.book(input());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('no_tracking');
    expect(r.message).toMatch(/ROYALMAIL_SERVICE_CODE/);   // unset-key hint
  });

  it('no_tracking message points at the service code when one IS configured', async () => {
    process.env.ROYALMAIL_SERVICE_CODE = 'TPN24';
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { createdOrders: [{ trackingNumber: '' }] }));
    const r = await royalMailAdapter.book(input());
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('no_tracking');
    expect(r.message).toMatch(/service code is valid/);
  });

  it('surfaces failedOrders error messages with code order_failed', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {
      failedOrders: [{ errors: [{ errorCode: 'X', errorMessage: 'Invalid postcode' }, { errorMessage: 'Missing weight' }] }],
    }));

    const r = await royalMailAdapter.book(input());
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('order_failed');
    expect(r.message).toBe('Invalid postcode; Missing weight');
  });

  it('maps a non-2xx HTTP status to that code, using the API error message', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(400, {
      failedOrders: [{ errors: [{ errorMessage: 'Bad request' }] }],
    }));

    const r = await royalMailAdapter.book(input());
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe(400);
    expect(r.message).toBe('Bad request');
  });

  it('falls back to a generic message on a non-2xx with no error body (e.g. 401)', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(401, {}));
    const r = await royalMailAdapter.book(input());
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe(401);
    expect(r.message).toMatch(/HTTP 401/);
  });

  it('returns code network when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    const r = await royalMailAdapter.book(input());
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('network');
  });

  it('returns not_configured when the key is missing', async () => {
    delete process.env.ROYALMAIL_CLICKDROP_API_KEY;
    const r = await royalMailAdapter.book(input());
    if (r.ok) throw new Error('unreachable');
    expect(r.code).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cancel / track are unsupported', () => {
  it('cancel reports not_supported', async () => {
    const r = await royalMailAdapter.cancel('AB123');
    expect(r).toMatchObject({ ok: false, code: 'not_supported' });
  });

  it('track reports not_supported', async () => {
    const r = await royalMailAdapter.track('AB123');
    expect(r).toMatchObject({ ok: false, code: 'not_supported' });
  });
});
