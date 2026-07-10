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
  it('full charge.refunded moves the order to refunded', () => {
    const d = decide(
      { type: 'charge.refunded', paymentIntentId: 'pi_1', amountRefunded: 10000, amountCharged: 10000 },
      order('paid'),
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('refunded');
    expect(d.updates.refund_amount).toBe(100);
  });

  it('PARTIAL charge.refunded records the amount but keeps the order paid', () => {
    const d = decide(
      { type: 'charge.refunded', paymentIntentId: 'pi_1', amountRefunded: 2500, amountCharged: 10000 },
      order('paid'),
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBeUndefined();
    expect(d.updates.refund_amount).toBe(25);
  });

  it('charge.refunded without a payment_intent is invalid', () => {
    const d = decide(
      { type: 'charge.refunded', paymentIntentId: null, amountRefunded: 10000, amountCharged: 10000 },
      order('paid'),
    );
    expect(d.action).toBe('invalid');
  });

  it('refund.updated ignores non-succeeded refunds', () => {
    const d = decide(
      { type: 'refund.updated', paymentIntentId: 'pi_1', refundId: 're_1', refundStatus: 'pending', amount: 10000, createdAt: null },
      order('paid'),
    );
    expect(d.action).toBe('skip');
  });

  it('refund.updated covering the full total marks refunded', () => {
    const d = decide(
      { type: 'refund.updated', paymentIntentId: 'pi_1', refundId: 're_1', refundStatus: 'succeeded', amount: 10000, createdAt: '2026-01-01T00:00:00Z' },
      order('paid', 100),
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBe('refunded');
    expect(d.updates.refund_id).toBe('re_1');
    expect(d.updates.refunded_at).toBe('2026-01-01T00:00:00Z');
  });

  it('partial refund.updated keeps the order status untouched', () => {
    const d = decide(
      { type: 'refund.updated', paymentIntentId: 'pi_1', refundId: 're_1', refundStatus: 'succeeded', amount: 4000, createdAt: null },
      order('paid', 100),
    );
    if (d.action !== 'update') throw new Error('expected update');
    expect(d.updates.status).toBeUndefined();
    expect(d.updates.refund_amount).toBe(40);
  });
});
