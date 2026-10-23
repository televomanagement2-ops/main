import { describe, expect, it } from 'vitest';
import { decide, type OrderState, type WebhookEventInfo } from './webhook-logic';

const order = (status: string, total: number | null = 100): OrderState => ({
  id: 'order-1',
  status,
  total,
});

const completed = (over: Partial<Extract<WebhookEventInfo, { type: 'checkout.session.completed' }>> = {}): WebhookEventInfo => ({
  type: 'checkout.session.completed',
  orderId: 'order-1',
  sessionId: 'cs_1',
  paymentIntentId: 'pi_1',
  paymentStatus: 'paid',
  amountTotal: 10000,
  amountTax: 700,
  ...over,
});

describe('checkout.session.completed', () => {
  it('marks a processing order paid with authoritative totals and sends the email', () => {
    const d = decide(completed(), order('processing'));
    expect(d).toMatchObject({
      action: 'update',
      sendConfirmationEmail: true,
      updates: {
        status: 'paid',
        total: 100,
        tax_amount: 7,
        stripe_payment_intent_id: 'pi_1',
        stripe_session_id: 'cs_1',
      },
    });
  });

  it('does not downgrade or re-email an already-final order', () => {
    const d = decide(completed(), order('paid'));
    expect(d.action).toBe('update');
    if (d.action !== 'update') throw new Error('unreachable');
    expect(d.updates.status).toBeUndefined();
    expect(d.updates.total).toBeUndefined();
    expect(d.sendConfirmationEmail).toBe(false);
    // still records the Stripe ids
    expect(d.updates.stripe_payment_intent_id).toBe('pi_1');
  });

  it('unpaid session → requires_action, no email, no total adoption', () => {
    const d = decide(completed({ paymentStatus: 'unpaid' }), order('processing'));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('requires_action');
    expect(d.updates.total).toBeUndefined();
    expect(d.sendConfirmationEmail).toBe(false);
  });

  it('rejects an event with no usable identifiers', () => {
    const d = decide(completed({ orderId: null, sessionId: null }), null);
    expect(d.action).toBe('invalid');
  });
});

