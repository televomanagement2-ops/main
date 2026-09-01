import { describe, it, expect } from 'vitest';
import { STORE_CURRENCY, STRIPE_CURRENCY, formatMoneyIn } from './money.ts';

describe('store currency', () => {
  it('is a three-letter ISO 4217 code', () => {
    expect(STORE_CURRENCY).toMatch(/^[A-Z]{3}$/);
  });

  it('exposes the lower-case form Stripe expects', () => {
    // Stripe rejects an upper-case `price_data.currency`, and this is the value
    // create-checkout-session passes straight through.
    expect(STRIPE_CURRENCY).toBe(STORE_CURRENCY.toLowerCase());
  });
});

describe('formatMoneyIn', () => {
  it('defaults to the store currency', () => {
    // The point of the shared module: nothing has to pass the currency in, so
    // nothing can pass a different one by accident.
    expect(formatMoneyIn(12.5, 'en-US')).toBe(formatMoneyIn(12.5, 'en-US', STORE_CURRENCY));
  });

  it('varies the punctuation with the locale but not the currency', () => {
    const us = formatMoneyIn(1234.5, 'en-US', 'USD');
    const it = formatMoneyIn(1234.5, 'it-IT', 'USD');

    expect(us).not.toBe(it);
    // Both are still dollars — the reader's locale must never change what the
    // customer is charged in.
    for (const formatted of [us, it]) {
      expect(formatted).toMatch(/\$|USD/);
    }
  });

  it('renders two decimals for a whole amount', () => {
    expect(formatMoneyIn(9, 'en-US', 'USD')).toBe('$9.00');
  });

  it('formats zero rather than falling back to something empty', () => {
    expect(formatMoneyIn(0, 'en-US', 'USD')).toBe('$0.00');
  });
});
