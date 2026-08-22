import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProduct, useProducts } from '../../../hooks/useProducts';
import { useReviews, useSubmitReview, useHasPurchased } from '../../../hooks/useReviews';
import { useCartStore } from '../../../store/cartStore';
import { useUiStore } from '../../../store/uiStore';
import { useAuth } from '../../../hooks/useAuth';
import { ProductDetailSkeleton } from '../../../components/ui/Skeletons';
import { Media } from '../../../components/ui/Media';
import { Reveal } from '../../../components/ui/Reveal';
import { StockStatus } from '../../../components/ui/StatusIndicator';
import { ProductCard } from '../components/ProductCard';
import {
  IconCheck,
  IconLock,
  IconMinus,
  IconPlus,
  IconReturn,
  IconStar,
  IconTruck,
} from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import type { Product, ProductImage, ProductVariant } from '../../../types';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, error } = useProduct(slug ?? '');
  const { t } = useI18n();

  if (isLoading) return <ProductDetailSkeleton />;

  if (error || !product) {
    return (
      <div className="page">
        <div className="empty empty--center" style={{ paddingBlock: 'clamp(80px, 12vw, 180px)' }}>
          <p className="t-label">{t('product.notFoundLabel')}</p>
          <p className="empty__title">{t('product.notFoundTitle')}</p>
          <p className="empty__body">{t('product.notFoundSubtitle')}</p>
          <Link to="/products" className="btn btn--primary">
            {t('product.backToProducts')}
          </Link>
        </div>
      </div>
    );
  }

  // Keyed so switching products resets gallery, size and quantity state.
  return <ProductView key={product.id} product={product} />;
}

