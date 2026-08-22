import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderEmail, escapeHtml, STORE_NAME } from '../_shared/store.ts';
import { getCorsHeaders, isForbiddenOrigin } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/email.ts';

function jsonResponse(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  // Fail closed on an unauthorized browser origin rather than doing the work
  // and only withholding the CORS header (matches create-checkout-session).
  if (isForbiddenOrigin(origin)) {
    return jsonResponse({
      error: 'Origin not allowed.',
      code: 'ORIGIN_NOT_ALLOWED',
    }, 403, origin);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      return jsonResponse({
        error: `Missing required Edge Function secrets: ${missing.join(', ')}`,
        code: 'CONFIG_MISSING_SECRETS',
      }, 500, origin);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header.' }, 401, origin);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({
        error: `Invalid or expired session. (${authError?.message ?? 'user not found'})`,
      }, 401, origin);
    }

    const body = await req.json();
    const orderId = String(body?.orderId ?? body?.order_id ?? '').trim();
    const trackingId = String(body?.trackingId ?? body?.tracking_id ?? '').trim();

    if (!orderId || !trackingId) {
      return jsonResponse({ error: 'Missing orderId or trackingId.' }, 400, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500, origin);
    }

    if (profile?.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, origin);
    }

    // Adding tracking means the order shipped — the status is never taken from
    // the client (an arbitrary client status could corrupt the order lifecycle).
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_id: trackingId,
        tracking_updated_at: new Date().toISOString(),
        status: 'shipped',
      })
      .eq('id', orderId)
      .select('*, order_items(*), profiles(full_name, email, phone)')
      .single();

    if (updateError) {
      const statusCode = updateError.code === 'P0001' ? 400 : 500;
      return jsonResponse({ error: updateError.message }, statusCode, origin);
    }

    if (!updated) {
      return jsonResponse({ error: 'Order not found.' }, 404, origin);
    }

    let customerEmail = updated.profiles?.email ?? null;
    let customerName = updated.profiles?.full_name ?? null;
    if (!customerEmail) {
      const { data: customer } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', updated.user_id)
        .single();

      customerEmail = customer?.email ?? null;
      customerName = customerName ?? customer?.full_name ?? null;
    }

    // Shipping email is fire-and-forget: the order is already committed as
    // shipped, so a Resend failure must not turn the response into an error
    // (the admin would retry and hit the shipped→shipped no-op confusingly).
    if (customerEmail) {
      const shipping = updated.shipping_address as Record<string, string> | null;
      const displayName = customerName ?? shipping?.full_name ?? 'Customer';

      sendEmail({
        to: customerEmail,
        subject: 'Your order is on the way',
        html: renderEmail({
          eyebrow: 'Order shipped',
          heading: `Your order is on the way, ${escapeHtml(displayName)}.`,
          bodyHtml: `
            <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
              Good news — order <strong>${escapeHtml(String(updated.id))}</strong> has shipped.
            </p>
            <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0;">
              <strong>Tracking ID:</strong> ${escapeHtml(trackingId)}
            </p>
          `,
        }),
        text: `Hi ${displayName},\n\nYour order ${updated.id} has shipped.\nTracking ID: ${trackingId}\n\nThanks for shopping with ${STORE_NAME}.`,
      }).catch((emailErr) => {
        console.error('Shipping email failed (non-blocking):', emailErr);
      });
    } else {
      console.warn(`[update-tracking] order ${orderId}: no customer email — skipping notification`);
    }

    return jsonResponse({ order: updated }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse({ error: message }, 500, origin);
  }
});
