import { Link } from 'react-router-dom';
import { storeConfig } from '../../config/storeConfig';

interface Props {
  /** `sm` for the header, `lg` for menus, `serif` for brand moments. */
  size?: 'sm' | 'lg' | 'serif';
  to?: string | null;
  className?: string;
}

/* The identity's one deliberate departure from the typeface: the initial A is
   drawn without its crossbar. Two glyphs, because the wordmark is set in Inter
   in the interface and in Instrument Serif for brand moments — a single shape
   would read as the wrong font in one of the two places.

   Both are drawn on a 94 × 100 box where y=100 is the baseline and y=0 the cap
   line, so the SVG's bottom edge sits on the text baseline at any size. Inner
   edges are parallel to their outer edges, so each stroke keeps one thickness
   from apex to foot. */
const GLYPH_A_SANS = 'M44 0h6l44 100H79L47 27 15 100H0Z';
const GLYPH_A_SERIF = 'M46 0h6l42 100H72L41 27 8 100H0Z';

/**
 * The wordmark is typographic, not a logo lockup: the store name set in wide
 * uppercase tracking, or in the editorial serif for brand moments (footer,
 * sign-in). One component so the identity is identical everywhere it appears.
 *
 * The crossbar-less A is applied only when the configured store name actually
 * starts with an A — a licensee who renames the store still gets a clean
 * typographic wordmark rather than a mismatched initial.
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

  const name = storeConfig.storeName;
  const usesGlyph = /^a/i.test(name);

  const content = usesGlyph ? (
    <>
      <svg
        className="wordmark__a"
        viewBox="0 0 94 100"
        aria-hidden="true"
        focusable="false"
      >
        <path d={size === 'serif' ? GLYPH_A_SERIF : GLYPH_A_SANS} />
      </svg>
      <span aria-hidden="true">{name.slice(1)}</span>
    </>
  ) : (
    name
  );

  if (!to) {
    return (
      <span className={classes}>
        {usesGlyph && <span className="sr-only">{name}</span>}
        {content}
      </span>
    );
  }
  return (
    <Link to={to} className={classes} aria-label={name}>
      {content}
    </Link>
  );
}
