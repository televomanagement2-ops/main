import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFeaturedProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { Footer } from '../../../components/layout/Footer';
import { ProductCard } from '../components/ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';
import { useI18n } from '../../../lib/i18n';

function TrustItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="trust-item">
      <span className="trust-item__icon" aria-hidden="true">{icon}</span>
      <div className="trust-item__text">
        <p className="trust-item__title">{title}</p>
        <p className="trust-item__desc">{desc}</p>
      </div>
    </div>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const { data: products = [], isLoading } = useFeaturedProducts();
  const { data: categories = [] } = useCategories();

  const categoryChips = categories
    .filter((category) => Boolean(category.slug) && Boolean(category.name))
    .sort((a, b) => {
      const aRoot = a.parent_id ? 1 : 0;
      const bRoot = b.parent_id ? 1 : 0;
      if (aRoot !== bRoot) return aRoot - bRoot;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 12);

  useEffect(() => {
    const resetScrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };
    resetScrollTop();
    const rafId = window.requestAnimationFrame(resetScrollTop);
    const timeoutId = window.setTimeout(resetScrollTop, 80);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div>
      {/* ── Editorial hero ──────────────────────────────── */}
      <section className="home-hero">
        <div className="container home-hero__inner">
          <p className="home-hero__eyebrow">{t('home.hero.eyebrow')}</p>
          <h1 className="home-hero__title">{t('home.hero.title')}</h1>
          <p className="home-hero__subtitle">{t('home.hero.subtitle')}</p>
          <div className="home-hero__actions">
            <Link to="/products" className="btn btn-primary btn-lg">
              {t('home.hero.ctaPrimary')}
            </Link>
            <Link to="/products" className="btn btn-secondary btn-lg">
              {t('home.hero.ctaSecondary')}
            </Link>
          </div>

          {categoryChips.length > 0 && (
            <div className="trend-chips" role="list" aria-label={t('home.trendingAria')}>
              {categoryChips.map((category) => (
                <Link
                  key={category.id}
                  to={`/products?category=${category.slug}`}
                  className="trend-chip"
                  role="listitem"
                  aria-label={t('home.trendingCategory', { name: category.name })}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────── */}
      <section className="home-trust">
        <div className="container home-trust__row">
          <TrustItem
            icon={(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            )}
            title={t('home.trust.shippingTitle')}
            desc={t('home.trust.shippingDesc')}
          />
          <TrustItem
            icon={(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6a9 9 0 0 0 9 9 9 9 0 0 0 9-9" /><polyline points="3 7 8 7 8 2" /><path d="M21 11a9 9 0 0 0-9-9 9 9 0 0 0-7 3.3" />
              </svg>
            )}
            title={t('home.trust.returnsTitle')}
            desc={t('home.trust.returnsDesc')}
          />
          <TrustItem
            icon={(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            title={t('home.trust.secureTitle')}
            desc={t('home.trust.secureDesc')}
          />
        </div>
      </section>

      {/* ── Curated feed ────────────────────────────────── */}
      <div className="home-feed-layer">
        <section className="section section--bordered home-feed">
          <div className="container">
            <div className="section-header">
              <div>
                <span className="section-eyebrow">{t('home.editorEyebrow')}</span>
                <h2 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>{t('home.editorTitle')}</h2>
                <p className="home-feed__subtitle">{t('home.editorSubtitle')}</p>
              </div>
              <Link to="/products" className="btn btn-ghost btn-sm">
                {t('home.viewAll')} →
              </Link>
            </div>

            {isLoading ? (
              <div className="product-grid home-feed__grid product-grid--staggered">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="product-grid home-feed__grid product-grid--staggered">
                {products.map((p) => <ProductCard key={p.id} product={p} showActionButton={false} />)}
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
