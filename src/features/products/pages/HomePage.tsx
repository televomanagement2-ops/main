import { Link } from 'react-router-dom';
import { useFeaturedProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { ProductCard } from '../components/ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';

const CATEGORY_ICONS: Record<string, string> = {
  electronics:   '⚡',
  clothing:      '👕',
  'home-garden': '🪴',
  smartphones:   '📱',
};

function TrustStrip() {
  return (
    <div className="trust-strip">
      <div className="trust-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Secure checkout
      </div>
      <div className="trust-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1"/>
          <path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        Free standard shipping
      </div>
      <div className="trust-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
        Quality guaranteed
      </div>
      <div className="trust-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        24/7 support
      </div>
    </div>
  );
}

export function HomePage() {
  const { data: products = [], isLoading } = useFeaturedProducts();
  const { data: categories = [] } = useCategories();
  const rootCategories = categories.filter((c) => !c.parent_id).slice(0, 6);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <p className="hero-eyebrow">
            <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="4" r="4"/>
            </svg>
            Curated selection · Free shipping available
          </p>
          <h1 className="hero-title">
            Quality you can feel.<br />
            <em>Prices that make sense.</em>
          </h1>
          <p className="hero-subtitle">
            Hand-picked electronics, clothing, and home goods.
            No noise, no gimmicks — just products worth owning,
            at prices that are actually fair.
          </p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-primary btn-xl">
              Shop all products
            </Link>
            <Link to="/products" className="btn btn-secondary btn-xl">
              Browse catalogue →
            </Link>
          </div>
          <TrustStrip />
        </div>
      </section>

      <div className="hero-divider" />

      {/* ── Categories ───────────────────────────────────────── */}
      {rootCategories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <div className="section-header">
              <div>
                <span className="section-eyebrow">Browse</span>
                <h2 className="heading-1" style={{ marginBottom: 0 }}>Shop by category</h2>
              </div>
              <Link to="/products" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            <div className="category-row">
              {rootCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.slug}`}
                  className="category-tile"
                >
                  <span className="category-tile__icon">
                    {CATEGORY_ICONS[cat.slug] ?? '🛍'}
                  </span>
                  <span className="category-tile__name">{cat.name}</span>
                  {cat.description && (
                    <span className="category-tile__desc">{cat.description}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured products ─────────────────────────────────── */}
      <section className="section section--bordered">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="section-eyebrow">Hand-picked</span>
              <h2 className="heading-1" style={{ marginBottom: 0 }}>Featured picks</h2>
            </div>
            <Link to="/products" className="btn btn-ghost btn-sm">
              View all →
            </Link>
          </div>

          {isLoading ? (
            <div className="product-grid">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="product-grid">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── Premium CTA ──────────────────────────────────────── */}
      <section style={{ padding: 'var(--sp-24) 0', borderTop: '1px solid var(--color-border)', background: 'var(--gray-25)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--sp-10)', alignItems: 'center' }}>
            <div style={{ maxWidth: 560 }}>
              <span className="section-eyebrow">Why ShopBase</span>
              <h2 className="display-2" style={{ marginBottom: 'var(--sp-5)' }}>
                Every product, carefully selected.
              </h2>
              <p className="body-lg" style={{ marginBottom: 'var(--sp-8)' }}>
                We stock only what we'd use ourselves — tested, thoughtfully chosen,
                and fairly priced. No inflated "original" prices, no cheap alternatives.
              </p>
              <Link to="/products" className="btn btn-primary btn-lg">
                Explore the catalogue
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
              {[
                { icon: '✦', label: 'Curated catalog', desc: 'Only what earns its place' },
                { icon: '◎', label: 'Real reviews',    desc: 'From verified buyers' },
                { icon: '⟳', label: 'Easy returns',    desc: 'No questions asked' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--r-lg)',
                    background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{item.label}</p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
