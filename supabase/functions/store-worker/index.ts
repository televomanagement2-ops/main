// ─────────────────────────────────────────────────────────────────────────────
// store-worker — the store's scheduled emails (migration 023):
//   back_in_stock  "It's back" to everyone who asked, once the item has stock
//   low_stock      a digest to the admins of items that just dropped to or
//                  under their threshold (each item once per drop)
//
// Called by pg_cron through pg_net with the x-worker-secret header (the same
// value as the STORE_WORKER_SECRET secret and the store_worker_secret Vault
// entry), or by an admin from the app ("Send now"), with their session.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { renderEmail, escapeHtml, formatMoney, STORE_NAME, STORE_LOCALE } from '../_shared/store.ts';
import { sendEmail } from '../_shared/email.ts';
import { getCorsHeaders, isForbiddenOrigin } from '../_shared/cors.ts';

const TASKS = ['back_in_stock', 'low_stock', 'all'] as const;
type Task = (typeof TASKS)[number];

// Leave room under the platform's wall-clock limit; the next run picks up
// whatever is left.
const TIME_BUDGET_MS = 40_000;
const BATCH = 50;

type Lang = 'en' | 'it' | 'es' | 'fr';

const BACK_IN_STOCK: Record<Lang, {
  subject: (name: string) => string;
  eyebrow: string;
  heading: string;
  body: (item: string) => string;
  cta: string;
  footer: string;
}> = {
  en: {
    subject: (name) => `Back in stock: ${name}`,
    eyebrow: 'Back in stock',
    heading: 'Good news — it’s back.',
    body: (item) => `${item} is available again. Stock is limited, so it may not last long.`,
    cta: 'Shop now',
    footer: 'You asked us to tell you when this item was back. This is the only email we send about it.',
  },
  it: {
    subject: (name) => `Di nuovo disponibile: ${name}`,
    eyebrow: 'Di nuovo disponibile',
    heading: 'Buone notizie: è tornato.',
    body: (item) => `${item} è di nuovo disponibile. Le quantità sono limitate, quindi potrebbe esaurirsi presto.`,
    cta: 'Acquista ora',
    footer: 'Ci avevi chiesto di avvisarti quando questo articolo fosse tornato disponibile. È l’unica email che ti inviamo al riguardo.',
  },
  es: {
    subject: (name) => `De nuevo disponible: ${name}`,
    eyebrow: 'De nuevo disponible',
    heading: 'Buenas noticias: ha vuelto.',
    body: (item) => `${item} vuelve a estar disponible. Las unidades son limitadas, así que podría agotarse pronto.`,
    cta: 'Comprar ahora',
    footer: 'Nos pediste que te avisáramos cuando este artículo volviera. Es el único correo que te enviamos al respecto.',
  },
  fr: {
    subject: (name) => `De retour en stock : ${name}`,
    eyebrow: 'De retour en stock',
    heading: 'Bonne nouvelle : il est de retour.',
    body: (item) => `${item} est de nouveau disponible. Les quantités sont limitées, il pourrait partir vite.`,
    cta: 'Acheter maintenant',
    footer: 'Vous nous aviez demandé de vous prévenir du retour de cet article. C’est le seul e-mail que nous vous envoyons à ce sujet.',
  },
};

const LOW_STOCK: Record<Lang, {
  subject: (count: number) => string;
  heading: string;
  intro: string;
  out: string;
  left: (n: number) => string;
  cta: string;
}> = {
  en: {
    subject: (n) => `${n} item${n === 1 ? '' : 's'} running low`,
    heading: 'Stock is running low',
    intro: 'These items have just dropped to or below their low-stock threshold:',
    out: 'sold out',
    left: (n) => `${n} left`,
    cta: 'Open inventory',
  },
  it: {
    subject: (n) => `${n} ${n === 1 ? 'articolo' : 'articoli'} in esaurimento`,
    heading: 'Scorte in esaurimento',
    intro: 'Questi articoli sono appena scesi alla soglia di scorta minima o sotto:',
    out: 'esaurito',
    left: (n) => `${n} rimasti`,
    cta: 'Apri il magazzino',
  },
  es: {
    subject: (n) => `${n} ${n === 1 ? 'artículo' : 'artículos'} con pocas existencias`,
    heading: 'Existencias bajas',
    intro: 'Estos artículos acaban de llegar a su umbral de existencias mínimas o por debajo:',
    out: 'agotado',
    left: (n) => `quedan ${n}`,
    cta: 'Abrir inventario',
  },
  fr: {
    subject: (n) => `${n} article${n === 1 ? '' : 's'} bientôt épuisé${n === 1 ? '' : 's'}`,
    heading: 'Stock bientôt épuisé',
    intro: 'Ces articles viennent d’atteindre leur seuil de stock bas, ou de passer en dessous :',
    out: 'épuisé',
    left: (n) => `${n} restant${n === 1 ? '' : 's'}`,
    cta: 'Ouvrir l’inventaire',
  },
};

