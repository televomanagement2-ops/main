import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = ['*']; // Replace with your frontend origin when ready.

const corsHeadersBase = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

async function sendResendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Resend error: ${errorText || res.statusText}`);
  }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'ShopBase <support@shopbase.com>';

    if (!supabaseUrl || !serviceRoleKey || !anonKey || !resendApiKey) {
      const missing: string[] = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      if (!resendApiKey) missing.push('RESEND_API_KEY');
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
    const status = String(body?.status ?? '').trim();

    if (!orderId || !trackingId || !status) {
      return jsonResponse({ error: 'Missing orderId, trackingId, or status.' }, 400, origin);
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

    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_id: trackingId,
        tracking_updated_at: new Date().toISOString(),
        status,
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
      const { data: customer, error: customerError } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', updated.user_id)
        .single();

      if (customerError || !customer?.email) {
        return jsonResponse({ error: 'Customer email not available.' }, 400, origin);
      }

      customerEmail = customer.email;
      customerName = customerName ?? customer.full_name;
    }

    const shipping = updated.shipping_address as Record<string, string> | null;
    const displayName = customerName ?? shipping?.full_name ?? 'Customer';
    const subject = 'Your order is on the way';
    const text = `Hi ${displayName},\n\nYour order ${updated.id} has shipped.\nTracking ID: ${trackingId}\n\nThanks for shopping with us.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <p>Hi ${displayName},</p>
        <p>Your order <strong>${updated.id}</strong> has shipped.</p>
        <p><strong>Tracking ID:</strong> ${trackingId}</p>
        <p>Thanks for shopping with us.</p>
      </div>
    `;

    await sendResendEmail({
      apiKey: resendApiKey,
      from: resendFrom,
      to: customerEmail,
      subject,
      html,
      text,
    });

    return jsonResponse({ order: updated }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse({ error: message }, 500, origin);
  }
});
