import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFeaturedProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { Footer } from '../../../components/layout/Footer';
import { ProductCard } from '../components/ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';
import { useI18n } from '../../../lib/i18n';

type PromoTheme = 'delivery' | 'deals' | 'tech' | 'one-euro';

interface PromoSlide {
  id: PromoTheme;
  title: string;
  subtitle: string;
  kicker: string;
}

interface PromoProduct {
  slug: string;
  imageUrl: string;
  name: string;
  discountPct?: number;
}

const PROMO_PRODUCTS: Record<PromoTheme, PromoProduct[]> = {
  deals: [
    { slug: 'mechanical-keyboard-tkl', imageUrl: 'https://picsum.photos/seed/mechanical-keyboard-tkl/600/600', name: 'Mechanical Keyboard TKL', discountPct: 19 },
    { slug: 'laptop-stand-aluminium', imageUrl: 'https://picsum.photos/seed/laptop-stand-aluminium/600/600', name: 'Laptop Stand Aluminium', discountPct: 22 },
    { slug: 'slim-fit-chinos', imageUrl: 'https://picsum.photos/seed/slim-fit-chinos/600/600', name: 'Slim-Fit Chinos', discountPct: 18 },
    { slug: 'organic-denim-jacket', imageUrl: 'https://picsum.photos/seed/organic-denim-jacket/600/600', name: 'Organic Denim Jacket', discountPct: 21 },
  ],
  tech: [
    { slug: 'noise-isolating-earbuds', imageUrl: 'https://picsum.photos/seed/noise-isolating-earbuds/600/600', name: 'Noise-Isolating Earbuds' },
    { slug: 'portable-ssd-1tb', imageUrl: 'https://picsum.photos/seed/portable-ssd-1tb/600/600', name: 'Portable SSD 1TB' },
    { slug: 'prophone-x1', imageUrl: 'https://picsum.photos/seed/prophone-x1-2/600/600', name: 'ProPhone X1' },
    { slug: 'webcam-4k-pro', imageUrl: 'https://picsum.photos/seed/webcam-4k-pro/600/600', name: 'Webcam 4K Pro' },
  ],
  delivery: [
    { slug: 'oversized-hoodie', imageUrl: 'https://picsum.photos/seed/oversized-hoodie/600/600', name: 'Oversized Hoodie' },
    { slug: 'merino-wool-crewneck', imageUrl: 'https://picsum.photos/seed/merino-wool-crewneck/600/600', name: 'Merino Wool Crewneck' },
    { slug: 'monitor-27-4k-usbc', imageUrl: 'https://picsum.photos/seed/monitor-27-4k-usbc/600/600', name: '27" 4K Monitor' },
    { slug: 'relaxed-linen-shirt', imageUrl: 'https://picsum.photos/seed/relaxed-linen-shirt/600/600', name: 'Relaxed Linen Shirt' },
  ],
  'one-euro': [
    { slug: 'wireless-charging-pad-15w', imageUrl: 'https://picsum.photos/seed/wireless-charging-pad-15w/600/600', name: 'Wireless Charging Pad' },
    { slug: 'usb-c-hub-7in1', imageUrl: 'https://picsum.photos/seed/usb-c-hub-7in1-2/600/600', name: 'USB-C Hub 7-in-1' },
    { slug: 'classic-cotton-tshirt', imageUrl: 'https://picsum.photos/seed/classic-cotton-tshirt-2/600/600', name: 'Classic Cotton T-Shirt' },
    { slug: 'ceramic-plant-pot-set', imageUrl: 'https://picsum.photos/seed/ceramic-plant-pot-set-2/600/600', name: 'Ceramic Plant Pot Set' },
  ],
};

