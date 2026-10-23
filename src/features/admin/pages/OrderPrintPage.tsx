import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAllAdminOrders, issueInvoices } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { storeConfig } from '../../../config/storeConfig';
import { IconPrinter } from '../../../components/ui/icons';
import type { Order } from '../../../types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICEABLE = ['paid', 'shipped', 'delivered', 'refunded'];

type Doc = 'packing' | 'invoice';

/**
 * Packing slips and invoices, one order per printed page, in the admin's
 * language. The browser's print dialog opens on its own; "Save as PDF" there
 * makes the PDF. Invoice numbers are issued (gapless, per year) the first time
 * an order's invoice is printed, and reused after that.
 */
export function OrderPrintPage() {
  const [params] = useSearchParams();
  const { t } = useI18n();
  const doc: Doc = params.get('doc') === 'invoice' ? 'invoice' : 'packing';
  const idsKey = params.get('orders') ?? '';
  const ids = useMemo(
    () => [...new Set(idsKey.split(',').filter((id) => UUID_PATTERN.test(id)))].slice(0, 200),
    [idsKey],
  );

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (ids.length === 0) throw new Error(t('admin.print.noOrders'));
        if (doc === 'invoice') await issueInvoices(ids);
        const rows = await fetchAllAdminOrders({ ids });
        const order = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        if (!cancelled) setOrders(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.error'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, ids, t]);

  const printable = (orders ?? []).filter((o) => doc === 'packing' || (INVOICEABLE.includes(o.status) && o.invoice_number));
  const skipped = (orders?.length ?? 0) - printable.length;

  // Open the print dialog once the documents (and their images) are on screen.
  useEffect(() => {
    if (!orders || printable.length === 0) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [orders, printable.length]);

  useEffect(() => {
    document.title = doc === 'invoice' ? t('admin.print.invoiceTitle') : t('admin.print.packingTitle');
  }, [doc, t]);

  return (
    <div className="print-root">
      <div className="print-toolbar">
        <span className="t-sm">
          {orders
            ? t(doc === 'invoice' ? 'admin.print.invoiceCount' : 'admin.print.packingCount', { count: printable.length })
            : t('common.loading')}
          {skipped > 0 && <span className="t-faint"> · {t('admin.print.skipped', { count: skipped })}</span>}
        </span>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => window.print()} disabled={!orders}>
          <IconPrinter size={14} />
          {t('admin.print.print')}
        </button>
      </div>
      {error && <p className="print-error">{error}</p>}
      {printable.map((order) =>
        doc === 'invoice' ? <Invoice key={order.id} order={order} /> : <PackingSlip key={order.id} order={order} />,
      )}
    </div>
  );
}

function Seller() {
  const { t } = useI18n();
  return (
    <div className="print-seller">
      <p className="print-brand">{storeConfig.storeName}</p>
      <p>{[storeConfig.sellerLegalName, storeConfig.sellerEntityType].filter(Boolean).join(' ')}</p>
      <p>{storeConfig.businessAddress}</p>
      <p>{[storeConfig.contactEmail, storeConfig.supportPhone].filter(Boolean).join(' · ')}</p>
      {storeConfig.taxId && <p>{t('admin.print.taxId', { id: storeConfig.taxId })}</p>}
    </div>
  );
}

function Address({ order, title }: { order: Order; title: string }) {
  const a = order.shipping_address;
  return (
    <div className="print-address">
      <p className="print-label">{title}</p>
      <p><strong>{a?.full_name}</strong></p>
      <p>{[a?.line1, a?.line2].filter(Boolean).join(', ')}</p>
      <p>{[a?.postal_code, a?.city, a?.state].filter(Boolean).join(' ')}</p>
      <p>{a?.country}</p>
      {a?.phone && <p>{a.phone}</p>}
      {order.profiles?.email && <p>{order.profiles.email}</p>}
    </div>
  );
}

const option = (item: { selected_color?: string | null; selected_size?: string | null }) =>
  [item.selected_color, item.selected_size].filter(Boolean).join(' / ');

function PackingSlip({ order }: { order: Order }) {
  const { t, formatDate } = useI18n();
  const units = (order.order_items ?? []).reduce((sum, i) => sum + i.quantity - (i.refunded_quantity ?? 0), 0);
  return (
    <article className="print-doc">
      <header className="print-head">
        <Seller />
        <div className="print-meta">
          <h1>{t('admin.print.packingTitle')}</h1>
          <p>{t('admin.print.order', { id: order.id.slice(0, 8).toUpperCase() })}</p>
          <p>{t('admin.print.date', { date: formatDate(new Date(order.created_at)) })}</p>
          {order.shipping_method_name && <p>{t('admin.print.method', { method: order.shipping_method_name })}</p>}
          {order.tracking_id && <p>{t('admin.print.tracking', { id: order.tracking_id })}</p>}
        </div>
      </header>

      <Address order={order} title={t('admin.print.shipTo')} />

      <table className="print-table">
        <thead>
          <tr>
            <th>{t('admin.print.item')}</th>
            <th>{t('admin.print.variant')}</th>
            <th>{t('admin.print.sku')}</th>
            <th className="num">{t('admin.print.qty')}</th>
            <th className="check" aria-label={t('admin.print.packed')} />
          </tr>
        </thead>
        <tbody>
          {(order.order_items ?? []).map((item) => {
            const qty = item.quantity - (item.refunded_quantity ?? 0);
            if (qty <= 0) return null;
            return (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{option(item) || '—'}</td>
                <td className="mono">{item.sku ?? '—'}</td>
                <td className="num">{qty}</td>
                <td className="check"><span className="print-box" /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>{t('admin.print.units')}</td>
            <td className="num">{units}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="print-sign">
        <p className="print-label">{t('admin.print.notes')}</p>
        <div className="print-lines" />
      </div>
    </article>
  );
}

function Invoice({ order }: { order: Order }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const discount = Number(order.discount_amount ?? 0);
  const refunded = Number(order.refund_amount ?? 0);
  return (
    <article className="print-doc">
      <header className="print-head">
        <Seller />
        <div className="print-meta">
          <h1>{t('admin.print.invoiceHeading', { number: order.invoice_number ?? '' })}</h1>
          <p>{t('admin.print.issued', { date: formatDate(new Date(order.invoice_issued_at ?? order.created_at)) })}</p>
          <p>{t('admin.print.order', { id: order.id.slice(0, 8).toUpperCase() })}</p>
          <p>{t('admin.print.orderDate', { date: formatDate(new Date(order.created_at)) })}</p>
          <p>{t('admin.print.paidBy')}</p>
        </div>
      </header>

      <Address order={order} title={t('admin.print.billTo')} />

      <table className="print-table">
        <thead>
          <tr>
            <th>{t('admin.print.item')}</th>
            <th>{t('admin.print.variant')}</th>
            <th className="num">{t('admin.print.qty')}</th>
            <th className="num">{t('admin.print.unit')}</th>
            <th className="num">{t('admin.print.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {(order.order_items ?? []).map((item) => (
            <tr key={item.id}>
              <td>
                {item.product_name}
                {item.sku && <span className="mono print-sku"> {item.sku}</span>}
              </td>
              <td>{option(item) || '—'}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatCurrency(item.unit_price)}</td>
              <td className="num">{formatCurrency(item.total_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="print-totals">
        <div><dt>{t('orderDetail.subtotal')}</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
        {discount > 0 && (
          <div>
            <dt>{order.discount_code ? t('checkout.discount.lineWithCode', { code: order.discount_code }) : t('checkout.discount.line')}</dt>
            <dd>−{formatCurrency(discount)}</dd>
          </div>
        )}
        <div>
          <dt>{order.shipping_method_name ?? t('orderDetail.shipping')}</dt>
          <dd>{formatCurrency(order.shipping_cost)}</dd>
        </div>
        {order.tax_amount > 0 && <div><dt>{t('orderDetail.tax')}</dt><dd>{formatCurrency(order.tax_amount)}</dd></div>}
        <div className="print-total"><dt>{t('orderDetail.total')}</dt><dd>{formatCurrency(order.total)}</dd></div>
        {refunded > 0 && (
          <>
            <div><dt>{t('admin.orders.refunded')}</dt><dd>−{formatCurrency(refunded)}</dd></div>
            <div><dt>{t('admin.orders.net')}</dt><dd>{formatCurrency(Math.max(0, order.total - refunded))}</dd></div>
          </>
        )}
      </dl>

      <footer className="print-foot">
        {storeConfig.invoiceNotes ? <p>{storeConfig.invoiceNotes}</p> : <p>{t('admin.print.thanks')}</p>}
      </footer>
    </article>
  );
}
