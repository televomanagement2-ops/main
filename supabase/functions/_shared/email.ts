// ─────────────────────────────────────────────────────────────────────────────
// Shared transactional-email sender (Resend). Used by stripe-webhook,
// handle-order-action and update-tracking so the Resend POST isn't duplicated
// in every function.
// ─────────────────────────────────────────────────────────────────────────────

import { FROM_EMAIL } from './store.ts';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${params.subject}"`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Resend error: ${errorText || res.statusText}`);
  }
}
