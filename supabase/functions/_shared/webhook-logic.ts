// ─────────────────────────────────────────────────────────────────────────────
// Pure decision logic for the Stripe webhook: (event summary + current order
// state) → what to write on the order. No Deno / Stripe / Supabase imports so
// the transition matrix is unit-testable from vitest.
//
// Invariants encoded here:
//   • A paid order is NEVER downgraded by late failure/expiry events (M2).
//   • Partial refunds record refund fields but keep the order 'paid' (M3).
//   • checkout.session.completed / payment_intent.succeeded adopt Stripe's
//     charged amount as the authoritative total.
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderState {
  id: string;
  status: string;
  total: number | null;
}

export type WebhookEventInfo =
  | {
      type: 'checkout.session.completed';
      orderId: string | null;
      sessionId: string | null;
      paymentIntentId: string | null;
      paymentStatus: string;
      amountTotal: number | null; // cents
      amountTax: number | null; // cents
    }
  | {
      type: 'payment_intent.succeeded';
      orderId: string | null;
      paymentIntentId: string;
      amountReceived: number | null; // cents
    }
  | { type: 'payment_intent.payment_failed'; orderId: string | null; paymentIntentId: string }
  | { type: 'checkout.session.expired'; orderId: string | null; sessionId: string | null }
  | {
      type: 'charge.refunded';
      paymentIntentId: string | null;
      amountRefunded: number; // cents
      amountCharged: number; // cents
    }
  | {
      type: 'refund.updated';
      paymentIntentId: string | null;
      refundId: string;
      refundStatus: string;
      amount: number; // cents
      createdAt: string | null;
    };

export type Decision =
  | { action: 'skip'; reason: string }
  | { action: 'update'; updates: Record<string, unknown>; sendConfirmationEmail?: boolean }
  | { action: 'invalid'; reason: string };

/** Order statuses another event already finalized — never downgraded. */
export const FINAL_STATUSES = ['paid', 'shipped', 'delivered', 'refunded'];

/** Statuses a payment outcome (paid/failed/cancelled) may still be applied to. */
export const PRE_PAYMENT_STATUSES = ['pending', 'processing', 'requires_action'];

export const dollars = (cents: number) => Math.round(cents) / 100;

export function decide(info: WebhookEventInfo, order: OrderState | null): Decision {
  switch (info.type) {
    case 'checkout.session.completed': {
      if (!info.orderId && !info.sessionId) {
        return { action: 'invalid', reason: 'missing order_id and session.id' };
      }
      const isPaid =
        info.paymentStatus === 'paid' || info.paymentStatus === 'no_payment_required';
      const alreadyFinal = !!order && FINAL_STATUSES.includes(order.status);

      const updates: Record<string, unknown> = {};
      if (info.paymentIntentId) updates.stripe_payment_intent_id = info.paymentIntentId;
      if (info.sessionId) updates.stripe_session_id = info.sessionId;

      // Don't downgrade an order another event already finalized; only set
      // status while it's still pre-payment.
      if (!alreadyFinal) {
        updates.status = isPaid ? 'paid' : 'requires_action';
        if (isPaid && info.amountTotal != null) {
          // Line items were built server-side from DB prices, so the charged
          // amount can't be tampered; with Stripe Tax this is where the real
          // per-jurisdiction tax lands on the order.
          updates.total = dollars(info.amountTotal);
          if (info.amountTax != null) updates.tax_amount = dollars(info.amountTax);
        }
      }

      return {
        action: 'update',
        updates,
        sendConfirmationEmail: isPaid && !alreadyFinal,
      };
    }

    case 'payment_intent.succeeded': {
      // Backup confirmation: checkout.session.completed normally owns the paid
      // transition; here we always record the payment_intent id, and only mark
      // paid if no other event already finalized the order.
      const alreadyFinal = !!order && FINAL_STATUSES.includes(order.status);
      const updates: Record<string, unknown> = {
        stripe_payment_intent_id: info.paymentIntentId,
      };
      if (!alreadyFinal) {
        updates.status = 'paid';
        if (info.amountReceived != null) updates.total = dollars(info.amountReceived);
      }
      return { action: 'update', updates, sendConfirmationEmail: !alreadyFinal };
    }

    case 'payment_intent.payment_failed': {
      // Late failure events must never downgrade an order that is already
      // final (paid/refunded/…) or terminal (failed/cancelled).
      if (order && !PRE_PAYMENT_STATUSES.includes(order.status)) {
        return { action: 'skip', reason: `order already ${order.status}` };
      }
      return {
        action: 'update',
        updates: { status: 'failed', stripe_payment_intent_id: info.paymentIntentId },
      };
    }

    case 'checkout.session.expired': {
      if (!info.orderId && !info.sessionId) {
        return { action: 'invalid', reason: 'missing order_id and session.id' };
      }
      if (order && !PRE_PAYMENT_STATUSES.includes(order.status)) {
        return { action: 'skip', reason: `order already ${order.status}` };
      }
      return { action: 'update', updates: { status: 'cancelled' } };
    }

    case 'charge.refunded': {
      if (!info.paymentIntentId) {
        return { action: 'invalid', reason: 'charge.refunded missing payment_intent' };
      }
      const updates: Record<string, unknown> = {
        refund_amount: dollars(info.amountRefunded),
        refunded_at: new Date().toISOString(),
      };
      // Only a FULL refund moves the order to 'refunded' (and restores stock);
      // a partial refund keeps the order fulfillable.
      if (info.amountRefunded >= info.amountCharged) {
        updates.status = 'refunded';
      }
      return { action: 'update', updates };
    }

    case 'refund.updated': {
      if (info.refundStatus !== 'succeeded') {
        return { action: 'skip', reason: `refund status ${info.refundStatus}` };
      }
      if (!info.paymentIntentId) {
        return { action: 'invalid', reason: 'refund.updated missing payment_intent' };
      }
      const refundAmount = dollars(info.amount);
      const updates: Record<string, unknown> = {
        refund_id: info.refundId,
        refund_amount: refundAmount,
        refunded_at: info.createdAt ?? new Date().toISOString(),
      };
      // This event carries a single refund's amount (not the cumulative
      // refunded total), so only mark 'refunded' when it covers the order.
      if (order?.total != null && refundAmount >= order.total - 0.005) {
        updates.status = 'refunded';
      }
      return { action: 'update', updates };
    }
  }
}