const asLang = (value: string | null | undefined): Lang => {
  const code = String(value ?? '').slice(0, 2).toLowerCase();
  return code === 'it' || code === 'es' || code === 'fr' ? code : 'en';
};

/** The storefront's public address, for links in emails. */
function siteUrl(): string | null {
  const explicit = (Deno.env.get('SITE_URL') ?? '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const first = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .find((o) => /^https?:\/\/[^*]+$/.test(o));
  return first ? first.replace(/\/+$/, '') : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function jsonResponse(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// The functions' clients are untyped (no generated types in Deno).
/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore no-explicit-any
type Client = SupabaseClient<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface ClaimedRequest {
  id: string;
  email: string;
  locale: string;
  product_name: string;
  slug: string;
  variant_label: string | null;
  image_url: string | null;
  price: number | null;
}

async function sendBackInStock(client: Client, deadline: number) {
  const site = siteUrl();
  let sent = 0;
  let failed = 0;

  while (Date.now() < deadline) {
    const { data, error } = await client.rpc('claim_stock_notifications', { p_limit: BATCH });
    if (error) throw new Error(`claim_stock_notifications: ${error.message}`);
    const batch = (data ?? []) as ClaimedRequest[];
    if (batch.length === 0) break;

    const failedIds: string[] = [];
    for (const request of batch) {
      const copy = BACK_IN_STOCK[asLang(request.locale)];
      const item = request.variant_label
        ? `${request.product_name} (${request.variant_label})`
        : request.product_name;
      const link = site ? `${site}/products/${encodeURIComponent(request.slug)}` : null;
      try {
        await sendEmail({
          to: request.email,
          subject: copy.subject(request.product_name),
          html: renderEmail({
            eyebrow: copy.eyebrow,
            heading: copy.heading,
            bodyHtml: `
              ${request.image_url ? `<img src="${escapeHtml(request.image_url)}" alt="" width="160" style="display:block; width:160px; max-width:100%; border-radius:4px; margin:0 0 20px;" />` : ''}
              <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 8px;">${escapeHtml(copy.body(item))}</p>
              ${request.price != null ? `<p style="font-size: 15px; color: #111; font-weight: 700; margin: 0 0 20px;">${formatMoney(Number(request.price))}</p>` : ''}
              ${link ? `<p style="margin: 0 0 24px;"><a href="${escapeHtml(link)}" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:12px 22px; border-radius:4px; font-size:14px;">${escapeHtml(copy.cta)}</a></p>` : ''}
              <p style="font-size: 12px; color: #888; line-height: 1.6; margin: 0;">${escapeHtml(copy.footer)}</p>
            `,
          }),
          text: `${copy.body(item)}${link ? `\n\n${copy.cta}: ${link}` : ''}\n\n${copy.footer}\n\n${STORE_NAME}`,
        });
        sent += 1;
      } catch (err) {
        console.error(`[store-worker] back-in-stock email to request ${request.id} failed:`, err);
        failedIds.push(request.id);
      }
    }

    // Unsent requests go back in the queue for the next run.
    if (failedIds.length > 0) {
      failed += failedIds.length;
      const { error: releaseError } = await client.rpc('release_stock_notifications', { p_ids: failedIds });
      if (releaseError) console.error('[store-worker] release failed:', releaseError.message);
      break;
    }
    if (batch.length < BATCH) break;
  }

  return { sent, failed };
}

interface LowStockItem {
  product_id: string;
  product_name: string;
  slug: string;
  variant_id: string | null;
  variant_label: string | null;
  sku: string | null;
  stock: number;
  threshold: number;
}

async function sendLowStockDigest(client: Client) {
  const { data, error } = await client.rpc('low_stock_digest_candidates');
  if (error) throw new Error(`low_stock_digest_candidates: ${error.message}`);
  const digest = (data ?? {}) as { enabled?: boolean; recipients?: string[]; items?: LowStockItem[] };

  const items = digest.items ?? [];
  const recipients = (digest.recipients ?? []).filter(Boolean);
  if (!digest.enabled) return { items: items.length, sent: 0, skipped: 'disabled' };
  if (items.length === 0) return { items: 0, sent: 0 };
  if (recipients.length === 0) return { items: items.length, sent: 0, skipped: 'no_recipients' };

  const copy = LOW_STOCK[asLang(STORE_LOCALE)];
  const site = siteUrl();
  const rows = items
    .map((item) => {
      const name = item.variant_label ? `${item.product_name} — ${item.variant_label}` : item.product_name;
      const level = item.stock <= 0 ? copy.out : copy.left(item.stock);
      return `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #222; border-bottom: 1px solid #eee;">${escapeHtml(name)}${item.sku ? `<br><span style="font-size:12px; color:#888; font-family:monospace;">${escapeHtml(item.sku)}</span>` : ''}</td>
          <td style="padding: 8px 0; font-size: 14px; text-align: right; border-bottom: 1px solid #eee; color: ${item.stock <= 0 ? '#b42318' : '#b54708'}; white-space: nowrap;">${escapeHtml(level)}</td>
        </tr>`;
    })
    .join('');
  const textRows = items
    .map((item) => `- ${item.product_name}${item.variant_label ? ` — ${item.variant_label}` : ''}: ${item.stock <= 0 ? copy.out : copy.left(item.stock)}`)
    .join('\n');
  const link = site ? `${site}/admin/inventory` : null;

  let sent = 0;
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: `${STORE_NAME}: ${copy.subject(items.length)}`,
        html: renderEmail({
          eyebrow: STORE_NAME,
          heading: copy.heading,
          bodyHtml: `
            <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">${escapeHtml(copy.intro)}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">${rows}</table>
            ${link ? `<p style="margin: 0;"><a href="${escapeHtml(link)}" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:12px 22px; border-radius:4px; font-size:14px;">${escapeHtml(copy.cta)}</a></p>` : ''}
          `,
        }),
        text: `${copy.intro}\n\n${textRows}${link ? `\n\n${copy.cta}: ${link}` : ''}`,
      });
      sent += 1;
    } catch (err) {
      console.error(`[store-worker] low-stock digest to ${to} failed:`, err);
    }
  }

  // Remembered only once someone actually got the email: a failed send is
  // retried on the next run.
  if (sent > 0) {
    const { error: markError } = await client.rpc('mark_low_stock_alerted', {
      p_items: items.map((item) => ({ product_id: item.product_id, variant_id: item.variant_id })),
    });
    if (markError) console.error('[store-worker] mark_low_stock_alerted failed:', markError.message);
  }
  return { items: items.length, sent };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Missing Supabase secrets.' }, 500, origin);
  }

  // ── Who is calling: the scheduler (shared secret) or an admin (session).
  const workerSecret = Deno.env.get('STORE_WORKER_SECRET') ?? '';
  const givenSecret = req.headers.get('x-worker-secret') ?? '';
  let authorized = workerSecret.length >= 16 && givenSecret !== '' && timingSafeEqual(workerSecret, givenSecret);

  if (!authorized) {
    if (isForbiddenOrigin(origin)) {
      return jsonResponse({ error: 'Origin not allowed.', code: 'ORIGIN_NOT_ALLOWED' }, 403, origin);
    }
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!token) {
      return jsonResponse({ error: 'Unauthorized.', code: 'AUTH_MISSING' }, 401, origin);
    }
    const { data: { user } } = await createClient(supabaseUrl, anonKey).auth.getUser(token);
    if (!user) {
      return jsonResponse({ error: 'Invalid or expired session.', code: 'AUTH_INVALID_SESSION' }, 401, origin);
    }
    const service = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.', code: 'AUTH_NOT_ADMIN' }, 403, origin);
    }
    authorized = true;
  }

  let task: Task = 'all';
  try {
    const body = await req.json();
    if (TASKS.includes(body?.task)) task = body.task;
  } catch {
    // No body: run everything.
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const deadline = Date.now() + TIME_BUDGET_MS;
  const result: Record<string, unknown> = { task };

  try {
    if (task === 'back_in_stock' || task === 'all') {
      result.backInStock = await sendBackInStock(client, deadline);
    }
    if (task === 'low_stock' || task === 'all') {
      result.lowStock = await sendLowStockDigest(client);
    }
    return jsonResponse(result, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Worker failed';
    console.error('[store-worker]', message);
    return jsonResponse({ ...result, error: message }, 500, origin);
  }
});
