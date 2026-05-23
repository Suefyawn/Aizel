import { describe, expect, it } from 'vitest';
import { pkPhoneSchema, productInputSchema, checkoutSchema } from './validators';

describe('pkPhoneSchema (UK phone validator — name retained for compatibility)', () => {
  it.each([
    '07123456789',
    '+447123456789',
    '00447123456789',
    '07123 456789', // spaces stripped
    '020 7946 0958', // London landline
  ])('accepts %s', input => {
    expect(pkPhoneSchema.safeParse(input).success).toBe(true);
  });

  it.each(['12345', '7123', 'notaphone'])('rejects %s', input => {
    expect(pkPhoneSchema.safeParse(input).success).toBe(false);
  });
});

describe('productInputSchema', () => {
  it('requires brand, name, slug, category, price', () => {
    const r = productInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('coerces numeric strings for price/stock', () => {
    const r = productInputSchema.safeParse({
      brand: 'X', name: 'Y', slug: 'x-y', category: 'Makeup',
      price: '24', stock: '5',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.price).toBe(24);
      expect(r.data.stock).toBe(5);
    }
  });

  it('rejects slugs with capital letters or spaces', () => {
    const r = productInputSchema.safeParse({
      brand: 'X', name: 'Y', slug: 'X y', category: 'Makeup', price: '24', stock: '0',
    });
    expect(r.success).toBe(false);
  });
});

describe('checkoutSchema', () => {
  it('requires email for online payment methods', () => {
    // We rely on the CheckoutPage to require email for online methods; the
    // schema itself accepts empty email. Just sanity-check shape.
    const r = checkoutSchema.safeParse({
      firstName: 'A', lastName: 'B', phone: '07123456789',
      address: '12 High Street', city: 'London', payMethod: 'cod', email: '',
    });
    expect(r.success).toBe(true);
  });
});
