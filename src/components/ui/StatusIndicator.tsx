import { useI18n } from '../../lib/i18n';
import type { OrderStatus } from '../../types';

type Tone = 'positive' | 'caution' | 'critical' | 'neutral' | 'progress';

/**
 * One status vocabulary for the whole product. A small dot carries the tone,
 * the word carries the meaning — so state is never communicated by colour
 * alone, and the same order reads identically in the customer's account and
 * in the operator's queue.
 */
const ORDER_TONE: Record<OrderStatus, Tone> = {
  pending: 'caution',
  processing: 'progress',
  requires_action: 'caution',
  paid: 'positive',
  shipped: 'progress',
  delivered: 'positive',
  failed: 'critical',
  cancelled: 'critical',
  refunded: 'neutral',
};

export function OrderStatus({ status, className }: { status: OrderStatus; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={`status status--${ORDER_TONE[status]}${className ? ` ${className}` : ''}`}>
      {t(`status.${status}`)}
    </span>
  );
}

export function StockStatus({
  quantity,
  threshold,
}: {
  quantity: number;
  threshold: number;
}) {
  const { t } = useI18n();
  // `<= 0`, not `=== 0`: an oversold product carries a NEGATIVE stock figure
  // (migration 013), which used to read as "in stock" and render "Only -5 left".
  if (quantity <= 0) return <span className="status status--neutral">{t('product.stockOut')}</span>;
  if (quantity <= threshold) {
    return <span className="status status--caution">{t('product.stockLow', { count: quantity })}</span>;
  }
  return <span className="status status--positive">{t('product.stockIn')}</span>;
}

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`status status--${tone}`}>{label}</span>;
}
