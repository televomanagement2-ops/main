import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFeaturedProducts } from '../../../hooks/useProducts';
import { useCategories } from '../../../hooks/useCategories';
import { Footer } from '../../../components/layout/Footer';
import { ProductCard } from '../components/ProductCard';
import { SkeletonCard } from '../../../components/ui/SkeletonCard';

type PromoTheme = 'delivery' | 'deals' | 'tech' | 'one-euro';

interface PromoSlide {
  id: PromoTheme;
  title: string;
  subtitle: string;
  kicker: string;
}

const PROMO_SLIDES: PromoSlide[] = [
  {
    id: 'delivery',
    kicker: 'Spedizioni',
    title: 'Prima consegna gratuita',
    subtitle: 'Clicca qui per maggiori informazioni',
  },
  {
    id: 'deals',
    kicker: 'Offerte',
    title: 'Offerte in scadenza',
    subtitle: 'Sconti fino al 35% su categorie selezionate',
  },
  {
    id: 'tech',
    kicker: 'Tech Hub',
    title: 'Hub tecnologico',
    subtitle: 'Apri nuove possibilita',
  },
  {
    id: 'one-euro',
    kicker: 'Amazon Haul',
    title: 'Tutto a meno di 1 euro',
    subtitle: 'Prezzi mini su accessori di ogni giorno',
  },
];

function PromoCardArt({ theme }: { theme: PromoTheme }) {
  if (theme === 'deals') {
    return (
      <div className="promo-art promo-art--deals" aria-hidden="true">
        {[35, 28, 19, 6].map((discount) => (
          <div key={discount} className="promo-deal-tile">
            <div className="promo-deal-thumb" />
            <span className="promo-deal-badge">{discount}% di sconto</span>
          </div>
        ))}
      </div>
    );
  }

  if (theme === 'tech') {
    return (
      <div className="promo-art promo-art--tech" aria-hidden="true">
        <div className="tech-orb tech-orb--earbuds" />
        <div className="tech-orb tech-orb--ssd" />
        <div className="tech-orb tech-orb--phone" />
        <div className="tech-orb tech-orb--pen" />
      </div>
    );
  }

  if (theme === 'one-euro') {
    return (
      <div className="promo-art promo-art--one-euro" aria-hidden="true">
        <span className="haul-star">✦</span>
        <span className="haul-star haul-star--small">✦</span>
        <div className="haul-ring haul-ring--one" />
        <div className="haul-ring haul-ring--two" />
        <div className="haul-sticker-row">
          <div className="haul-sticker" />
          <div className="haul-sticker" />
          <div className="haul-sticker" />
        </div>
      </div>
    );
  }

  return (
    <div className="promo-art promo-art--delivery" aria-hidden="true">
      <div className="delivery-cut delivery-cut--one" />
      <div className="delivery-cut delivery-cut--two" />
      <div className="delivery-figure" />
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useFeaturedProducts();
  const { data: categories = [] } = useCategories();
  const [search, setSearch] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const categoryChips = categories
    .filter((category) => Boolean(category.slug) && Boolean(category.name))
    .sort((a, b) => {
      const aRoot = a.parent_id ? 1 : 0;
      const bRoot = b.parent_id ? 1 : 0;
      if (aRoot !== bRoot) return aRoot - bRoot;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 15);

  const activeTheme = PROMO_SLIDES[activeSlide]?.id ?? 'delivery';

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
      const next = (activeSlide + 1) % PROMO_SLIDES.length;
      scrollToSlide(next, 'smooth');
    }, 4400);
    return () => window.clearInterval(timer);
  }, [activeSlide, isPaused, reduceMotion]);

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
              placeholder="Cerca su ShopBase"
              aria-label="Cerca su ShopBase"
            />
            <button type="submit" className="showcase-search__submit" aria-label="Avvia ricerca">
              Vai
            </button>
          </form>

          <div className="trend-chips" role="list" aria-label="Categorie in evidenza">
            {categoryChips.map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                className="trend-chip"
                role="listitem"
                aria-label={`Apri categoria ${category.name}`}
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
              aria-label="Slide precedente"
              onClick={() => scrollToSlide((activeSlide - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length, 'smooth')}
            >
              <span aria-hidden="true">‹</span>
            </button>

            <div className="promo-carousel__track" ref={carouselRef}>
              {PROMO_SLIDES.map((slide, index) => {
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
              aria-label="Prossima slide"
              onClick={() => scrollToSlide((activeSlide + 1) % PROMO_SLIDES.length, 'smooth')}
            >
              <span aria-hidden="true">›</span>
            </button>

            <div className="promo-pagination" aria-label="Navigazione carosello promozioni">
              {PROMO_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`promo-dot ${index === activeSlide ? 'is-active' : ''}`}
                  onClick={() => scrollToSlide(index, reduceMotion ? 'auto' : 'smooth')}
                  aria-label={`Vai alla slide ${index + 1}`}
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
                <span className="section-eyebrow">Editor selection</span>
                <h2 className="heading-1" style={{ marginBottom: 'var(--sp-2)' }}>Curated products for your next order</h2>
                <p className="home-feed__subtitle">Una selezione professionale aggiornata ogni giorno con i prodotti piu rilevanti del catalogo.</p>
              </div>
              <Link to="/products" className="btn btn-ghost btn-sm">
                View all →
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
