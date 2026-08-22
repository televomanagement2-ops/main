import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small line above the title — context, not decoration. */
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  closeLabel: string;
  /** Removes body padding when the content manages its own sections. */
  flush?: boolean;
}

/**
 * The single drawer used for contextual workflows in both expressions:
 * cart, filters, admin order detail, admin product editing. Right-hand sheet
 * on desktop, bottom sheet on phones (see storefront.css), escape to dismiss,
 * scroll locked behind it, focus moved inside on open and restored on close.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  wide,
  closeLabel,
  flush,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Move focus into the panel so keyboard and screen-reader users land here.
    const focusTarget = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusTarget?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className={`drawer${wide ? ' drawer--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        ref={panelRef}
      >
        <header className="drawer__head">
          <div>
            {eyebrow && <p className="t-label">{eyebrow}</p>}
            <p className="t-h4" style={{ marginTop: eyebrow ? 4 : 0 }}>{title}</p>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label={closeLabel}>
            <IconClose size={18} />
          </button>
        </header>
        <div className={`drawer__body${flush ? ' drawer__body--flush' : ''}`}>{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </aside>
    </>
  );
}
