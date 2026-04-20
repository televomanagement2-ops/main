export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-img" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-line skeleton-line-sm" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" style={{ width: '75%' }} />
        <div className="skeleton skeleton-line-lg" style={{ marginTop: 'var(--sp-1)' }} />
      </div>
    </div>
  );
}
