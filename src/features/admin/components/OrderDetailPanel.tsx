import { useState } from 'react';
import { Media } from '../../../components/ui/Media';
import { OrderStatus as OrderStatusIndicator } from '../../../components/ui/StatusIndicator';
import {
  useAdminCancelOrder,
  useConfirmOrderPayment,
  useMarkOrderDelivered,
  useOrderRefunds,
  useResolveOrderReview,
  useSyncOrderPayment,
  useUpdateAdminOrderTracking,
} from '../../../hooks/useAdminOrders';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { refundRemaining } from '../../../../supabase/functions/_shared/refunds.ts';
import { IconAlert, IconPrinter } from '../../../components/ui/icons';
import { OrderRefundPanel } from './OrderRefundPanel';
import { OrderExchangePanel } from './OrderExchangePanel';
import { OrderTimeline } from './OrderTimeline';
import { openPrint } from '../../../lib/printDocuments';
import type { Order, OrderStatus } from '../../../types';

const TIMELINE_STEPS: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const TERMINAL_STATUSES: OrderStatus[] = ['cancelled', 'failed', 'refunded'];
const PRE_PAYMENT: OrderStatus[] = ['pending', 'processing', 'requires_action'];
const REFUNDABLE: OrderStatus[] = ['paid', 'shipped', 'delivered'];

function formatAddress(order: Order): string {
  const addr = order.shipping_address;
  if (!addr) return '—';
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
}