function PromoCardArt({ theme }: { theme: PromoTheme }) {
  const products = PROMO_PRODUCTS[theme];

  if (theme === 'deals') {
    return (
      <div className="promo-art promo-art--deals">
        {products.map((p) => (
          <Link key={p.slug} to={`/products/${p.slug}`} className="promo-deal-tile promo-deal-tile--link">
            <img src={p.imageUrl} alt={p.name} className="promo-deal-thumb promo-deal-thumb--img" loading="lazy" />
            <span className="promo-deal-badge">-{p.discountPct}%</span>
          </Link>
        ))}
      </div>
    );
  }

  if (theme === 'tech') {
    const techClasses = ['tech-orb--earbuds', 'tech-orb--ssd', 'tech-orb--phone', 'tech-orb--pen'];
    return (
      <div className="promo-art promo-art--tech">
        {products.map((p, i) => (
          <Link key={p.slug} to={`/products/${p.slug}`} className={`tech-orb ${techClasses[i]} tech-orb--img-link`} aria-label={p.name}>
            <img src={p.imageUrl} alt={p.name} className="tech-orb__img" loading="lazy" />
          </Link>
        ))}
      </div>
    );
  }

  if (theme === 'one-euro') {
    return (
      <div className="promo-art promo-art--one-euro">
        <span className="haul-star" aria-hidden="true">✦</span>
        <span className="haul-star haul-star--small" aria-hidden="true">✦</span>
        <div className="haul-ring haul-ring--one" aria-hidden="true" />
        <div className="haul-ring haul-ring--two" aria-hidden="true" />
        <div className="haul-sticker-row">
          {products.slice(0, 3).map((p) => (
            <Link key={p.slug} to={`/products/${p.slug}`} className="haul-sticker haul-sticker--img-link" aria-label={p.name}>
              <img src={p.imageUrl} alt={p.name} className="haul-sticker__img" loading="lazy" />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="promo-art promo-art--delivery">
      <div className="promo-delivery-grid">
        {products.map((p) => (
          <Link key={p.slug} to={`/products/${p.slug}`} className="promo-delivery-tile" aria-label={p.name}>
            <img src={p.imageUrl} alt={p.name} className="promo-delivery-tile__img" loading="lazy" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useFeaturedProducts();
  const { data: categories = [] } = useCategories();
  const [search, setSearch] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const promoSlides = useMemo<PromoSlide[]>(() => [
    {
      id: 'delivery',
      kicker: t('home.promo.delivery.kicker'),
      title: t('home.promo.delivery.title'),
      subtitle: t('home.promo.delivery.subtitle'),
    },
    {
      id: 'deals',
      kicker: t('home.promo.deals.kicker'),
      title: t('home.promo.deals.title'),
      subtitle: t('home.promo.deals.subtitle'),
    },
    {
      id: 'tech',
      kicker: t('home.promo.tech.kicker'),
      title: t('home.promo.tech.title'),
      subtitle: t('home.promo.tech.subtitle'),
    },
    {
      id: 'one-euro',
      kicker: t('home.promo.oneEuro.kicker'),
      title: t('home.promo.oneEuro.title'),
      subtitle: t('home.promo.oneEuro.subtitle'),
    },
  ], [t]);

  const categoryChips = categories
    .filter((category) => Boolean(category.slug) && Boolean(category.name))
    .sort((a, b) => {
      const aRoot = a.parent_id ? 1 : 0;
      const bRoot = b.parent_id ? 1 : 0;
      if (aRoot !== bRoot) return aRoot - bRoot;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 15);

  const activeTheme = promoSlides[activeSlide]?.id ?? 'delivery';

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

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const scrollToSlide = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = carouselRef.current;
    const target = cardRefs.current[index];
    if (!scroller || !target) return;
    const left = target.offsetLeft - (scroller.clientWidth - target.clientWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior });
  };

  useEffect(() => {
    const scroller = carouselRef.current;
    if (!scroller) return;

    const findActive = () => {
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const cardCenter = card.offsetLeft + card.clientWidth / 2;
        const distance = Math.abs(cardCenter - center);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });

      setActiveSlide((previous) => (previous === nearest ? previous : nearest));
    };

    findActive();
    scroller.addEventListener('scroll', findActive, { passive: true });
    return () => scroller.removeEventListener('scroll', findActive);
  }, []);

  useEffect(() => {
    if (isPaused || reduceMotion) return;
    const timer = window.setInterval(() => {
      const next = (activeSlide + 1) % promoSlides.length;
      scrollToSlide(next, 'smooth');
    }, 4400);
    return () => window.clearInterval(timer);
  }, [activeSlide, isPaused, promoSlides.length, reduceMotion]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/products?search=${encodeURIComponent(q)}`);
    setSearch('');
  };

  return (
    <div>
      <section className={`home-showcase home-showcase--${activeTheme}`}>
        <div className="container">
          <form className="showcase-search" role="search" onSubmit={handleSearch}>
            <span className="showcase-search__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              className="showcase-search__input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('home.searchPlaceholder')}
              aria-label={t('home.searchAria')}
            />
            <button type="submit" className="showcase-search__submit" aria-label={t('home.searchSubmitAria')}>
              {t('home.searchSubmit')}
            </button>
          </form>

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

          <div
            className="promo-carousel"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            <button
              type="button"
              className="promo-arrow promo-arrow--prev"
              aria-label={t('home.carouselPrev')}
                onClick={() => scrollToSlide((activeSlide - 1 + promoSlides.length) % promoSlides.length, 'smooth')}
            >
              <span aria-hidden="true">‹</span>
            </button>

            <div className="promo-carousel__track" ref={carouselRef}>
                {promoSlides.map((slide, index) => {
                const delta = index - activeSlide;
                const normalizedDelta = Math.max(-1, Math.min(1, delta));
                return (
                  <article
                    key={slide.id}
                    ref={(node) => {
                      cardRefs.current[index] = node;
                    }}
                    className={`promo-card promo-card--${slide.id} ${index === activeSlide ? 'is-active' : ''}`}
                    style={{ '--fold': `${normalizedDelta}` } as CSSProperties}
                  >
                    <header className="promo-card__header">
                      <p className="promo-card__kicker">{slide.kicker}</p>
                      <h2 className="promo-card__title">{slide.title}</h2>
                      <p className="promo-card__subtitle">{slide.subtitle}</p>
                    </header>
                    <PromoCardArt theme={slide.id} />
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              className="promo-arrow promo-arrow--next"
              aria-label={t('home.carouselNext')}
                onClick={() => scrollToSlide((activeSlide + 1) % promoSlides.length, 'smooth')}
            >
              <span aria-hidden="true">›</span>
            </button>

            <div className="promo-pagination" aria-label={t('home.carouselNav')}>
                {promoSlides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`promo-dot ${index === activeSlide ? 'is-active' : ''}`}
                  onClick={() => scrollToSlide(index, reduceMotion ? 'auto' : 'smooth')}
                    aria-label={t('home.carouselGoTo', { index: index + 1 })}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

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
