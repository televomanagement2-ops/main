import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2024-06-20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

class RefundHttpError extends Error {
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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toRefundError(err: unknown): RefundHttpError {
  if (err instanceof RefundHttpError) return err;

  if (err && typeof err === 'object') {
    const maybeStripe = err as { type?: string; message?: string };
    if (typeof maybeStripe.type === 'string' && maybeStripe.type.startsWith('Stripe')) {
      return new RefundHttpError(
        502,
        'STRIPE_REFUND_ERROR',
        'stripe.refunds.create',
        maybeStripe.message || 'Stripe API call failed while creating refund.',
      );
    }
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  return new RefundHttpError(500, 'UNHANDLED_ERROR', 'unknown', message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
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
      throw new RefundHttpError(
        500,
        'CONFIG_MISSING_SECRETS',
        'config.validate_secrets',
        `Missing required Edge Function secrets: ${missing.join(', ')}`,
      );
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: STRIPE_API_VERSION });
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new RefundHttpError(401, 'AUTH_MISSING_HEADER', 'auth.validate_header', 'Missing Authorization header.');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      throw new RefundHttpError(
        401,
        'AUTH_INVALID_SESSION',
        'auth.get_user',
        `Invalid or expired session. (${authError?.message ?? 'user not found'})`,
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new RefundHttpError(500, 'DB_PROFILE_LOOKUP_ERROR', 'db.fetch_profile', profileError.message);
    }

    if (profile?.role !== 'admin') {
      throw new RefundHttpError(403, 'AUTH_NOT_ADMIN', 'auth.authorize_admin', 'Admin access required.');
    }

    const body = await req.json();
    const { order_id, amount } = body ?? {};

    if (!order_id) {
      throw new RefundHttpError(400, 'VALIDATION_MISSING_ORDER_ID', 'request.validate', 'Missing order_id.');
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, total, stripe_payment_intent_id, refund_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new RefundHttpError(404, 'ORDER_NOT_FOUND', 'db.fetch_order', 'Order not found.');
    }

    if (order.refund_id) {
      throw new RefundHttpError(409, 'ORDER_ALREADY_REFUNDED', 'refund.validate', 'Order already refunded.');
    }

    if (!order.stripe_payment_intent_id) {
      throw new RefundHttpError(
        400,
        'ORDER_MISSING_PAYMENT_INTENT',
        'refund.validate',
        'Order is missing Stripe payment intent id.',
      );
    }

    const refundableStatuses = ['paid', 'shipped', 'delivered'] as const;
    if (!refundableStatuses.includes(order.status as (typeof refundableStatuses)[number])) {
      throw new RefundHttpError(
        409,
        'ORDER_NOT_REFUNDABLE',
        'refund.validate',
        `Order status ${order.status} is not refundable.`,
      );
    }

    let refundAmount: number | null = null;
    let refundAmountCents: number | undefined;
    if (amount != null) {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new RefundHttpError(400, 'INVALID_REFUND_AMOUNT', 'refund.validate', 'Invalid refund amount.');
      }
      const rounded = Math.round(numericAmount * 100) / 100;
      if (rounded > Number(order.total)) {
        throw new RefundHttpError(400, 'REFUND_AMOUNT_TOO_HIGH', 'refund.validate', 'Refund exceeds order total.');
      }
      refundAmount = rounded;
      refundAmountCents = Math.round(rounded * 100);
    }

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
      .eq('id', order_id)
      .select('*, order_items(*), profiles(full_name, email, phone)')
      .single();

    if (updateError || !updatedOrder) {
      throw new RefundHttpError(
        500,
        'DB_ORDER_UPDATE_ERROR',
        'db.update_order',
        updateError?.message ?? 'Failed to update order after refund.',
      );
    }

    return jsonResponse({ order: updatedOrder });
  } catch (err) {
    const refundErr = toRefundError(err);
    return jsonResponse(
      {
        error: refundErr.message,
        code: refundErr.code,
        phase: refundErr.phase,
      },
      refundErr.status,
    );
  }
});
