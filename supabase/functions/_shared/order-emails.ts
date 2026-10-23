// ─────────────────────────────────────────────────────────────────────────────
// Customer emails about an order, shared by the functions that can trigger
// them: the order confirmation is sent by stripe-webhook and, when an admin
// recovers a payment the webhook missed, by handle-order-action.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { formatMoney, renderEmail, escapeHtml, STORE_NAME } from './store.ts';
import { sendEmail } from './email.ts';

// The functions' clients are untyped (no generated types in Deno).
/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore no-explicit-any
type Client = SupabaseClient<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Order confirmation email. Callers fire and forget it. */
export async function sendOrderConfirmationEmail(client: Client, orderId: string) {
  const { data: order, error } = await client
    .from('orders')
    .select(
      // The `!orders_user_id_fkey` hint is required, not decorative: orders
      // references profiles twice (user_id and refund_requested_by, migration
      // 017) and PostgREST rejects an ambiguous embed — which silently killed
      // every order confirmation email.
      'id, total, shipping_cost, discount_amount, discount_code, shipping_method_name, order_items(product_name, quantity, unit_price, selected_size, selected_color), profiles!orders_user_id_fkey(email, full_name)',
    )
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw new Error(`Confirmation email lookup failed: ${error?.message ?? 'order not found'}`);
  }

  const profile = order.profiles as { email?: string; full_name?: string } | null;
  const customerEmail = profile?.email;
  if (!customerEmail) {
    console.warn(`[email] order ${orderId}: no customer email — skipping confirmation`);
    return;
  }

  const customerName = profile?.full_name || 'there';
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const items = (order.order_items ?? []) as Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    selected_size: string | null;
    selected_color: string | null;
  }>;

  const lineName = (item: (typeof items)[number]) => {
    const option = [item.selected_color, item.selected_size].filter(Boolean).join(' / ');
    return option ? `${item.product_name} (${option})` : item.product_name;
  };
  const discount = Number(order.discount_amount ?? 0);
  const discountLabel = order.discount_code ? `Discount (${order.discount_code})` : 'Discount';

  const itemRowsHtml = items
    .map((item) => `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #444;">${escapeHtml(lineName(item))} × ${item.quantity}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #444; text-align: right;">${formatMoney(Number(item.unit_price) * item.quantity)}</td>
        </tr>`)
    .join('') + (discount > 0
      ? `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #444;">${escapeHtml(discountLabel)}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #444; text-align: right;">−${formatMoney(discount)}</td>
        </tr>`
      : '');

  const itemLinesText = items
    .map((item) => `- ${lineName(item)} × ${item.quantity}: ${formatMoney(Number(item.unit_price) * item.quantity)}`)
    .concat(discount > 0 ? [`- ${discountLabel}: -${formatMoney(discount)}`] : [])
    .join('\n');

  await sendEmail({
    to: customerEmail,
    subject: `Order confirmed — #${shortOrderId}`,
    html: renderEmail({
      eyebrow: 'Order confirmed',
      heading: `Thanks for your order, ${escapeHtml(customerName)}!`,
      bodyHtml: `
        <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
          We've received your payment for order <strong>#${shortOrderId}</strong> and we're getting it ready to ship.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 16px;">
          ${itemRowsHtml}
          <tr>
            <td style="padding: 12px 0 0; font-size: 15px; font-weight: 700; border-top: 1px solid #eee;">Total</td>
            <td style="padding: 12px 0 0; font-size: 15px; font-weight: 700; text-align: right; border-top: 1px solid #eee;">${formatMoney(Number(order.total))}</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #666; line-height: 1.7; margin: 0;">
          We'll email you tracking details as soon as your order ships. Questions? Just reply to this email.
        </p>
      `,
    }),
    text: `Hi ${customerName},\n\nWe've received your payment for order #${shortOrderId}.\n\n${itemLinesText}\n\nTotal: ${formatMoney(Number(order.total))}\n\nWe'll email you tracking details as soon as it ships.\n\nThanks for shopping with ${STORE_NAME}.`,
  });
}

/** Refund confirmation email. Callers fire and forget it. */
export async function sendRefundEmail(params: {
  toEmail: string;
  customerName: string;
  orderId: string;
  refundAmount: number;
  /** A partial refund says so; a full one says the order was refunded. */
  partial?: boolean;
}) {
  const { toEmail, customerName, orderId, refundAmount, partial } = params;
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const formattedAmount = formatMoney(refundAmount);
  const safeName = escapeHtml(customerName);
  const what = partial ? 'A partial refund' : 'Your refund';

  await sendEmail({
    to: toEmail,
    subject: `Refund confirmed for your order #${shortOrderId}`,
    html: renderEmail({
      eyebrow: 'Refund processed',
      heading: `Your refund is on its way, ${safeName}.`,
      bodyHtml: `
        <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
          ${what} of <strong>${formattedAmount}</strong> for order <strong>#${shortOrderId}</strong> has been processed successfully.
        </p>
        <p style="font-size: 15px; color: #444; line-height: 1.7; margin: 0 0 16px;">
          The funds will be credited back to your original payment method within <strong>3–5 business days</strong>, depending on your bank.
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.7; margin: 0;">
          Questions? Just reply to this email and our team will help.
        </p>
      `,
    }),
    text: `Hi ${customerName},\n\n${what} of ${formattedAmount} for order #${shortOrderId} has been processed.\n\nThe funds will arrive within 3-5 business days, depending on your bank.\n\nThanks for shopping with ${STORE_NAME}.`,
  });
}
