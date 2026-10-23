import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAddOrderNote, useDeleteOrderNote, useOrderEvents } from '../../../hooks/useAdminOrders';
import { useI18n } from '../../../lib/i18n';
import { toast } from '../../../store/toastStore';
import { IconTrash } from '../../../components/ui/icons';
import type { Order, OrderEvent, OrderStatus } from '../../../types';

/** One line of the timeline, in the admin's language. */
function useEventText() {
  const { t, formatCurrency } = useI18n();
  return (event: OrderEvent): string => {
    const data = (event.data ?? {}) as Record<string, unknown>;
    const status = (value: unknown) => t(`status.${String(value) as OrderStatus}`);
    switch (event.kind) {
      case 'note':
        return event.message ?? '';
      case 'status':
        return t('admin.orders.timeline.status', { from: status(data.from), to: status(data.to) });
      case 'tracking':
        return t('admin.orders.activityTracking', { id: String(data.tracking_id ?? '—') });
      case 'refund': {
        const amount = formatCurrency(Number(data.amount ?? 0));
        const lines = Array.isArray(data.lines) ? (data.lines as { quantity: number; restock: boolean }[]) : [];
        const units = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
        const restocked = lines.filter((l) => l.restock).reduce((sum, l) => sum + Number(l.quantity), 0);
        const parts = [t(`admin.orders.timeline.refund.${String(data.source ?? 'admin')}`, { amount })];
        if (units > 0) parts.push(t('admin.orders.timeline.refundUnits', { units, restocked }));
        if (data.status === 'failed' || data.status === 'canceled') parts.push(t('admin.orders.timeline.refundFailed'));
        if (event.message) parts.push(`“${event.message}”`);
        return parts.join(' · ');
      }
      case 'exchange':
        return [
          t('admin.orders.timeline.exchange', {
            product: String(data.product ?? ''),
            from: String(data.from || '—'),
            to: String(data.to || '—'),
            quantity: Number(data.quantity ?? 0),
          }),
          data.restocked ? t('admin.orders.timeline.exchangeRestocked') : null,
          event.message ? `“${event.message}”` : null,
        ]
          .filter(Boolean)
          .join(' · ');
      case 'review':
        return data.flagged
          ? t('admin.orders.timeline.flagged', { reason: String(data.reason ?? '—') })
          : t('admin.orders.timeline.resolved');
      case 'payment':
        return data.confirmed
          ? t('admin.orders.timeline.paymentConfirmed', { amount: formatCurrency(Number(data.charged ?? 0)) })
          : t('admin.orders.timeline.paymentChecked', { status: String(data.session_status ?? '—') });
      case 'invoice':
        return t('admin.orders.timeline.invoice', { number: String(data.invoice_number ?? '') });
      default:
        return event.message ?? event.kind;
    }
  };
}

/** Everything that happened to an order, and the team's internal notes. */
export function OrderTimeline({ order }: { order: Order }) {
  const { t, formatDateTime } = useI18n();
  const { user } = useAuth();
  const { data: events = [], isLoading } = useOrderEvents(order.id);
  const addNote = useAddOrderNote();
  const deleteNote = useDeleteOrderNote();
  const text = useEventText();
  const [note, setNote] = useState('');

  const submitNote = () => {
    const message = note.trim();
    if (!message || !user) return;
    addNote.mutate(
      { orderId: order.id, actorId: user.id, message },
      {
        onSuccess: () => setNote(''),
        onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical'),
      },
    );
  };

  return (
    <div className="stack gap-5">
      <div className="field">
        <label className="field__label" htmlFor={`note-${order.id}`}>{t('admin.orders.notes.label')}</label>
        <textarea
          id={`note-${order.id}`}
          className="textarea"
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('admin.orders.notes.placeholder')}
        />
        <div className="row row--between gap-2" style={{ marginTop: 'var(--s-2)' }}>
          <span className="t-xs t-faint">{t('admin.orders.notes.private')}</span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={submitNote}
            disabled={!note.trim() || addNote.isPending}
          >
            {t('admin.orders.notes.add')}
          </button>
        </div>
      </div>

      <div className="activity">
        <div className="activity__row">
          <span className="activity__dot" aria-hidden="true" />
          <div>
            <p className="activity__label">{t('admin.orders.activityPlaced')}</p>
            <p className="activity__time">{formatDateTime(new Date(order.created_at))}</p>
          </div>
        </div>
        {isLoading && <p className="t-xs t-faint">{t('common.loading')}</p>}
        {events.map((event) => {
          const who = event.profiles?.full_name || event.profiles?.email || null;
          return (
            <div key={event.id} className={`activity__row${event.kind === 'note' ? ' activity__row--note' : ''}`}>
              <span className={`activity__dot activity__dot--${event.kind}`} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="activity__label">{text(event)}</p>
                <p className="activity__time">
                  {formatDateTime(new Date(event.created_at))}
                  {who && ` · ${who}`}
                </p>
              </div>
              {event.kind === 'note' && (
                <button
                  type="button"
                  className="size-row__icon size-row__icon--danger"
                  onClick={() => deleteNote.mutate({ eventId: event.id, orderId: order.id })}
                  aria-label={t('admin.orders.notes.delete')}
                  disabled={deleteNote.isPending}
                >
                  <IconTrash size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
