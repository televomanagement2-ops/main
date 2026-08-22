import { useToastStore } from '../../store/toastStore';
import { IconAlert, IconCheck } from './icons';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'critical' ? ' toast--critical' : ''}`}>
          <span className="toast__icon">
            {t.tone === 'critical' ? <IconAlert size={15} /> : <IconCheck size={15} />}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
