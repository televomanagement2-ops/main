/**
 * Layout-aware placeholder: the same proportions as a real product card, so
 * the page never reflows when data lands.
 */
export function SkeletonCard({ portrait = false }: { portrait?: boolean }) {
  return (
    <div aria-hidden="true">
      <div className="sk" style={{ aspectRatio: portrait ? '4 / 5' : '1' }} />
      <div style={{ paddingTop: 'var(--s-3)', display: 'grid', gap: 8 }}>
        <div className="sk sk--text" style={{ width: '68%' }} />
        <div className="sk sk--text" style={{ width: '38%' }} />
      </div>
    </div>
  );
}
