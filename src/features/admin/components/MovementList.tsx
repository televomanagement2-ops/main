import { useI18n } from '../../../lib/i18n';
import type { InventoryMovement } from '../../../types';

interface Props {
  movements: InventoryMovement[];
  /** Inside a product: no product column. */
  compact?: boolean;
  onOpenOrder?: (orderId: string) => void;
}

/** Stock movements, newest first: when, what, how much, why, who. */
export function MovementList({ movements, compact, onOpenOrder }: Props) {
  const { t, formatDateTime } = useI18n();

  return (
    <div className="table-wrap">
      <table className="table table--stack movement-table">
        <thead>
          <tr>
            <th>{t('admin.inventory.movements.when')}</th>
            {!compact && <th>{t('admin.inventory.movements.product')}</th>}
            <th>{t('admin.inventory.movements.variant')}</th>
            <th className="table__num">{t('admin.inventory.movements.change')}</th>
            <th className="table__num">{t('admin.inventory.movements.after')}</th>
            <th>{t('admin.inventory.movements.reason')}</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => {
            const who = m.profiles?.full_name || m.profiles?.email || null;
            return (
              <tr key={m.id}>
                <td data-col="meta" className="t-xs">{formatDateTime(new Date(m.created_at))}</td>
                {!compact && (
                  <td data-col="full">
                    <span className="table__primary">{m.products?.name ?? '—'}</span>
                  </td>
                )}
                <td data-col="full" className="t-sm">{m.variant_label || '—'}</td>
                <td data-col="end" className={`table__num movement-delta${m.delta > 0 ? ' is-in' : ' is-out'}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </td>
                <td data-col="end" className="table__num t-faint">{m.stock_after}</td>
                <td data-col="full">
                  <span className="t-sm">{t(`admin.inventory.reason.${m.reason}`)}</span>
                  {m.detail && <span className="t-xs t-faint"> · {t(`admin.inventory.detail.${m.detail}`)}</span>}
                  {m.order_id && (
                    onOpenOrder ? (
                      <button type="button" className="link t-xs t-mono" style={{ marginLeft: 6 }} onClick={() => onOpenOrder(m.order_id as string)}>
                        #{m.order_id.slice(0, 8).toUpperCase()}
                      </button>
                    ) : (
                      <span className="t-xs t-faint t-mono"> · #{m.order_id.slice(0, 8).toUpperCase()}</span>
                    )
                  )}
                  {(m.note || who) && (
                    <span className="t-xs t-faint" style={{ display: 'block' }}>
                      {[m.note, who].filter(Boolean).join(' — ')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
