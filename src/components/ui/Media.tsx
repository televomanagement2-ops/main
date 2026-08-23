import { useState, type CSSProperties } from 'react';

type Ratio = 'square' | 'portrait' | 'tall' | 'landscape' | 'wide' | 'free';

interface Props {
  src?: string | null;
  alt: string;
  ratio?: Ratio;
  /** Adds the slow 1.025 hover zoom used across editorial surfaces. */
  zoom?: boolean;
  className?: string;
  style?: CSSProperties;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

const RATIO_CLASS: Record<Ratio, string> = {
  square: 'media--square',
  portrait: 'media--portrait',
  tall: 'media--tall',
  landscape: 'media--landscape',
  wide: 'media--wide',
  free: '',
};

/**
 * The single image primitive. Product photography is the primary material of
 * this store, so every image gets the same treatment: a warm neutral bed while
 * it loads, then a quiet cross-fade in — never a pop-in, never a spinner.
 */
export function Media({
  src,
  alt,
  ratio = 'square',
  zoom = false,
  className,
  style,
  loading = 'lazy',
  sizes,
}: Props) {
  // Track WHICH src finished, not just "something finished": a bare boolean
  // stayed true when the source changed (the PDP gallery, a re-fetched cart
  // line), so the incoming image inherited `is-loaded` and was painted at full
  // opacity while it was still downloading.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = src != null && loadedSrc === src;

  const classes = ['media', RATIO_CLASS[ratio], zoom ? 'media--zoom' : '', className]
    .filter(Boolean)
    .join(' ');

  if (!src) {
    return <div className={classes} style={style} role="presentation" />;
  }

  return (
    <div className={classes} style={style}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        sizes={sizes}
        decoding="async"
        className={loaded ? 'is-loaded' : undefined}
        ref={(node) => {
          // Cached images can complete before React attaches onLoad.
          if (node?.complete && !loaded) setLoadedSrc(src);
        }}
        onLoad={() => setLoadedSrc(src)}
      />
    </div>
  );
}