function ProductView({ product }: { product: Product }) {
  const { t, formatCurrency } = useI18n();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUiStore((s) => s.open);

  const [activeImage, setActiveImage] = useState<ProductImage | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);

  const variants: ProductVariant[] = useMemo(
    () => (product.product_variants ? [...product.product_variants].sort((a, b) => a.sort_order - b.sort_order) : []),
    [product.product_variants]
  );
  const hasVariants = variants.length > 0;

  const images = product.product_images ?? [];
  const primary = images.find((i) => i.is_primary) ?? images[0];
  const displayed = activeImage ?? primary;
  const support = images.filter((i) => i.id !== displayed?.id).slice(0, 2);

  const isOut = product.stock_quantity === 0;

  const { data: relatedPage } = useProducts({
    categorySlug: product.categories?.slug,
    pageSize: 5,
    page: 1,
  });
  const related = (relatedPage?.data ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  const requireSize = () => {
    if (hasVariants && !selectedSize) {
      setSizeError(true);
      return false;
    }
    return true;
  };

  const handleAdd = () => {
    if (!requireSize()) return;
    addItem(product, quantity, selectedSize);
    setSizeError(false);
    setAdded(true);
    openCart('cart');
    window.setTimeout(() => setAdded(false), 2200);
  };

  const handleBuyNow = () => {
    if (!requireSize()) return;
    addItem(product, quantity, selectedSize);
    navigate('/checkout');
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label={t('product.breadcrumbLabel')} style={{ paddingTop: 'var(--s-6)' }}>
        <Link to="/">{t('sidebar.home')}</Link>
        <span className="crumbs__sep">/</span>
        <Link to="/products">{t('nav.shop')}</Link>
        {product.categories && (
          <>
            <span className="crumbs__sep">/</span>
            <Link to={`/products?category=${product.categories.slug}`}>{product.categories.name}</Link>
          </>
        )}
        <span className="crumbs__sep">/</span>
        <span style={{ color: 'var(--ink-2)' }}>{product.name}</span>
      </nav>

      <div className="pdp">
        {/* ── Gallery ── */}
        <div className="pdp__gallery">
          <div className="pdp__main">
            <Media
              src={displayed?.url}
              alt={displayed?.alt_text ?? product.name}
              ratio="portrait"
              loading="eager"
            />
          </div>

          {images.length > 1 && (
            <>
              <div className="pdp__support">
                {support.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImage(image)}
                    aria-label={image.alt_text ?? t('product.imageAlt')}
                  >
                    <Media src={image.url} alt={image.alt_text ?? ''} ratio="square" zoom />
                  </button>
                ))}
              </div>

              {images.length > 3 && (
                <div className="pdp__thumbs">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      className={`pdp__thumb${displayed?.id === image.id ? ' is-active' : ''}`}
                      onClick={() => setActiveImage(image)}
                      aria-label={image.alt_text ?? t('product.imageAlt')}
                      aria-pressed={displayed?.id === image.id}
                    >
                      <img src={image.url} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Information ── */}
        <div className="pdp__info">
          {product.categories && (
            <Link to={`/products?category=${product.categories.slug}`} className="t-label pdp__cat">
              {product.categories.name}
            </Link>
          )}

          <h1 className="pdp__name">{product.name}</h1>
          <p className="pdp__price">{formatCurrency(product.price)}</p>

          {product.description && <p className="pdp__desc">{product.description}</p>}

          <div className="pdp__rule" />

          {hasVariants && (
            <div className="field">
              <span className="field__label">
                {t('cart.size')}
                {selectedSize && <span style={{ color: 'var(--ink)' }}> — {selectedSize}</span>}
              </span>
              <div className="size-grid">
                {variants.map((variant) => {
                  const soldOut = variant.stock_qty === 0;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={`size-btn${selectedSize === variant.size ? ' is-active' : ''}`}
                      onClick={() => {
                        setSelectedSize(variant.size);
                        setSizeError(false);
                      }}
                      disabled={soldOut}
                      aria-pressed={selectedSize === variant.size}
                      title={soldOut ? t('product.stockOut') : variant.size}
                    >
                      {variant.size}
                    </button>
                  );
                })}
              </div>
              {sizeError && <p className="field__error">{t('product.sizeError')}</p>}
            </div>
          )}

          <StockStatus quantity={product.stock_quantity} threshold={product.low_stock_threshold} />

          {isOut ? (
            <button type="button" className="btn btn--secondary btn--lg btn--block" disabled>
              {t('product.stockOut')}
            </button>
          ) : (
            <>
              <div className="pdp__actions">
                <div className="stepper" aria-label={t('cart.quantity')}>
                  <button
                    type="button"
                    className="stepper__btn"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label={t('cart.decrease')}
                  >
                    <IconMinus size={14} />
                  </button>
                  <span className="stepper__value" aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    className="stepper__btn"
                    onClick={() => setQuantity((q) => Math.min(q + 1, product.stock_quantity))}
                    disabled={quantity >= product.stock_quantity}
                    aria-label={t('cart.increase')}
                  >
                    <IconPlus size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  className={`btn btn--primary${added ? ' is-done' : ''}`}
                >
                  {added ? (
                    <>
                      <IconCheck size={16} />
                      {t('product.addedToCart')}
                    </>
                  ) : (
                    t('product.addToCart')
                  )}
                </button>
              </div>

              <button type="button" onClick={handleBuyNow} className="btn btn--quiet" style={{ alignSelf: 'flex-start' }}>
                {t('product.buyNow')}
              </button>
            </>
          )}

          <div className="pdp__rule" />

          <dl className="pdp__meta-list">
            <div className="pdp__meta-row">
              <dt>{t('product.meta.shipping')}</dt>
              <dd>{t('product.meta.shippingValue')}</dd>
            </div>
            <div className="pdp__meta-row">
              <dt>{t('product.meta.returns')}</dt>
              <dd>{t('product.meta.returnsValue')}</dd>
            </div>
            {product.sku && (
              <div className="pdp__meta-row">
                <dt>{t('product.meta.sku')}</dt>
                <dd className="t-mono">{product.sku}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* ── Story, specifications, care ── */}
      <div className="pdp__sections">
        <div className="pdp__section">
          <p className="t-label">{t('product.sections.storyLabel')}</p>
          <h2 className="t-h3">{t('product.sections.storyTitle')}</h2>
          <p className="pdp__section-body">
            {product.description ?? t('product.sections.storyFallback')}
          </p>
        </div>

        <div className="pdp__section">
          <p className="t-label">{t('product.sections.specsLabel')}</p>
          <dl className="spec-list">
            {product.categories && (
              <div className="spec-row">
                <dt>{t('products.category')}</dt>
                <dd>{product.categories.name}</dd>
              </div>
            )}
            {product.sku && (
              <div className="spec-row">
                <dt>{t('product.meta.sku')}</dt>
                <dd className="t-mono">{product.sku}</dd>
              </div>
            )}
            {product.weight_grams != null && (
              <div className="spec-row">
                <dt>{t('product.meta.weight')}</dt>
                <dd>{product.weight_grams} g</dd>
              </div>
            )}
            <div className="spec-row">
              <dt>{t('product.meta.availability')}</dt>
              <dd>
                <StockStatus quantity={product.stock_quantity} threshold={product.low_stock_threshold} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="pdp__section">
          <p className="t-label">{t('product.sections.serviceLabel')}</p>
          <div className="stack gap-4" style={{ marginTop: 'var(--s-1)' }}>
            <ServiceLine icon={<IconTruck size={16} />} title={t('home.trust.shippingTitle')} desc={t('home.trust.shippingDesc')} />
            <ServiceLine icon={<IconReturn size={16} />} title={t('home.trust.returnsTitle')} desc={t('home.trust.returnsDesc')} />
            <ServiceLine icon={<IconLock size={16} />} title={t('home.trust.secureTitle')} desc={t('home.trust.secureDesc')} />
          </div>
        </div>
      </div>

      {/* ── Reviews ── */}
      <ReviewsSection productId={product.id} />

      {/* ── Related ── */}
      {related.length > 0 && (
        <section className="section" aria-labelledby="related-title">
          <Reveal>
            <div className="section-head">
              <div>
                <p className="t-label">{t('product.related.label')}</p>
                <h2 id="related-title" className="t-h2 section-head__title">
                  {t('product.related.title')}
                </h2>
              </div>
              <Link to="/products" className="link-arrow">{t('home.viewAll')}</Link>
            </div>
          </Reveal>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ServiceLine({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
      <span className="service__icon">{icon}</span>
      <div>
        <p className="service__title">{title}</p>
        <p className="service__desc">{desc}</p>
      </div>
    </div>
  );
}

/* ── Reviews ─────────────────────────────────────────────────────────── */

function Stars({
  value,
  onChange,
  readOnly = true,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(0);
  const shown = readOnly ? value : hovered || value;

  return (
    <div
      className={`stars${readOnly ? '' : ' stars--input'}`}
      aria-label={t('product.ratingAria', { value })}
      style={{ color: 'var(--rating)' }}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <IconStar size={15} filled={n <= shown} />;
        if (readOnly) return <span key={n}>{star}</span>;
        return (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange?.(n)}
            aria-label={t('product.ratingAria', { value: n })}
            style={{ display: 'grid', color: n <= shown ? 'var(--rating)' : 'var(--ink-3)' }}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useReviews(productId);
  const { data: hasPurchased = false } = useHasPurchased(productId, user?.id);
  const { mutate: submit, isPending, error: submitError } = useSubmitReview(productId);
  const { t, tCount, formatDate } = useI18n();

  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const average = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return (
    <section className="section reviews" aria-label={t('product.reviews.ariaLabel')}>
      <div className="reviews__head">
        <p className="t-label">{t('product.reviews.label')}</p>
        <h2 className="t-h2" style={{ marginTop: 'var(--s-3)' }}>{t('product.reviews.title')}</h2>
        {reviews.length > 0 && (
          <div className="row gap-3" style={{ marginTop: 'var(--s-4)' }}>
            <Stars value={Math.round(average)} />
            <span className="t-sm t-faint">
              {average} · {tCount('product.reviews.count', reviews.length)}
            </span>
          </div>
        )}
      </div>

      <div className="reviews__body">
        {!user ? (
          <p className="t-sm t-faint">
            <Link to="/login" className="link">{t('auth.signIn')}</Link>
            {t('product.reviews.signInPrompt')}
          </p>
        ) : !hasPurchased ? (
          <p className="t-sm t-faint">{t('product.reviews.mustPurchase')}</p>
        ) : (
          <form
            className="stack gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(
                { userId: user.id, rating, body },
                {
                  onSuccess: () => {
                    setSubmitted(true);
                    setBody('');
                    setRating(5);
                  },
                }
              );
            }}
          >
            <div className="row gap-4">
              <span className="t-sm">{submitted ? t('product.reviews.updated') : t('product.reviews.yourRating')}</span>
              <Stars value={rating} onChange={setRating} readOnly={false} />
            </div>
            <textarea
              className="textarea"
              placeholder={t('product.reviews.placeholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            {submitError && <p className="field__error">{(submitError as Error).message}</p>}
            <button type="submit" className="btn btn--secondary btn--sm" disabled={isPending} style={{ alignSelf: 'flex-start' }}>
              {isPending ? t('product.reviews.submitting') : t('product.reviews.publish')}
            </button>
          </form>
        )}

        {isLoading ? (
          <div className="stack gap-4">
            <div className="sk sk--text" style={{ width: '40%' }} />
            <div className="sk sk--text" style={{ width: '80%' }} />
          </div>
        ) : reviews.length === 0 ? (
          <p className="t-sm t-faint">{t('product.reviews.empty')}</p>
        ) : (
          reviews.map((review) => {
            const author = review.author_name || t('product.reviews.anonymous');
            return (
              <article key={review.id} className="review">
                <div className="review__meta">
                  <span className="review__author">{author}</span>
                  <span className="review__date">{formatDate(new Date(review.created_at))}</span>
                  <span className="status status--positive">{t('product.reviews.verified')}</span>
                </div>
                <Stars value={review.rating} />
                {review.body && <p className="review__body">{review.body}</p>}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
