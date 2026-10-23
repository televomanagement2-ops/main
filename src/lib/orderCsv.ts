// ─────────────────────────────────────────────────────────────────────────────
// Orders as CSV — for accounting and for the warehouse. Two shapes:
//   orders  one row per order (totals, customer, shipping, refunds)
//   lines   one row per order line (what to pick, what was refunded)
// Column headings are passed in already translated.
// ─────────────────────────────────────────────────────────────────────────────

import type { Order } from '../types';
import { csvNumber, type CsvCell, type CsvDialect } from './csv';

export const ORDER_COLUMNS = [
  'order',
  'date',
  'status',
  'customer',
  'email',
  'phone',
  'address',
  'city',
  'postal_code',
  'state',
  'country',
  'shipping_method',
  'items',
  'subtotal',
  'discount_code',
  'discount',
  'shipping',
  'tax',
  'total',
  'refunded',
  'tracking',
  'invoice',
] as const;

export const LINE_COLUMNS = [
  'order',
  'date',
  'status',
  'customer',
  'product',
  'color',
  'size',
  'sku',
  'quantity',
  'unit_price',
  'discount',
  'line_total',
  'refunded_quantity',
  'restocked_quantity',
] as const;

export type OrderColumn = (typeof ORDER_COLUMNS)[number];
export type LineColumn = (typeof LINE_COLUMNS)[number];

export const shortOrderId = (id: string) => id.slice(0, 8).toUpperCase();

interface Options {
  dialect: CsvDialect;
  /** Translated headings. */
  headings: Record<string, string>;
  /** Translated status names. */
  statusLabel: (status: Order['status']) => string;
  /** ISO date → the text written in the file. */
  formatDate: (iso: string) => string;
}

const customerName = (order: Order) => order.profiles?.full_name || order.shipping_address?.full_name || '';

export function ordersToCsvRows(orders: readonly Order[], options: Options): CsvCell[][] {
  const { dialect, headings, statusLabel, formatDate } = options;
  const money = (n: number | null | undefined) => csvNumber(n ?? 0, 2, dialect);
  const rows: CsvCell[][] = [ORDER_COLUMNS.map((c) => headings[c] ?? c)];
  for (const order of orders) {
    const address = order.shipping_address;
    const units = (order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
    const row: Record<OrderColumn, CsvCell> = {
      order: shortOrderId(order.id),
      date: formatDate(order.created_at),
      status: statusLabel(order.status),
      customer: customerName(order),
      email: order.profiles?.email ?? '',
      phone: address?.phone ?? order.profiles?.phone ?? '',
      address: [address?.line1, address?.line2].filter(Boolean).join(', '),
      city: address?.city ?? '',
      postal_code: address?.postal_code ?? '',
      state: address?.state ?? '',
      country: address?.country ?? '',
      shipping_method: order.shipping_method_name ?? '',
      items: units,
      subtotal: money(order.subtotal),
      discount_code: order.discount_code ?? '',
      discount: money(order.discount_amount),
      shipping: money(order.shipping_cost),
      tax: money(order.tax_amount),
      total: money(order.total),
      refunded: money(order.refund_amount ?? 0),
      tracking: order.tracking_id ?? '',
      invoice: order.invoice_number ?? '',
    };
    rows.push(ORDER_COLUMNS.map((c) => row[c]));
  }
  return rows;
}

export function orderLinesToCsvRows(orders: readonly Order[], options: Options): CsvCell[][] {
  const { dialect, headings, statusLabel, formatDate } = options;
  const money = (n: number | null | undefined) => csvNumber(n ?? 0, 2, dialect);
  const rows: CsvCell[][] = [LINE_COLUMNS.map((c) => headings[c] ?? c)];
  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      const discount = Number(item.discount_amount ?? 0);
      const row: Record<LineColumn, CsvCell> = {
        order: shortOrderId(order.id),
        date: formatDate(order.created_at),
        status: statusLabel(order.status),
        customer: customerName(order),
        product: item.product_name,
        color: item.selected_color ?? '',
        size: item.selected_size ?? '',
        sku: item.sku ?? '',
        quantity: item.quantity,
        unit_price: money(item.unit_price),
        discount: money(discount),
        line_total: money(Number(item.total_price) - discount),
        refunded_quantity: item.refunded_quantity ?? 0,
        restocked_quantity: item.restocked_quantity ?? 0,
      };
      rows.push(LINE_COLUMNS.map((c) => row[c]));
    }
  }
  return rows;
}
