import { useState } from 'react';
import { useAdminProducts } from '../../../hooks/useAdminProducts';
import { useExchangeOrderItem } from '../../../hooks/useAdminOrders';
import { useI18n } from '../../../lib/i18n';
import { sellableVariants, variantLabel, variantPrice } from '../../../lib/variants';
import { toast } from '../../../store/toastStore';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconInfo } from '../../../components/ui/icons';
import type { Order, OrderItem } from '../../../types';

interface Props {
  order: Order;
  item: OrderItem;
  onClose: () => void;
}

/**
 * Swap a line (or part of it) to another size or colour of the same product.
 * The new variant's stock goes down; the old one's goes back up when the item
 * is back on the shelf. A price difference is shown, never charged: refund
 * the difference separately when the new variant costs less.
 */
export function OrderExchangePanel({ order, item, onClose }: Props) {
  const { t, formatCurrency } = useI18n();
  const { data: products = [], isLoading } = useAdminProducts();
  const exchange = useExchangeOrderItem();

  const product = products.find((p) => p.id === item.product_id);
  const options = product ? sellableVariants(product).filter((v) => v.id !== item.variant_id) : [];
  const maxQuantity = item.quantity - (item.refunded_quantity ?? 0);

  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(maxQuantity);
  const [restock, setRestock] = useState(order.status === 'paid');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const chosen = options.find((v) => v.id === variantId) ?? null;
  const difference = product && chosen ? variantPrice(product, chosen) - Number(item.unit_price) : 0;

  const submit = () => {
    if (!chosen) return;
    setError(null);
    exchange.mutate(
      { orderId: order.id, orderItemId: item.id, variantId: chosen.id, quantity, restock, note: note.trim() || null },
      {
        onSuccess: (result) => {
          toast(t('admin.orders.exchange.done'));
          if (result.oversold) toast(t('admin.orders.exchange.oversold'), 'critical');
          onClose();
        },
        onError: (err) => setError(err instanceof Error ? err.message : t('common.error')),
      },
    );
  };

  if (isLoading) return <p className="t-xs t-faint">{t('common.loading')}</p>;
  if (!product || options.length === 0) {
    return (
      <div className="order-panel">
        <p className="t-sm t-faint">{t('admin.orders.exchange.noOptions')}</p>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>{t('common.close')}</button>
      </div>
    );
  }

  return (
    <div className="order-panel">
      <p className="t-label">{t('admin.orders.exchange.title')}</p>
      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor={`exchange-to-${item.id}`}>{t('admin.orders.exchange.to')}</label>
          <select
            id={`exchange-to-${item.id}`}
            className="select"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            <option value="">{t('admin.orders.exchange.choose')}</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(product, v)} — {t('admin.orders.exchange.inStock', { count: v.stock_qty })}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`exchange-qty-${item.id}`}>{t('admin.orders.exchange.quantity')}</label>
          <select
            id={`exchange-qty-${item.id}`}
            className="select"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          >
            {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
        {t('admin.orders.exchange.restock')}
      </label>
      <input
        className="input input--sm"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('admin.orders.exchange.notePlaceholder')}
        aria-label={t('admin.orders.exchange.noteAria')}
      />

      {chosen && Math.abs(difference) >= 0.005 && (
        <div className="notice notice--caution">
          <IconInfo size={15} />
          <div className="notice__body">
            {difference > 0
              ? t('admin.orders.exchange.costsMore', { amount: formatCurrency(difference * quantity) })
              : t('admin.orders.exchange.costsLess', { amount: formatCurrency(-difference * quantity) })}
          </div>
        </div>
      )}
      {chosen && chosen.stock_qty < quantity && (
        <div className="notice notice--caution">
          <IconInfo size={15} />
          <div className="notice__body">{t('admin.orders.exchange.lowStock', { count: chosen.stock_qty })}</div>
        </div>
      )}
      {error && (
        <div className="notice notice--critical">
          <IconAlert size={15} />
          <div className="notice__body">{error}</div>
        </div>
      )}

      <div className="row gap-2">
        <button type="button" className="btn btn--primary btn--sm" onClick={submit} disabled={!chosen || exchange.isPending}>
          {exchange.isPending ? (
            <>
              <Spinner onAction />
              {t('admin.orders.exchange.running')}
            </>
          ) : (
            t('admin.orders.exchange.confirm')
          )}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onClose} disabled={exchange.isPending}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