export function OrderDetailPanel({ order }: { order: Order }) {
  const { t, tCount, formatCurrency, formatDateTime } = useI18n();
  const updateTracking = useUpdateAdminOrderTracking();
  const markDelivered = useMarkOrderDelivered();
  const cancelOrder = useAdminCancelOrder();
  const syncPayment = useSyncOrderPayment();
  const confirmPayment = useConfirmOrderPayment();
  const resolveReview = useResolveOrderReview();
  const { data: refunds = [] } = useOrderRefunds(order.id);

  const [trackingDraft, setTrackingDraft] = useState(order.tracking_id ?? '');
  const [panel, setPanel] = useState<'refund' | { exchange: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  // 'shipped' is included so a wrong tracking number can still be corrected —
  // the Edge Function re-sends the notification with the new one, and the DB
  // treats shipped → shipped as a no-op.
  const canTrack = order.status === 'paid' || order.status === 'shipped';
  const canSaveTracking = canTrack && trackingDraft.trim().length > 0;
  const stopped = TERMINAL_STATUSES.includes(order.status);
  const progress = TIMELINE_STEPS.indexOf(order.status);
  const prePayment = PRE_PAYMENT.includes(order.status);
  const refundable = REFUNDABLE.includes(order.status);
  const remaining = refundRemaining(order);
  const refunded = Number(order.refund_amount ?? 0);
  const discount = Number(order.discount_amount ?? 0);

  const fail = (err: unknown) => toast(err instanceof Error ? err.message : t('common.error'), 'critical');

  const deliverErrorMessage = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : '';
    if (raw.includes('delivered_at') || raw.includes('schema cache')) {
      return t('admin.orders.errors.deliveredAtMissing');
    }
    if (raw.includes('JWT') || raw.includes('session') || raw.includes('Session')) {
      return t('admin.orders.errors.sessionExpired');
    }
    return raw || t('admin.orders.markDeliveredError');
  };

  return (
    <div className="order-detail">
      <div className="order-detail__head">
        <div className="row row--between gap-4" style={{ alignItems: 'flex-start' }}>
          <div>
            <p className="t-label">{t('admin.orders.orderTotal')}</p>
            <p className="order-detail__total" style={{ marginTop: 'var(--s-2)' }}>
              {formatCurrency(order.total)}
            </p>
            <p className="t-xs t-faint" style={{ marginTop: 'var(--s-2)' }}>
              {formatDateTime(new Date(order.created_at))} · {tCount('orders.items', order.order_items?.length ?? 0)}
              {order.invoice_number && <> · {t('admin.orders.invoiceNumber', { number: order.invoice_number })}</>}
            </p>
          </div>
          <div className="stack gap-2" style={{ alignItems: 'flex-end' }}>
            <OrderStatusIndicator status={order.status} />
            {refunded > 0 && order.status !== 'refunded' && (
              <span className="status status--neutral">{t('admin.orders.partiallyRefunded')}</span>
            )}
            {order.needs_review && (
              <span className="status status--critical">{t('admin.orders.needsReview')}</span>
            )}
          </div>
        </div>

        {order.needs_review && (
          <div className="notice notice--critical" style={{ marginTop: 'var(--s-4)' }}>
            <IconAlert size={15} />
            <div className="notice__body stack gap-3">
              {order.review_reason && (
                <span>{t('admin.orders.reviewReasonLabel')}: {order.review_reason}</span>
              )}
              <div className="row gap-2 row--wrap">
                <input
                  className="input input--sm"
                  style={{ flex: '1 1 200px' }}
                  value={reviewNote}
                  maxLength={500}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={t('admin.orders.review.notePlaceholder')}
                  aria-label={t('admin.orders.review.noteAria')}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={resolveReview.isPending}
                  onClick={() =>
                    resolveReview.mutate(
                      { orderId: order.id, note: reviewNote.trim() || null },
                      { onSuccess: () => { setReviewNote(''); toast(t('admin.orders.review.resolved')); }, onError: fail },
                    )
                  }
                >
                  {t('admin.orders.review.resolve')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`timeline${stopped ? ' timeline--stopped' : ''}`} style={{ marginBottom: 0 }}>
          {(stopped
            ? [
                { key: 'placed', label: t('orderDetail.timeline.ordered'), state: 'done' as const },
                { key: order.status, label: t(`status.${order.status}`), state: 'current' as const },
              ]
            : TIMELINE_STEPS.map((step, index) => ({
                key: step,
                label: t(`status.${step}`),
                state:
                  progress < 0
                    ? ('todo' as const)
                    : index < progress
                    ? ('done' as const)
                    : index === progress
                    ? ('current' as const)
                    : ('todo' as const),
              }))
          ).map((step) => (
            <div
              key={step.key}
              className={`timeline__step${step.state === 'done' ? ' is-done' : ''}${
                step.state === 'current' ? ' is-current' : ''
              }`}
            >
              <div className="timeline__marker" aria-hidden="true">
                <span className="timeline__dot" />
                <span className="timeline__line" />
              </div>
              <span className="timeline__label">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Payment still open ── */}
      {prePayment && (
        <section className="order-detail__block">
          <p className="t-label" style={{ marginBottom: 'var(--s-3)' }}>{t('admin.orders.payment.title')}</p>
          <p className="t-sm t-muted" style={{ marginBottom: 'var(--s-4)' }}>
            {order.status === 'requires_action' ? t('admin.orders.payment.heldHint') : t('admin.orders.payment.openHint')}
          </p>
          <div className="row gap-2 row--wrap">
            {order.stripe_session_id && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={syncPayment.isPending}
                onClick={() =>
                  syncPayment.mutate(
                    { orderId: order.id },
                    {
                      onSuccess: ({ stripe_status }) => toast(t(`admin.orders.payment.synced.${stripe_status}`, { status: stripe_status })),
                      onError: fail,
                    },
                  )
                }
              >
                {syncPayment.isPending ? t('admin.orders.payment.syncing') : t('admin.orders.payment.sync')}
              </button>
            )}
            {order.status === 'requires_action' && order.stripe_payment_intent_id && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={confirmPayment.isPending}
                onClick={() =>
                  confirmPayment.mutate(
                    { orderId: order.id },
                    { onSuccess: () => toast(t('admin.orders.payment.confirmed')), onError: fail },
                  )
                }
              >
                {t('admin.orders.payment.confirm')}
              </button>
            )}
            <button
              type="button"
              className={`btn ${confirmCancel ? 'btn--critical' : 'btn--quiet'} btn--sm`}
              disabled={cancelOrder.isPending}
              onClick={() => {
                if (!confirmCancel) {
                  setConfirmCancel(true);
                  return;
                }
                cancelOrder.mutate(
                  { orderId: order.id },
                  {
                    onSuccess: () => { setConfirmCancel(false); toast(t('admin.orders.cancel.done')); },
                    onError: (err) => { setConfirmCancel(false); fail(err); },
                  },
                );
              }}
            >
              {confirmCancel ? t('admin.orders.cancel.confirm') : t('admin.orders.cancel.action')}
            </button>
          </div>
          {confirmCancel && <p className="field__hint" style={{ marginTop: 'var(--s-2)' }}>{t('admin.orders.cancel.hint')}</p>}
        </section>
      )}

      {/* ── Items ── */}
      <section className="order-detail__block">
        <p className="t-label" style={{ marginBottom: 'var(--s-3)' }}>{t('orderDetail.itemsOrdered')}</p>
        {order.order_items?.map((item) => {
          const option = [item.selected_color, item.selected_size].filter(Boolean).join(' / ');
          const refundedUnits = item.refunded_quantity ?? 0;
          const canExchange = refundable && Boolean(item.variant_id || item.selected_size) && item.quantity - refundedUnits > 0;
          const exchanging = typeof panel === 'object' && panel !== null && panel.exchange === item.id;
          const lineDiscount = Number(item.discount_amount ?? 0);
          return (
            <div key={item.id}>
              <div className="order-detail__item">
                <Media src={item.product_image} alt="" ratio="square" className="thumb" style={{ width: 48, height: 48 }} />
                <div style={{ minWidth: 0 }}>
                  <p className="t-sm" style={{ color: 'var(--ink)' }}>{item.product_name}</p>
                  <p className="t-xs t-faint">
                    {option ? `${option} · ` : ''}
                    {formatCurrency(item.unit_price)} × {item.quantity}
                    {item.sku && <span className="t-mono"> · {item.sku}</span>}
                  </p>
                  {(refundedUnits > 0 || lineDiscount > 0) && (
                    <p className="t-xs t-faint">
                      {lineDiscount > 0 && t('admin.orders.lineDiscount', { amount: formatCurrency(lineDiscount) })}
                      {lineDiscount > 0 && refundedUnits > 0 && ' · '}
                      {refundedUnits > 0 &&
                        t('admin.orders.lineRefunded', { count: refundedUnits, restocked: item.restocked_quantity ?? 0 })}
                    </p>
                  )}
                  {canExchange && !exchanging && (
                    <button type="button" className="link t-xs" onClick={() => setPanel({ exchange: item.id })}>
                      {t('admin.orders.exchange.open')}
                    </button>
                  )}
                </div>
                <p className="t-sm t-num" style={{ color: 'var(--ink)' }}>{formatCurrency(item.total_price)}</p>
              </div>
              {exchanging && <OrderExchangePanel order={order} item={item} onClose={() => setPanel(null)} />}
            </div>
          );
        })}

        <div className="summary" style={{ marginTop: 'var(--s-4)' }}>
          <div className="summary__row">
            <span>{t('orderDetail.subtotal')}</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="summary__row">
              <span>{order.discount_code ? t('checkout.discount.lineWithCode', { code: order.discount_code }) : t('checkout.discount.line')}</span>
              <span>−{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="summary__row">
            <span>{order.shipping_method_name ?? t('orderDetail.shipping')}</span>
            <span>{order.shipping_cost > 0 ? formatCurrency(order.shipping_cost) : t('common.free')}</span>
          </div>
          {order.tax_amount > 0 && (
            <div className="summary__row">
              <span>{t('orderDetail.tax')}</span>
              <span>{formatCurrency(order.tax_amount)}</span>
            </div>
          )}
          <div className="summary__row summary__row--total">
            <span>{t('orderDetail.total')}</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          {refunded > 0 && (
            <>
              <div className="summary__row">
                <span>{t('admin.orders.refunded')}</span>
                <span>−{formatCurrency(refunded)}</span>
              </div>
              <div className="summary__row">
                <span>{t('admin.orders.net')}</span>
                <span>{formatCurrency(Math.max(0, order.total - refunded))}</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Refunds ── */}
      {(refundable || refunds.length > 0) && (
        <section className="order-detail__block">
          <div className="row row--between gap-3" style={{ marginBottom: 'var(--s-3)' }}>
            <p className="t-label">{t('admin.orders.refund.section')}</p>
            {refundable && remaining > 0 && panel !== 'refund' && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPanel('refund')}>
                {t('admin.orders.refund.open')}
              </button>
            )}
          </div>
          {refunds.length > 0 && (
            <div className="info-rows" style={{ marginBottom: 'var(--s-4)' }}>
              {refunds.map((r) => (
                <div key={r.id} className="info-row">
                  <span>
                    {formatDateTime(new Date(r.created_at))}
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {t(`admin.orders.refund.source.${r.source}`)}
                      {r.reason && ` · ${r.reason}`}
                      {r.status !== 'succeeded' && ` · ${t(`admin.orders.refund.status.${r.status}`)}`}
                    </span>
                  </span>
                  <strong className="t-num">{formatCurrency(r.amount)}</strong>
                </div>
              ))}
            </div>
          )}
          {panel === 'refund' && <OrderRefundPanel order={order} onClose={() => setPanel(null)} />}
          {refundable && remaining <= 0 && <p className="t-xs t-faint">{t('admin.orders.refund.nothingLeft')}</p>}
        </section>
      )}

      {/* ── Customer + shipping ── */}
      <section className="order-detail__block">
        <div className="order-detail__grid">
          <div>
            <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('admin.orders.customer')}</p>
            <p className="t-sm" style={{ color: 'var(--ink)' }}>
              {order.profiles?.full_name
                || order.shipping_address?.full_name
                || t('admin.orders.customerFallback')}
            </p>
            <p className="t-xs t-faint">{order.profiles?.email ?? t('admin.orders.emailUnavailable')}</p>
            {order.shipping_address?.phone && (
              <p className="t-xs t-faint">{order.shipping_address.phone}</p>
            )}
          </div>
          <div>
            <p className="t-label" style={{ marginBottom: 'var(--s-2)' }}>{t('admin.orders.shipping')}</p>
            <p className="t-sm t-muted" style={{ lineHeight: 1.7 }}>{formatAddress(order)}</p>
          </div>
        </div>
      </section>

      {/* ── Fulfilment and documents ── */}
      <section className="order-detail__block">
        <p className="t-label" style={{ marginBottom: 'var(--s-4)' }}>{t('orderDetail.actions')}</p>

        <div className="stack gap-5">
          <div className="field">
            <label className="field__label" htmlFor="drawer-tracking">{t('admin.orders.trackingId')}</label>
            <div className="row gap-3">
              <input
                id="drawer-tracking"
                className="input"
                placeholder={t('admin.orders.trackingPlaceholder')}
                value={trackingDraft}
                onChange={(event) => setTrackingDraft(event.target.value)}
              />
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!canSaveTracking || updateTracking.isPending}
                onClick={() =>
                  updateTracking.mutate(
                    { orderId: order.id, trackingId: trackingDraft.trim() },
                    {
                      onSuccess: () => toast(t('admin.orders.trackingSaved')),
                      onError: (err) =>
                        toast(err instanceof Error ? err.message : t('admin.orders.trackingSaveError'), 'critical'),
                    }
                  )
                }
              >
                {updateTracking.isPending ? t('admin.orders.savingTracking') : t('admin.orders.saveTracking')}
              </button>
            </div>
            <p className="field__hint">{canTrack ? t('admin.orders.shipViaTracking') : t('admin.orders.trackingHint')}</p>
          </div>

          {order.status === 'shipped' && (
            <button
              type="button"
              className="btn btn--primary"
              style={{ alignSelf: 'flex-start' }}
              disabled={markDelivered.isPending}
              onClick={() =>
                markDelivered.mutate(
                  { orderId: order.id },
                  {
                    onSuccess: () => toast(t('admin.orders.deliveredConfirmed')),
                    onError: (err) => toast(deliverErrorMessage(err), 'critical'),
                  }
                )
              }
            >
              {markDelivered.isPending ? t('admin.orders.markingDelivered') : t('admin.orders.markDelivered')}
            </button>
          )}

          <div className="row gap-2 row--wrap">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => openPrint([order.id], 'packing')}>
              <IconPrinter size={14} />
              {t('admin.orders.print.packing')}
            </button>
            {(refundable || order.status === 'refunded') && (
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => openPrint([order.id], 'invoice')}>
                <IconPrinter size={14} />
                {t('admin.orders.print.invoice')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Timeline and notes ── */}
      <section className="order-detail__block">
        <p className="t-label" style={{ marginBottom: 'var(--s-4)' }}>{t('admin.orders.activity')}</p>
        <OrderTimeline order={order} />
      </section>
    </div>
  );
}
