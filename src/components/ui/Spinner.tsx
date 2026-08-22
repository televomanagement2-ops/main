interface Props {
  size?: 'sm' | 'lg';
  /** Use inside a filled primary button, where the track must read on ink. */
  onAction?: boolean;
  label?: string;
}

export function Spinner({ size = 'sm', onAction, label = 'Loading' }: Props) {
  const classes = ['spinner', size === 'lg' ? 'spinner--lg' : '', onAction ? 'spinner--onAction' : '']
    .filter(Boolean)
    .join(' ');
  return <span className={classes} role="status" aria-label={label} />;
}
