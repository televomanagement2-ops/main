import type { ReactNode } from 'react';

type Variant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

interface Props {
  children: ReactNode;
  variant?: Variant;
}

export function Badge({ children, variant = 'default' }: Props) {
  return (
    <span className={`badge badge-${variant}`}>
      {children}
    </span>
  );
}
