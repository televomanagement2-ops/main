import { useState } from 'react';
import { useOrderRefunds, useRefundOrderLines } from '../../../hooks/useAdminOrders';
import { FunctionError } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { parseAmount } from '../../../lib/variants';
import { refundRemaining, refundableUnits, shippingPaid, suggestRefund } from '../../../../supabase/functions/_shared/refunds.ts';
import { toast } from '../../../store/toastStore';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconMinus, IconPlus } from '../../../components/ui/icons';
import type { Order } from '../../../types';

interface Props {
  order: Order;
  onClose: () => void;
}

interface Pick {
  on: boolean;
  quantity: number;
  restock: boolean;
}

/**
 * Refund all or part of an order: choose lines and quantities, whether each
 * goes back on the shelf, and the shipping; the amount is suggested (what was
 * paid for those units, with their tax) and can be changed. Repeatable until
 * nothing is left — the database caps every refund at the remainder.
 */
export function OrderRefundPanel({ order, onClose }: Props) {
  const { t, formatCurrency } = useI18n();
  const refund = useRefundOrderLines();
  const { data: refunds = [] } = useOrderRefunds(order.id);
  // Chosen once per opening: a double click on confirm is one refund.
  const [requestId] = useState(() => crypto.randomUUID());

  // Goods that never left the building go back on the shelf by default.
  const restockByDefault = order.status === 'paid';
  const lines = order.order_items ?? [];
  const refundable = lines.filter((line) => refundableUnits({ ...line, refunded_quantity: line.refunded_quantity ?? 0 }) > 0);

  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(
      refundable.map((line) => [
        line.id,
        { on: false, quantity: line.quantity - (line.refunded_quantity ?? 0), restock: restockByDefault },
      ]),
    ),
  );
  const [shippingOn, setShippingOn] = useState(false);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundedShipping = refunds
    .filter((r) => r.status !== 'failed' && r.status !== 'canceled')
    .reduce((sum, r) => sum + Number(r.shipping_amount), 0);
  const shippingLeft = Math.max(0, Math.round((shippingPaid(order) - refundedShipping) * 100) / 100);
  const remaining = refundRemaining(order);

  const chosen = refundable.filter((line) => picks[line.id]?.on);
  const suggestion = suggestRefund(
    order,
    lines.map((line) => ({ ...line, discount_amount: line.discount_amount ?? 0, refunded_quantity: line.refunded_quantity ?? 0 })),
    chosen.map((line) => ({ order_item_id: line.id, quantity: picks[line.id].quantity })),
    shippingOn ? shippingLeft : 0,
  );
  const amount = amountText == null ? suggestion.total : parseAmount(amountText);
  const amountValid = amount != null && !Number.isNaN(amount) && amount > 0 && amount <= remaining + 0.005;

  const setPick = (id: string, patch: Partial<Pick>) =>
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const submit = () => {
    if (!amountValid || amount == null) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    refund.mutate(
      {
        orderId: order.id,
        requestId,
        amount,
        lines: chosen.map((line) => ({
          order_item_id: line.id,
          quantity: picks[line.id].quantity,
          restock: picks[line.id].restock,
        })),
        shippingAmount: shippingOn ? shippingLeft : 0,
        reason: reason.trim() || null,
      },
      {
        onSuccess: () => {
          toast(t('admin.orders.refund.done', { amount: formatCurrency(amount) }));
          onClose();
        },
        onError: (err) => {
          setConfirming(false);
          setError(
            err instanceof FunctionError && err.code === 'AMOUNT_TOO_HIGH'
              ? t('admin.orders.refund.tooHigh', { amount: formatCurrency(remaining) })
              : err instanceof Error
                ? err.message
                : t('common.error'),
          );
        },
      },
    );
  };

  return (
    <div className="order-panel">
      <div className="row row--between gap-3">
        <p className="t-label">{t('admin.orders.refund.title')}</p>
        <span className="t-xs t-faint">{t('admin.orders.refund.remaining', { amount: formatCurrency(remaining) })}</span>
      </div>

      {refundable.length > 0 && (
        <div className="refund-lines">
          {refundable.map((line) => {
            const pick = picks[line.id];
            const max = line.quantity - (line.refunded_quantity ?? 0);
            const option = [line.selected_color, line.selected_size].filter(Boolean).join(' / ');
            return (
              <div key={line.id} className={`refund-line${pick.on ? ' is-on' : ''}`}>
                <label className="checkbox refund-line__pick">
                  <input
                    type="checkbox"
                    checked={pick.on}
                    onChange={(e) => {
                      setPick(line.id, { on: e.target.checked });
                      setAmountText(null);
                      setConfirming(false);
                    }}
                  />
                  <span>
                    <span className="t-sm" style={{ color: 'var(--ink)' }}>{line.product_name}</span>
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {option ? `${option} · ` : ''}
                      {t('admin.orders.refund.unitsLeft', { count: max, price: formatCurrency(line.unit_price) })}
                    </span>
                  </span>
                </label>
                {pick.on && (
                  <div className="refund-line__controls">
                    <div className="stepper stepper--sm" aria-label={t('cart.quantity')}>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => { setPick(line.id, { quantity: Math.max(1, pick.quantity - 1) }); setAmountText(null); }}
                        disabled={pick.quantity <= 1}
                        aria-label={t('cart.decrease')}
                      >
                        <IconMinus size={13} />
                      </button>
                      <span className="stepper__value">{pick.quantity}</span>
                      <button
                        type="button"
                        className="stepper__btn"
                        onClick={() => { setPick(line.id, { quantity: Math.min(max, pick.quantity + 1) }); setAmountText(null); }}
                        disabled={pick.quantity >= max}
                        aria-label={t('cart.increase')}
                      >
                        <IconPlus size={13} />
                      </button>
                    </div>
                    <label className="checkbox t-xs">
                      <input
                        type="checkbox"
                        checked={pick.restock}
                        onChange={(e) => setPick(line.id, { restock: e.target.checked })}
                      />
                      {t('admin.orders.refund.restock')}
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {shippingLeft > 0 && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={shippingOn}
            onChange={(e) => {
              setShippingOn(e.target.checked);
              setAmountText(null);
              setConfirming(false);
            }}
          />
          {t('admin.orders.refund.shipping', { amount: formatCurrency(shippingLeft) })}
        </label>
      )}

      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="refund-amount">{t('admin.orders.refund.amount')}</label>
          <input
            id="refund-amount"
            className="input t-num"
            inputMode="decimal"
            value={amountText ?? (suggestion.total > 0 ? suggestion.total.toFixed(2) : '')}
            onChange={(e) => {
              setAmountText(e.target.value);
              setConfirming(false);
            }}
            aria-invalid={amountText != null && !amountValid}
          />
          <p className="field__hint">
            {suggestion.total > 0
              ? t('admin.orders.refund.suggested', {
                  amount: formatCurrency(suggestion.total),
                  tax: formatCurrency(suggestion.tax),
                })
              : t('admin.orders.refund.pickHint')}
            {amountText != null && (
              <>
                {' '}
                <button type="button" className="link" onClick={() => setAmountText(null)}>
                  {t('admin.orders.refund.useSuggested')}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="refund-reason">{t('admin.orders.refund.reason')}</label>
          <input
            id="refund-reason"
            className="input"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.orders.refund.reasonPlaceholder')}
          />
        </div>
      </div>

      {confirming && amount != null && (
        <div className="notice notice--critical">
          <IconAlert size={15} />
          <div className="notice__body">{t('admin.orders.refund.confirmText', { amount: formatCurrency(amount) })}</div>
        </div>
      )}
      {error && (
        <div className="notice notice--critical">
          <IconAlert size={15} />
          <div className="notice__body">{error}</div>
        </div>
      )}

      <div className="row gap-2">
        <button
          type="button"
          className={`btn ${confirming ? 'btn--critical' : 'btn--primary'} btn--sm`}
          onClick={submit}
          disabled={!amountValid || refund.isPending}
        >
          {refund.isPending ? (
            <>
              <Spinner onAction />
              {t('admin.orders.refund.running')}
            </>
          ) : confirming ? (
            t('admin.orders.refund.confirm', { amount: formatCurrency(amount ?? 0) })
          ) : (
            t('admin.orders.refund.review')
          )}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onClose} disabled={refund.isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
