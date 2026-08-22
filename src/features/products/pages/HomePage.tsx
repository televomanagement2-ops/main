import { Link } from 'react-router-dom';
import { useFeaturedProducts, useProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { ProductCard } from '../components/ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';
import { Media } from '../../../components/ui/Media';
import { Reveal } from '../../../components/ui/Reveal';
import {
  IconArrowRight,
  IconLock,
  IconReturn,
  IconSupport,
  IconTruck,
} from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import heroFallback from '../../../assets/hero.png';
import type { Category, Product } from '../../../types';

function primaryImage(product?: Product | null): string | null {
  if (!product) return null;
  return (
    product.product_images?.find((img) => img.is_primary)?.url ??
    product.product_images?.[0]?.url ??
    null
  );
}

export function HomePage() {
  const { t } = useI18n();

  // Featured is the curated view; if the operator hasn't flagged anything yet
  // the page still composes correctly from the newest catalogue entries.
  const { data: featured = [], isLoading: featuredLoading } = useFeaturedProducts();
  const needsFallback = !featuredLoading && featured.length === 0;
  const { data: fallback, isLoading: fallbackLoading } = useProducts(
    { pageSize: 9, page: 1 },
    { enabled: needsFallback }
  );
  const { data: categories = [] } = useCategories();

  const isLoading = featuredLoading || (needsFallback && fallbackLoading);
  const products = featured.length > 0 ? featured : (fallback?.data ?? []);

  const heroProduct = products[0];
  const heroImage = primaryImage(heroProduct) ?? heroFallback;

  const edit = products.slice(0, 6);
  const showcase = products.slice(6, 9);
  const storyImage =
    primaryImage(products[2]) ??
    categories.find((c) => c.image_url)?.image_url ??
    heroFallback;

  const sorted = [...categories].sort((a, b) => {
    const rootDelta = (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0);
    if (rootDelta !== 0) return rootDelta;
    return a.sort_order - b.sort_order;
  });
  const withImage = sorted.filter((c) => c.image_url);
  const withoutImage = sorted.filter((c) => !c.image_url);
  const feature = withImage[0] ?? withoutImage[0];
  const secondary = sorted.filter((c) => c.id !== feature?.id).slice(0, 3);
  const remaining = sorted.filter(
    (c) => c.id !== feature?.id && !secondary.some((s) => s.id === c.id)
  );

  return (
    <>
      {/* ── 01 · EDITORIAL HERO ─────────────────────────────────────── */}
      <section className="page hero" aria-labelledby="hero-title">
        <div className="hero__grid">
          {/* Editorial section index — small, real navigation, not decoration. */}
          <nav className="hero__index" aria-label={t('home.sectionIndex')}>
            <a href="#collections" className="hero__index-item">01</a>
            <span className="hero__index-rule" aria-hidden="true" />
            <a href="#edit" className="hero__index-item">02</a>
            <a href="#story" className="hero__index-item">03</a>
          </nav>

          <div className="hero__copy">
            <p className="t-label hero__eyebrow">{t('home.hero.eyebrow')}</p>
            <h1 id="hero-title" className="t-display hero__title">
              {t('home.hero.title')}
            </h1>
            <p className="t-body-lg hero__sub">{t('home.hero.subtitle')}</p>
            <div className="hero__cta">
              <Link to="/products" className="btn btn--primary">
                {t('home.hero.ctaPrimary')}
                <IconArrowRight size={16} />
              </Link>
              <a href="#collections" className="link-arrow">
                {t('home.hero.ctaSecondary')}
                <IconArrowRight size={14} />
              </a>
            </div>
          </div>

          <div className="hero__media">
            <Media src={heroImage} alt={heroProduct?.name ?? ''} ratio="free" loading="eager" />
            {heroProduct && (
              <Link to={`/products/${heroProduct.slug}`} className="hero__badge">
                <span>
                  <span className="t-label" style={{ display: 'block', marginBottom: 2 }}>
                    {t('home.hero.badgeLabel')}
                  </span>
                  {heroProduct.name}
                </span>
                <IconArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── 02 · CATEGORY GALLERY ───────────────────────────────────── */}
      {feature && (
        <section className="page section" id="collections" aria-labelledby="collections-title">
          <Reveal>
            <div className="section-head">
              <div>
                <p className="t-label">{t('home.categories.label')}</p>
                <h2 id="collections-title" className="t-h1 section-head__title">
                  {t('home.categories.title')}
                </h2>
              </div>
              <Link to="/products" className="link-arrow">
                {t('home.categories.browseAll')}
                <IconArrowRight size={14} />
              </Link>
            </div>
          </Reveal>

          <div className="cat-gallery__cols">
            <Reveal>
              <CategoryFeature category={feature} />
            </Reveal>

            <div className="cat-gallery__right">
              {secondary.map((category, i) => (
                <Reveal key={category.id} delay={80 + i * 60}>
                  <CategoryTile category={category} size={i === 0 ? 'wide' : 'small'} />
                </Reveal>
              ))}
            </div>
          </div>

          {remaining.length > 0 && (
            <div className="cat-more">
              <p className="t-label">{t('home.categories.more')}</p>
              {remaining.slice(0, 6).map((category) => (
                <Link key={category.id} to={`/products?category=${category.slug}`} className="cat-more__link">
                  {category.name}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 03 · THE EDIT ───────────────────────────────────────────── */}
      <section className="page section" id="edit" aria-labelledby="edit-title">
        <Reveal>
          <div className="section-head">
            <div>
              <p className="t-label">{t('home.editorEyebrow')}</p>
              <h2 id="edit-title" className="t-h1 section-head__title">
                {t('home.editorTitle')}
              </h2>
              <p className="t-sm t-faint section-head__sub">{t('home.editorSubtitle')}</p>
            </div>
            <Link to="/products" className="link-arrow">
              {t('home.viewAll')}
              <IconArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        {isLoading ? (
          <div className="product-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} portrait={i === 0} />
            ))}
          </div>
        ) : (
          <div className="edit-grid">
            {edit[0] && (
              <Reveal className="edit-grid__lead">
                <ProductCard product={edit[0]} variant="lead" ratio="portrait" index={1} />
              </Reveal>
            )}
            <div className="edit-grid__side">
              {edit.slice(1, 3).map((product, i) => (
                <Reveal key={product.id} delay={80 + i * 70}>
                  <ProductCard product={product} index={i + 2} />
                </Reveal>
              ))}
            </div>
            {edit.length > 3 && (
              <div className="edit-grid__row">
                {edit.slice(3, 6).map((product, i) => (
                  <Reveal key={product.id} delay={i * 70}>
                    <ProductCard product={product} index={i + 4} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 04 · BRAND STATEMENT ────────────────────────────────────── */}
      <section className="page section" aria-label={t('home.statement.label')}>
        <Reveal>
          <div className="statement">
            <p className="t-label statement__label">{t('home.statement.label')}</p>
            <p className="statement__text">
              {t('home.statement.lead')} <em>{t('home.statement.emphasis')}</em>
            </p>
            <div className="statement__foot">
              <p className="t-sm t-muted t-measure">{t('home.statement.support')}</p>
              <Link to="/help" className="link-arrow">
                {t('home.statement.link')}
                <IconArrowRight size={14} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── 05 · FULL-WIDTH STORY ───────────────────────────────────── */}
      <section className="story" id="story" aria-label={t('home.story.title')}>
        <Media src={storyImage} alt="" ratio="free" />
        <div className="story__overlay">
          <div className="story__inner">
            <p className="t-label story__label">{t('home.story.label')}</p>
            <p className="story__title">{t('home.story.title')}</p>
            <Link to="/products" className="link-arrow story__link">
              {t('home.story.link')}
              <IconArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 06 · SECONDARY SHOWCASE ─────────────────────────────────── */}
      {showcase.length > 0 && (
        <section className="page section" aria-labelledby="showcase-title">
          <div className="showcase">
            <Reveal className="showcase__hero">
              <ProductCard product={showcase[0]} variant="lead" ratio="tall" />
            </Reveal>

            <div className="showcase__note">
              <p className="t-label">{t('home.showcase.label')}</p>
              <h2 id="showcase-title" className="t-h2">{t('home.showcase.title')}</h2>
              <p className="t-sm t-faint">{t('home.showcase.body')}</p>
              <Link to="/products" className="link-arrow" style={{ marginTop: 'var(--s-2)' }}>
                {t('home.showcase.link')}
                <IconArrowRight size={14} />
              </Link>
            </div>

            <div className="showcase__stack">
              {showcase.slice(1).map((product, i) => (
                <Reveal key={product.id} delay={60 + i * 70}>
                  <ProductCard product={product} ratio="square" />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 07 · SERVICE STRIP ──────────────────────────────────────── */}
      <section className="page" aria-label={t('home.service.label')}>
        <div className="service-strip">
          <Service
            icon={<IconTruck size={18} />}
            title={t('home.trust.shippingTitle')}
            desc={t('home.trust.shippingDesc')}
          />
          <Service
            icon={<IconReturn size={18} />}
            title={t('home.trust.returnsTitle')}
            desc={t('home.trust.returnsDesc')}
          />
          <Service
            icon={<IconLock size={18} />}
            title={t('home.trust.secureTitle')}
            desc={t('home.trust.secureDesc')}
          />
          <Service
            icon={<IconSupport size={18} />}
            title={t('home.trust.supportTitle')}
            desc={t('home.trust.supportDesc')}
          />
        </div>
      </section>

      {/* ── 08 · CLOSING ────────────────────────────────────────────── */}
      <section className="page" aria-labelledby="closing-title">
        <Reveal>
          <div className="closing">
            <div className="closing__body">
              <h2 id="closing-title" className="closing__title">{t('home.closing.title')}</h2>
              <p className="t-body closing__sub">{t('home.closing.body')}</p>
            </div>
            <div className="closing__action">
              <Link to="/products" className="btn btn--primary btn--lg">
                {t('home.closing.cta')}
                <IconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function CategoryFeature({ category }: { category: Category }) {
  const { t } = useI18n();
  return (
    <Link to={`/products?category=${category.slug}`} className="cat-card cat-card--feature">
      {category.image_url ? (
        <>
          <Media src={category.image_url} alt="" ratio="portrait" zoom />
          <div className="cat-card__overlay">
            <div>
              <p className="cat-card__name">{category.name}</p>
              {category.description && <p className="cat-card__desc">{category.description}</p>}
            </div>
            <IconArrowRight size={18} className="cat-card__arrow" />
          </div>
        </>
      ) : (
        <div className="cat-card--type" style={{ minHeight: 'clamp(280px, 34vw, 460px)' }}>
          <p className="t-label">{t('home.categories.label')}</p>
          <div className="row row--between gap-4" style={{ alignItems: 'flex-end' }}>
            <div>
              <p className="cat-card__name">{category.name}</p>
              {category.description && <p className="cat-card__desc">{category.description}</p>}
            </div>
            <IconArrowRight size={18} className="cat-card__arrow" />
          </div>
        </div>
      )}
    </Link>
  );
}

function CategoryTile({ category, size }: { category: Category; size: 'wide' | 'small' }) {
  if (!category.image_url) {
    return (
      <Link to={`/products?category=${category.slug}`} className="cat-card cat-card--type">
        <p className="cat-card__name">{category.name}</p>
        <div className="row row--between gap-4" style={{ alignItems: 'flex-end' }}>
          {category.description ? (
            <p className="cat-card__desc" style={{ maxWidth: '24ch' }}>{category.description}</p>
          ) : (
            <span />
          )}
          <IconArrowRight size={16} className="cat-card__arrow" />
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/products?category=${category.slug}`} className={`cat-card cat-card--${size}`}>
      <Media src={category.image_url} alt="" ratio={size === 'wide' ? 'landscape' : 'square'} zoom />
      <div className="cat-card__body">
        <div>
          <p className="cat-card__name">{category.name}</p>
          {category.description && <p className="cat-card__desc">{category.description}</p>}
        </div>
        <IconArrowRight size={16} className="cat-card__arrow" />
      </div>
    </Link>
  );
}

function Service({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="service">
      <span className="service__icon">{icon}</span>
      <div>
        <p className="service__title">{title}</p>
        <p className="service__desc">{desc}</p>
      </div>
    </div>
  );
}