describe('amount reconciliation (M4)', () => {
  it('holds an UNDERPAID order instead of marking it paid', () => {
    // Recorded 100, Stripe only collected 40.
    const d = decide(completed({ amountTotal: 4000, amountTax: 0 }), order('processing', 100));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('requires_action');
    expect(d.updates.needs_review).toBe(true);
    expect(d.updates.review_reason).toContain('amount mismatch');
    expect(d.sendConfirmationEmail).toBe(false);
  });

  it('never rewrites the recorded total down to match an underpayment', () => {
    const d = decide(completed({ amountTotal: 4000, amountTax: 0 }), order('processing', 100));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.total).toBeUndefined();
    expect(d.updates.tax_amount).toBeUndefined();
  });

  it('still records the Stripe ids on a held order so it can be investigated', () => {
    const d = decide(completed({ amountTotal: 4000, amountTax: 0 }), order('processing', 100));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.stripe_payment_intent_id).toBe('pi_1');
    expect(d.updates.stripe_session_id).toBe('cs_1');
  });

  it('holds an OVERCHARGED order too (flat-rate mode is exact)', () => {
    const d = decide(completed({ amountTotal: 15000, amountTax: 0 }), order('processing', 100));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('requires_action');
    expect(d.updates.needs_review).toBe(true);
  });

  it('accepts a one-cent rounding difference', () => {
    const d = decide(completed({ amountTotal: 10001, amountTax: 0 }), order('processing', 100));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('paid');
    expect(d.updates.needs_review).toBeUndefined();
  });

  it('reconciles flat-rate mode where tax is already inside the recorded total', () => {
    // create-checkout-session recorded 107 (100 + 7 tax) and charged 107.
    const d = decide(completed({ amountTotal: 10700, amountTax: 0 }), order('processing', 107));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('paid');
    expect(d.updates.total).toBe(107);
  });

  it('Stripe Tax mode: tax added on top of the recorded total reconciles', () => {
    // Recorded 100 with tax_amount 0; Stripe charged 107 of which 7 is tax.
    const d = decide(
      completed({ amountTotal: 10700, amountTax: 700 }),
      order('processing', 100),
      { stripeTaxEnabled: true },
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('paid');
    expect(d.updates.total).toBe(107);
    expect(d.updates.tax_amount).toBe(7);
  });

  it('Stripe Tax mode: an underpayment beyond the tax delta is still held', () => {
    const d = decide(
      completed({ amountTotal: 5700, amountTax: 700 }),
      order('processing', 100),
      { stripeTaxEnabled: true },
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('requires_action');
    expect(d.updates.needs_review).toBe(true);
  });

  it('skips reconciliation when the order has no recorded total', () => {
    const d = decide(completed({ amountTotal: 4000 }), order('processing', null));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('paid');
  });

  it('payment_intent.succeeded holds an underpayment', () => {
    const d = decide(
      { type: 'payment_intent.succeeded', orderId: 'order-1', paymentIntentId: 'pi_1', amountReceived: 4000 },
      order('processing', 100),
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('requires_action');
    expect(d.updates.needs_review).toBe(true);
    expect(d.updates.total).toBeUndefined();
  });

  it('payment_intent.succeeded under Stripe Tax tolerates the tax surcharge', () => {
    // No tax breakdown on this event: anything >= recorded is accepted.
    const d = decide(
      { type: 'payment_intent.succeeded', orderId: 'order-1', paymentIntentId: 'pi_1', amountReceived: 10700 },
      order('processing', 100),
      { stripeTaxEnabled: true },
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('paid');
    expect(d.updates.total).toBe(107);
  });

  it('payment_intent.succeeded under Stripe Tax still holds an underpayment', () => {
    const d = decide(
      { type: 'payment_intent.succeeded', orderId: 'order-1', paymentIntentId: 'pi_1', amountReceived: 4000 },
      order('processing', 100),
      { stripeTaxEnabled: true },
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('requires_action');
  });
});

describe('payment_intent.succeeded', () => {
  const succeeded: WebhookEventInfo = {
    type: 'payment_intent.succeeded',
    orderId: 'order-1',
    paymentIntentId: 'pi_1',
    amountReceived: 10000,
  };

  it('acts as backup confirmation when nothing finalized the order yet', () => {
    const d = decide(succeeded, order('processing'));
    expect(d).toMatchObject({
      action: 'update',
      sendConfirmationEmail: true,
      updates: { status: 'paid', total: 100 },
    });
  });

  it('only records the payment intent when the order is already final', () => {
    const d = decide(succeeded, order('refunded'));
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates).toEqual({ stripe_payment_intent_id: 'pi_1' });
    expect(d.sendConfirmationEmail).toBe(false);
  });
});

describe('downgrade guards (M2)', () => {
  const failed: WebhookEventInfo = {
    type: 'payment_intent.payment_failed',
    orderId: 'order-1',
    paymentIntentId: 'pi_1',
  };
  const expired: WebhookEventInfo = {
    type: 'checkout.session.expired',
    orderId: 'order-1',
    sessionId: 'cs_1',
  };

  it.each(['paid', 'shipped', 'delivered', 'refunded', 'failed', 'cancelled'])(
    'late payment_failed on a %s order is a no-op',
    (status) => {
      expect(decide(failed, order(status)).action).toBe('skip');
    },
  );

  it('payment_failed on an in-flight order marks it failed', () => {
    const d = decide(failed, order('processing'));
    expect(d).toMatchObject({ action: 'update', updates: { status: 'failed' } });
  });

  it.each(['paid', 'shipped', 'delivered', 'refunded'])(
    'session expiry after the order is %s is a no-op',
    (status) => {
      expect(decide(expired, order(status)).action).toBe('skip');
    },
  );

  it('session expiry on a pending order cancels it', () => {
    const d = decide(expired, order('pending'));
    expect(d).toMatchObject({ action: 'update', updates: { status: 'cancelled' } });
  });
});

describe('refunds (M3)', () => {
  // The full/partial decision itself is made by sync_order_refunds (migration
  // 024) from every refund Stripe holds for the payment — see the rehearsal
  // scenarios there. Here: each refund event asks for that sync, whatever it
  // carries, because an order can now have several refunds.
  it.each([
    [10000, 10000],
    [2500, 10000],
  ])('charge.refunded (%i of %i) asks to mirror the payment\'s refunds', (amountRefunded, amountCharged) => {
    const d = decide({ type: 'charge.refunded', paymentIntentId: 'pi_1', amountRefunded, amountCharged }, order('paid'));
    expect(d).toEqual({ action: 'sync_refunds', paymentIntentId: 'pi_1' });
  });

  it('charge.refunded without a payment_intent is invalid', () => {
    const d = decide(
      { type: 'charge.refunded', paymentIntentId: null, amountRefunded: 10000, amountCharged: 10000 },
      order('paid'),
    );
    expect(d.action).toBe('invalid');
  });

  it.each(['pending', 'succeeded', 'failed', 'canceled'])('refund.updated (%s) asks to mirror the refunds', (status) => {
    const d = decide(
      { type: 'refund.updated', paymentIntentId: 'pi_1', refundId: 're_1', refundStatus: status, amount: 4000, createdAt: null },
      order('paid', 100),
    );
    expect(d).toEqual({ action: 'sync_refunds', paymentIntentId: 'pi_1' });
  });

  it('refund.updated without a payment_intent is invalid', () => {
    const d = decide(
      { type: 'refund.updated', paymentIntentId: null, refundId: 're_1', refundStatus: 'succeeded', amount: 1, createdAt: null },
      order('paid'),
    );
    expect(d.action).toBe('invalid');
  });
});
