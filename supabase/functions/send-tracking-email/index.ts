import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'CommerceJet <support@commercejet.com>';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!resendApiKey || !supabaseUrl || !serviceRoleKey || !anonKey) {
      const missing: string[] = [];
      if (!resendApiKey) missing.push('RESEND_API_KEY');
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      return jsonResponse({
        error: `Missing required Edge Function secrets: ${missing.join(', ')}`,
        code: 'CONFIG_MISSING_SECRETS',
      }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header.' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired session.' }, 401);
    }

    const body = await req.json();
    const orderId = String(body.order_id ?? '').trim();
    const trackingId = String(body.tracking_id ?? '').trim();
    if (!orderId || !trackingId) {
      return jsonResponse({ error: 'Missing order_id or tracking_id.' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403);
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, user_id, shipping_address, total, created_at')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: 'Order not found.' }, 404);
    }

    if (order.status !== 'paid') {
      return jsonResponse({ error: 'Tracking can only be added to paid orders.' }, 409);
    }

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

    if (updateError || !updated) {
      return jsonResponse({ error: 'Failed to update order.' }, 500);
    }

    const { data: customer, error: customerError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', order.user_id)
      .single();

    if (customerError || !customer?.email) {
      return jsonResponse({ error: 'Customer email not available.' }, 400);
    }

    const shipping = order.shipping_address as Record<string, string> | null;
    const customerName = customer.full_name ?? shipping?.full_name ?? 'Customer';

    const subject = 'Your order is on the way';
    const text = `Hi ${customerName},\n\nYour order ${order.id} has shipped.\nTracking ID: ${trackingId}\n\nThanks for shopping with us.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <p>Hi ${customerName},</p>
        <p>Your order <strong>${order.id}</strong> has shipped.</p>
        <p><strong>Tracking ID:</strong> ${trackingId}</p>
        <p>Thanks for shopping with us.</p>
      </div>
    `;

    await sendResendEmail({
      apiKey: resendApiKey,
      from: resendFrom,
      to: customer.email,
      subject,
      html,
      text,
    });

    return jsonResponse({ order: updated }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
