import type { ReactNode } from 'react';

/**
 * A neutral metadata tag. Order/stock state uses StatusIndicator instead —
 * badges never carry state on their own.
 */
export function Badge({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return <span className={`tag${accent ? ' tag--accent' : ''}`}>{children}</span>;
}
