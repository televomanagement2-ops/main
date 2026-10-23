import { describe, expect, it } from 'vitest';
import type { Order } from '../types';
import { SEMICOLON_DIALECT } from './csv';
import { LINE_COLUMNS, ORDER_COLUMNS, orderLinesToCsvRows, ordersToCsvRows } from './orderCsv';

const order = {
  id: 'abcdef12-0000-4000-8000-000000000000',
  user_id: 'u',
  status: 'paid',
  subtotal: 100,
  shipping_cost: 10,
  tax_amount: 0,
  discount_amount: 15,
  discount_code: 'SAVE15',
  total: 95,
  refund_amount: 20,
  shipping_address: { full_name: 'Ada', line1: 'Via Roma 1', line2: 'Int. 4', city: 'Milano', state: 'MI', postal_code: '20100', country: 'IT', phone: null },
  shipping_method_id: null,
  shipping_method_name: 'Express',
  stripe_payment_intent_id: null,
  stripe_session_id: null,
  tracking_id: 'TRK1',
  invoice_number: '2026-00007',
  notes: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  profiles: { full_name: 'Ada Lovelace', email: 'ada@example.com', phone: null },
  order_items: [
    { id: 'l1', order_id: 'o', product_id: 'p', product_name: 'Shirt', product_image: null, unit_price: 40, quantity: 2, total_price: 80, selected_size: 'M', selected_color: 'Red', sku: 'SH-R-M', discount_amount: 12, refunded_quantity: 1, restocked_quantity: 1, created_at: '' },
    { id: 'l2', order_id: 'o', product_id: 'q', product_name: 'Mug', product_image: null, unit_price: 20, quantity: 1, total_price: 20, selected_size: null, discount_amount: 3, created_at: '' },
  ],
} as unknown as Order;

const options = {
  dialect: SEMICOLON_DIALECT,
  headings: { order: 'Ordine' },
  statusLabel: (s: string) => `[${s}]`,
  formatDate: (iso: string) => iso.slice(0, 10),
};

describe('order CSV', () => {
  it('writes one row per order, with translated headings', () => {
    const rows = ordersToCsvRows([order], options);
    expect(rows[0][0]).toBe('Ordine');
    expect(rows[0][1]).toBe('date');
    const row = Object.fromEntries(ORDER_COLUMNS.map((c, i) => [c, rows[1][i]]));
    expect(row).toMatchObject({
      order: 'ABCDEF12',
      date: '2026-10-01',
      status: '[paid]',
      customer: 'Ada Lovelace',
      address: 'Via Roma 1, Int. 4',
      items: 3,
      discount: '15,00',
      total: '95,00',
      refunded: '20,00',
      invoice: '2026-00007',
    });
  });

  it('writes one row per line, net of its discount share', () => {
    const rows = orderLinesToCsvRows([order], options);
    expect(rows).toHaveLength(3);
    const first = Object.fromEntries(LINE_COLUMNS.map((c, i) => [c, rows[1][i]]));
    expect(first).toMatchObject({ product: 'Shirt', color: 'Red', size: 'M', sku: 'SH-R-M', quantity: 2, line_total: '68,00', refunded_quantity: 1 });
  });
});
