/**
 * Layout-aware loading states. Each one mirrors the shape of the content it
 * stands in for, so the page never jumps when data lands and the wait reads as
 * "this page, loading" rather than "something, somewhere".
 */

export function ProductDetailSkeleton() {
  return (
    <div className="page" aria-hidden="true">
      <div className="sk sk--text" style={{ width: 220, marginTop: 'var(--s-6)' }} />
      <div className="pdp">
        <div className="pdp__gallery">
          <div className="sk" style={{ aspectRatio: '4 / 5' }} />
          <div className="pdp__support">
            <div className="sk" style={{ aspectRatio: '1' }} />
            <div className="sk" style={{ aspectRatio: '1' }} />
          </div>
        </div>
        <div className="pdp__info">
          <div className="sk sk--text" style={{ width: 90 }} />
          <div className="sk" style={{ height: 34, width: '80%' }} />
          <div className="sk" style={{ height: 22, width: 110 }} />
          <div className="stack gap-2">
            <div className="sk sk--text" />
            <div className="sk sk--text" />
            <div className="sk sk--text" style={{ width: '60%' }} />
          </div>
          <div className="sk" style={{ height: 44, width: '100%' }} />
        </div>
      </div>
    </div>
  );
}

/** Rows for list and table views — same rhythm as the real rows. */
export function RowsSkeleton({ rows = 6, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--s-5)',
            height,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div className="sk sk--text" style={{ width: `${40 - (i % 3) * 6}%` }} />
          <div className="sk sk--text" style={{ width: 72 }} />
        </div>
      ))}
    </div>
  );
}

/** Dashboard: the revenue metric and its chart, held in place while loading. */
export function DashboardSkeleton() {
  return (
    <div aria-hidden="true" style={{ paddingTop: 'var(--s-10)' }}>
      <div className="dash-hero">
        <div className="dash-hero__primary">
          <div className="sk sk--text" style={{ width: 120 }} />
          <div className="sk" style={{ height: 48, width: 240 }} />
          <div className="sk" style={{ height: 260 }} />
        </div>
        <div className="dash-hero__secondary">
          <RowsSkeleton rows={4} height={64} />
        </div>
      </div>
    </div>
  );
}
