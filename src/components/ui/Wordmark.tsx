import { Link } from 'react-router-dom';
import { storeConfig } from '../../config/storeConfig';

interface Props {
  /** `sm` for the header, `lg` for menus, `serif` for brand moments. */
  size?: 'sm' | 'lg' | 'serif';
  to?: string | null;
  className?: string;
}

/**
 * The wordmark is typographic, not a logo lockup: the store name set in wide
 * uppercase tracking, or in the editorial serif for brand moments (footer,
 * sign-in). One component so the identity is identical everywhere it appears.
 */
export function Wordmark({ size = 'sm', to = '/', className }: Props) {
  const classes = [
    'wordmark',
    size === 'lg' ? 'wordmark--lg' : '',
    size === 'serif' ? 'wordmark--serif' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = storeConfig.storeName;

  if (!to) return <span className={classes}>{content}</span>;
  return (
    <Link to={to} className={classes} aria-label={storeConfig.storeName}>
      {content}
    </Link>
  );
}
