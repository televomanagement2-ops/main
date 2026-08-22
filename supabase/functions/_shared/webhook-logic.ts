// ─────────────────────────────────────────────────────────────────────────────
// Pure decision logic for the Stripe webhook: (event summary + current order
// state) → what to write on the order. No Deno / Stripe / Supabase imports so
// the transition matrix is unit-testable from vitest.
//
// Invariants encoded here:
//   • A paid order is NEVER downgraded by late failure/expiry events (M2).
//   • Partial refunds record refund fields but keep the order 'paid' (M3).
//   • checkout.session.completed / payment_intent.succeeded adopt Stripe's
//     charged amount as the authoritative total — but ONLY after it reconciles
//     against the total we recorded when the session was created (M4). An
//     order whose charge does not match is held in 'requires_action' and
//     flagged needs_review instead of being marked paid, so an underpayment
//     can never be silently auto-fulfilled (and can never rewrite the recorded
//     total down to match itself).
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

export interface DecideOptions {
  /**
   * Mirrors STRIPE_TAX_ENABLED in create-checkout-session. When Stripe Tax is
   * on, the order is recorded with tax_amount = 0 and Stripe adds the real
   * per-jurisdiction tax at payment — so the charged amount legitimately
   * exceeds the recorded total by exactly that tax. Reconciliation has to know
   * which mode created the session or every taxed order looks like a mismatch.
   */
  stripeTaxEnabled?: boolean;
}

/** Order statuses another event already finalized — never downgraded. */
export const FINAL_STATUSES = ['paid', 'shipped', 'delivered', 'refunded'];

/** Statuses a payment outcome (paid/failed/cancelled) may still be applied to. */
export const PRE_PAYMENT_STATUSES = ['pending', 'processing', 'requires_action'];

export const dollars = (cents: number) => Math.round(cents) / 100;

/**
 * A single cent of slack absorbs rounding noise without hiding a real
 * discrepancy. Everything below compares INTEGER CENTS: doing this in dollars
 * makes the tolerance itself unreliable, because 100.01 - 100 evaluates to
 * 0.010000000000005 in IEEE-754 and trips a `> 0.01` check.
 */
export const AMOUNT_TOLERANCE_CENTS = 1;

/**
 * Compare what Stripe actually charged against the total recorded when the
 * checkout session was created. Returns a human-readable reason on mismatch,
 * or null when the amounts reconcile (or there is nothing to compare against).
 */
export function reconcileAmount(
  chargedCents: number | null,
  order: OrderState | null,
  opts: DecideOptions,
  taxCents: number | null,
): string | null {
  if (chargedCents == null) return null;
  if (!order || order.total == null) return null; // no recorded total to check

  const charged = Math.round(chargedCents);
  const recorded = Math.round(order.total * 100);

  if (opts.stripeTaxEnabled) {
    // Tax was not in the recorded total. When the event carries the tax figure
    // we can subtract it and compare exactly.
    if (taxCents != null) {
      const exTax = charged - Math.round(taxCents);
      if (Math.abs(exTax - recorded) > AMOUNT_TOLERANCE_CENTS) {
        return `charged ${dollars(charged)} less tax ${dollars(taxCents)} = ${dollars(exTax)}, recorded ${order.total}`;
      }
      return null;
    }
    // payment_intent.succeeded carries no tax breakdown. Tax can only ever ADD
    // to the total, so the one thing we can still assert is that Stripe never
    // collected LESS than we recorded.
    if (charged < recorded - AMOUNT_TOLERANCE_CENTS) {
      return `charged ${dollars(charged)} is less than recorded ${order.total}`;
    }
    return null;
  }

  // Flat-rate mode: tax is an explicit line item, so the charge must match the
  // recorded total to the cent.
  if (Math.abs(charged - recorded) > AMOUNT_TOLERANCE_CENTS) {
    return `charged ${dollars(charged)}, recorded ${order.total}`;
  }
  return null;
}

/** Hold an order for manual review instead of marking it paid. */
function holdForReview(
  updates: Record<string, unknown>,
  reason: string,
): Decision {
  return {
    action: 'update',
    updates: {
      ...updates,
      status: 'requires_action',
      needs_review: true,
      review_reason: `amount mismatch: ${reason}`.slice(0, 500),
    },
    sendConfirmationEmail: false,
  };
}

export function decide(
  info: WebhookEventInfo,
  order: OrderState | null,
  opts: DecideOptions = {},
): Decision {
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
        if (isPaid) {
          // Reconcile BEFORE adopting. Adopting first would rewrite the
          // recorded total to match an underpayment and conceal it.
          const mismatch = reconcileAmount(info.amountTotal, order, opts, info.amountTax);
          if (mismatch) return holdForReview(updates, mismatch);

          updates.status = 'paid';
          if (info.amountTotal != null) {
            // Reconciled: Stripe's figure is now the authoritative total, and
            // with Stripe Tax this is where the real per-jurisdiction tax
            // lands on the order.
            updates.total = dollars(info.amountTotal);
            if (info.amountTax != null) updates.tax_amount = dollars(info.amountTax);
          }
        } else {
          updates.status = 'requires_action';
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
        // No tax breakdown on this event — reconcileAmount falls back to the
        // "never charged less than recorded" assertion under Stripe Tax.
        const mismatch = reconcileAmount(info.amountReceived, order, opts, null);
        if (mismatch) return holdForReview(updates, mismatch);

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
