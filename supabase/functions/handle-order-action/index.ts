import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';
const allowedOrigins = ['*']; // Replace with your frontend origin when ready.

const corsHeadersBase = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class OrderActionError extends Error {
  status: number;
  code: string;
  phase: string;

  constructor(status: number, code: string, phase: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.phase = phase;
  }
}

function getCorsHeaders(origin: string | null) {
  const allowOrigin = allowedOrigins.includes('*')
    ? '*'
    : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);

  return {
    ...corsHeadersBase,
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } as Record<string, string>;
}

function jsonResponse(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

function toOrderActionError(err: unknown): OrderActionError {
  if (err instanceof OrderActionError) return err;

  if (err && typeof err === 'object') {
    const maybeStripe = err as { type?: string; message?: string };
    if (typeof maybeStripe.type === 'string' && maybeStripe.type.startsWith('Stripe')) {
      return new OrderActionError(
        502,
        'STRIPE_REFUND_ERROR',
        'stripe.refunds.create',
        maybeStripe.message || 'Stripe API call failed while creating refund.',
      );
    }
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return new OrderActionError(500, 'UNHANDLED_ERROR', 'unknown', message);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!stripeSecret || !supabaseUrl || !serviceRoleKey || !anonKey) {
      const missing: string[] = [];
      if (!stripeSecret) missing.push('STRIPE_SECRET_KEY');
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      throw new OrderActionError(
        500,
        'CONFIG_MISSING_SECRETS',
        'config.validate_secrets',
        `Missing required Edge Function secrets: ${missing.join(', ')}`,
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new OrderActionError(401, 'AUTH_MISSING_HEADER', 'auth.validate_header', 'Missing Authorization header.');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      throw new OrderActionError(
        401,
        'AUTH_INVALID_SESSION',
        'auth.get_user',
        `Invalid or expired session. (${authError?.message ?? 'user not found'})`,
      );
    }

    const body = await req.json();
    const action = String(body?.action ?? '').trim();
    const orderId = String(body?.order_id ?? body?.orderId ?? '').trim();
    const amount = body?.amount;

    if (!action || !orderId) {
      throw new OrderActionError(400, 'VALIDATION_MISSING_FIELDS', 'request.validate', 'Missing action or order_id.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, status, total, stripe_payment_intent_id, refund_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new OrderActionError(404, 'ORDER_NOT_FOUND', 'db.fetch_order', 'Order not found.');
    }

    if (!order.stripe_payment_intent_id) {
      throw new OrderActionError(
        400,
        'ORDER_MISSING_PAYMENT_INTENT',
        'refund.validate',
        'Order is missing Stripe payment intent id.',
      );
    }

    if (order.refund_id) {
      throw new OrderActionError(409, 'ORDER_ALREADY_REFUNDED', 'refund.validate', 'Order already refunded.');
    }

    if (action === 'cancel') {
      if (order.user_id !== user.id) {
        throw new OrderActionError(403, 'AUTH_NOT_OWNER', 'auth.authorize_owner', 'Order ownership required.');
      }

      if (order.status !== 'paid') {
        throw new OrderActionError(
          409,
          'ORDER_NOT_CANCELABLE',
          'refund.validate',
          `Order status ${order.status} is not cancelable.`,
        );
      }
    }

    if (action === 'refund') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new OrderActionError(500, 'DB_PROFILE_LOOKUP_ERROR', 'db.fetch_profile', profileError.message);
      }

      if (profile?.role !== 'admin') {
        throw new OrderActionError(403, 'AUTH_NOT_ADMIN', 'auth.authorize_admin', 'Admin access required.');
      }

      const refundableStatuses = ['paid', 'shipped', 'delivered'] as const;
      if (!refundableStatuses.includes(order.status as (typeof refundableStatuses)[number])) {
        throw new OrderActionError(
          409,
          'ORDER_NOT_REFUNDABLE',
          'refund.validate',
          `Order status ${order.status} is not refundable.`,
        );
      }
    }

    if (action !== 'cancel' && action !== 'refund') {
      throw new OrderActionError(400, 'VALIDATION_UNKNOWN_ACTION', 'request.validate', 'Unknown action.');
    }

    let refundAmount: number | null = null;
    let refundAmountCents: number | undefined;
    if (action === 'refund' && amount != null) {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new OrderActionError(400, 'INVALID_REFUND_AMOUNT', 'refund.validate', 'Invalid refund amount.');
      }
      const rounded = Math.round(numericAmount * 100) / 100;
      if (rounded > Number(order.total)) {
        throw new OrderActionError(400, 'REFUND_AMOUNT_TOO_HIGH', 'refund.validate', 'Refund exceeds order total.');
      }
      refundAmount = rounded;
      refundAmountCents = Math.round(rounded * 100);
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      ...(refundAmountCents ? { amount: refundAmountCents } : {}),
    });

    const refundValue = refundAmount ?? Math.round((refund.amount ?? 0) / 100 * 100) / 100;
    const updatePayload: Record<string, unknown> = {
      refund_id: refund.id,
      refund_amount: refundValue,
    };

    if (refund.status === 'succeeded') {
      const refundedAt = refund.created
        ? new Date(refund.created * 1000).toISOString()
        : new Date().toISOString();
      updatePayload.refunded_at = refundedAt;
      updatePayload.status = 'refunded';
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select('*, order_items(*), profiles(full_name, email, phone)')
      .single();

    if (updateError || !updatedOrder) {
      throw new OrderActionError(
        500,
        'DB_ORDER_UPDATE_ERROR',
        'db.update_order',
        updateError?.message ?? 'Failed to update order after refund.',
      );
    }

    return jsonResponse({ order: updatedOrder }, 200, origin);
  } catch (err) {
    const actionErr = toOrderActionError(err);
    return jsonResponse(
      {
        error: actionErr.message,
        code: actionErr.code,
        phase: actionErr.phase,
      },
      actionErr.status,
      origin,
    );
  }
});
