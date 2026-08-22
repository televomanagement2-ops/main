import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Stagger within a group, in ms. Kept small — this is punctuation, not choreography. */
  delay?: number;
  as?: ElementType;
  className?: string;
}

/**
 * Section-entry motion: opacity and transform only, triggered once when the
 * element first enters the viewport. Reduced motion is handled in CSS (the
 * .reveal rule collapses to its final state), and if IntersectionObserver is
 * unavailable the content starts visible.
 */
export function Reveal({ children, delay = 0, as: Tag = 'div', className }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = ref.current;
    if (!node || shown) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  const classes = ['reveal', shown ? 'is-in' : '', className].filter(Boolean).join(' ');

  return (
    <Tag
      ref={ref}
      className={classes}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
