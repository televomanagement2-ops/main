import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useProduct, useProducts } from '../../../hooks/useProducts';
import { useReviews, useSubmitReview, useHasPurchased } from '../../../hooks/useReviews';
import { useCategories } from '../../../hooks/useCategories';
import { useBackInStockEnabled, useRequestStockNotification, useSizeGuide } from '../../../hooks/useSizeGuides';
import { AppError, REVIEW_BODY_MAX_LENGTH } from '../../../lib/api';
import { useCartStore } from '../../../store/cartStore';
import { useUiStore } from '../../../store/uiStore';
import { usePreferencesStore } from '../../../store/preferencesStore';
import { useAuth } from '../../../hooks/useAuth';
import { ProductDetailSkeleton } from '../../../components/ui/Skeletons';
import { Media } from '../../../components/ui/Media';
import { Reveal } from '../../../components/ui/Reveal';
import { Drawer } from '../../../components/ui/Drawer';
import { SizeGuideTable } from '../../../components/ui/SizeGuideTable';
import { StockStatus } from '../../../components/ui/StatusIndicator';
import { ProductCard } from '../components/ProductCard';
import {
  IconBell,
  IconCheck,
  IconLock,
  IconMinus,
  IconPlus,
  IconReturn,
  IconRuler,
  IconStar,
  IconTruck,
} from '../../../components/ui/icons';
import { useI18n } from '../../../lib/i18n';
import { availableStock } from '../../../lib/stock';
import { sizeLabelKey } from '../../../lib/sizes';
import {
  colorLabelKey,
  findVariant,
  hasVariants,
  imagesForColor,
  priceRange,
  sellableColors,
  variantPrice,
  variantsForColor,
} from '../../../lib/variants';
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

  // Keyed so switching products resets gallery, choice and quantity state.
  return <ProductView key={product.id} product={product} />;
}

/** The first colour with something in stock, else the first colour. */
function initialColor(product: Product, requested: string | null): string | null {
  const colors = sellableColors(product);
  if (colors.length === 0) return null;
  if (requested && colors.some((c) => c.id === requested)) return requested;
  return (
    colors.find((c) => variantsForColor(product, c.id).some((v) => v.stock_qty > 0))?.id
    ?? colors[0].id
  );
}

/** With one size on offer (in stock) there is nothing to choose. */
function initialSize(product: Product, colorId: string | null): string | null {
  if (!product.has_sizes) return null;
  const sizes = variantsForColor(product, colorId);
  return sizes.length === 1 && sizes[0].stock_qty > 0 ? sizes[0].size : null;
}

function ProductView({ product }: { product: Product }) {
  const { t, formatCurrency } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUiStore((s) => s.open);
  const { data: categories = [] } = useCategories();

  const varied = hasVariants(product);
  const colors = useMemo(() => sellableColors(product), [product]);
  const sizeLabel = t(sizeLabelKey(product.size_label));
  const colorLabel = t(colorLabelKey(product.color_label));

  const [colorId, setColorId] = useState<string | null>(() => initialColor(product, searchParams.get('color')));
  const [size, setSize] = useState<string | null>(() => initialSize(product, colorId));
  const [activeImage, setActiveImage] = useState<ProductImage | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [choiceError, setChoiceError] = useState<'color' | 'size' | null>(null);
  const [added, setAdded] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // The sizes offered in the chosen colour (every size without colours).
  const sizes = useMemo(() => (product.has_sizes ? variantsForColor(product, colorId) : []), [product, colorId]);
  const variant: ProductVariant | null = varied ? findVariant(product, colorId, size) : null;

  const images = useMemo(() => imagesForColor(product, colorId), [product, colorId]);
  const displayed = activeImage && images.some((i) => i.id === activeImage.id) ? activeImage : images[0];
  const support = images.filter((i) => i.id !== displayed?.id).slice(0, 2);

  const range = priceRange(product);
  const shownPrice = variant ? variantPrice(product, variant) : range.min;
  const compareAt = product.compare_at_price != null && product.compare_at_price > shownPrice ? product.compare_at_price : null;

  // Oversold products report negative stock (migration 013), so `<= 0`.
  const isOut = product.stock_quantity <= 0;
  // The stepper's ceiling is the chosen VARIANT's stock, not the product total.
  const maxQuantity = varied ? (variant ? availableStock(product, variant.id) : 0) : availableStock(product);
  const chosenSoldOut = varied ? Boolean(variant && variant.stock_qty <= 0) : isOut;

  // Size guide: the product's own, else its category's, else the parent's.
  const category = product.categories ?? null;
  const parent = category?.parent_id ? categories.find((c) => c.id === category.parent_id) : undefined;
  const guideId =
    product.size_guide_id
    ?? (product.has_sizes ? category?.size_guide_id ?? parent?.size_guide_id ?? null : null);

  const { data: relatedPage } = useProducts({
    categorySlug: product.categories?.slug,
    pageSize: 5,
    page: 1,
  });
  const related = (relatedPage?.data ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  const chooseColor = (id: string) => {
    setColorId(id);
    setActiveImage(null);
    setChoiceError(null);
    // Keep the size when the new colour has it; otherwise choose again.
    const nextSizes = variantsForColor(product, id);
    const keep = size && nextSizes.some((v) => v.size === size) ? size : initialSize(product, id);
    setSize(keep);
    const next = findVariant(product, id, keep);
    setQuantity((q) => Math.max(1, Math.min(q, next ? availableStock(product, next.id) : q)));
    const params = new URLSearchParams(searchParams);
    params.set('color', id);
    setSearchParams(params, { replace: true });
  };

  const chooseSize = (value: string) => {
    setSize(value);
    setChoiceError(null);
    // The new size may hold less than the quantity already dialled in.
    const next = findVariant(product, colorId, value);
    setQuantity((q) => Math.max(1, Math.min(q, next ? availableStock(product, next.id) : q)));
  };

  const requireChoice = () => {
    if (product.has_colors && !colorId) {
      setChoiceError('color');
      return false;
    }
    if (product.has_sizes && !size) {
      setChoiceError('size');
      return false;
    }
    return true;
  };

  const handleAdd = () => {
    if (!requireChoice()) return;
    addItem(product, quantity, variant?.id ?? null);
    setChoiceError(null);
    setAdded(true);
    openCart('cart');
    window.setTimeout(() => setAdded(false), 2200);
  };

  const handleBuyNow = () => {
    if (!requireChoice()) return;
    addItem(product, quantity, variant?.id ?? null);
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
          <p className="pdp__price">
            {!variant && range.min !== range.max ? t('product.priceFrom', { price: formatCurrency(range.min) }) : formatCurrency(shownPrice)}
            {compareAt != null && (
              <>
                <span className="price-was">{formatCurrency(compareAt)}</span>
                <span className="price-off">−{Math.round(((compareAt - shownPrice) / compareAt) * 100)}%</span>
              </>
            )}
          </p>

          {product.description && <p className="pdp__desc">{product.description}</p>}

          <div className="pdp__rule" />

          {colors.length > 0 && (
            <div className="field">
              <span className="field__label">
                {colorLabel}
                {colorId && <span style={{ color: 'var(--ink)' }}> — {colors.find((c) => c.id === colorId)?.name}</span>}
              </span>
              <div className="swatch-grid" role="radiogroup" aria-label={colorLabel}>
                {colors.map((color) => {
                  const soldOut = !variantsForColor(product, color.id).some((v) => v.stock_qty > 0);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      role="radio"
                      aria-checked={colorId === color.id}
                      className={`swatch-btn${colorId === color.id ? ' is-active' : ''}${soldOut ? ' is-out' : ''}${color.swatch ? '' : ' swatch-btn--text'}`}
                      onClick={() => chooseColor(color.id)}
                      title={soldOut ? `${color.name} — ${t('product.stockOut')}` : color.name}
                    >
                      {color.swatch ? (
                        <>
                          <span className="swatch" style={{ background: color.swatch }} aria-hidden="true" />
                          <span className="sr-only">{color.name}</span>
                        </>
                      ) : (
                        color.name
                      )}
                    </button>
                  );
                })}
              </div>
              {choiceError === 'color' && <p className="field__error">{t('product.colorError', { label: colorLabel.toLowerCase() })}</p>}
            </div>
          )}

          {product.has_sizes && sizes.length > 0 && (
            <div className="field">
              <span className="field__label pdp__size-label">
                <span>
                  {sizeLabel}
                  {size && <span style={{ color: 'var(--ink)' }}> — {size}</span>}
                </span>
                {guideId && (
                  <button type="button" className="link pdp__guide-link" onClick={() => setGuideOpen(true)}>
                    <IconRuler size={14} />
                    {t('product.sizeGuide')}
                  </button>
                )}
              </span>
              <div className="size-grid">
                {sizes.map((v) => {
                  const soldOut = v.stock_qty <= 0;
                  const lowStock = !soldOut && v.stock_qty <= product.low_stock_threshold;
                  const vPrice = variantPrice(product, v);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`size-btn${size === v.size ? ' is-active' : ''}${soldOut ? ' is-out' : ''}`}
                      onClick={() => chooseSize(v.size as string)}
                      aria-pressed={size === v.size}
                      title={
                        soldOut
                          ? t('product.stockOut')
                          : lowStock
                            ? t('product.stockLow', { count: v.stock_qty })
                            : v.size ?? ''
                      }
                    >
                      {v.size}
                      {range.min !== range.max && vPrice !== range.min && (
                        <span className="size-btn__price">{formatCurrency(vPrice)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {choiceError === 'size' && <p className="field__error">{t('product.sizeError')}</p>}
            </div>
          )}

          {!product.has_sizes && guideId && (
            <button type="button" className="link pdp__guide-link" style={{ alignSelf: 'flex-start' }} onClick={() => setGuideOpen(true)}>
              <IconRuler size={14} />
              {t('product.sizeGuide')}
            </button>
          )}

          {/* Once a variant is chosen, availability is that variant's, not the
              product's total across all of them. */}
          <StockStatus
            quantity={variant ? variant.stock_qty : product.stock_quantity}
            threshold={product.low_stock_threshold}
          />

          {isOut || chosenSoldOut ? (
            <>
              <button type="button" className="btn btn--secondary btn--lg btn--block" disabled>
                {t('product.stockOut')}
              </button>
              <NotifyMe product={product} variant={varied ? variant : null} />
            </>
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
                    onClick={() => setQuantity((q) => Math.min(q + 1, Math.max(1, maxQuantity)))}
                    disabled={varied ? !variant || quantity >= maxQuantity : quantity >= maxQuantity}
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
            {(variant?.sku || product.sku) && (
              <div className="pdp__meta-row">
                <dt>{t('product.meta.sku')}</dt>
                <dd className="t-mono">{variant?.sku || product.sku}</dd>
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

      {guideId && <SizeGuideDrawer guideId={guideId} open={guideOpen} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

/** The size guide, fetched the first time the shopper opens it. */
function SizeGuideDrawer({ guideId, open, onClose }: { guideId: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { data: guide, isLoading } = useSizeGuide(guideId, open);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      eyebrow={t('product.sizeGuide')}
      title={guide?.name ?? t('product.sizeGuide')}
      closeLabel={t('common.close')}
    >
      {isLoading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : guide ? (
        <SizeGuideTable columns={guide.columns} rows={guide.rows} notes={guide.notes} />
      ) : (
        <p className="t-sm t-faint">{t('product.sizeGuideMissing')}</p>
      )}
    </Drawer>
  );
}

/**
 * "Email me when it is back" for a sold-out product — or the sold-out
 * variant the shopper picked. Signed-in shoppers have their address filled in.
 */
function NotifyMe({ product, variant }: { product: Product; variant: ProductVariant | null }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const language = usePreferencesStore((s) => s.language);
  const { data: enabled } = useBackInStockEnabled();
  const request = useRequestStockNotification();
  const [email, setEmail] = useState(user?.email ?? '');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A product with variants: only once the sold-out variant is chosen.
  if (!enabled || (hasVariants(product) && !variant)) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    request.mutate(
      { productId: product.id, variantId: variant?.id ?? null, email: email.trim(), locale: language },
      {
        onSuccess: (status) => setDone(status === 'already_subscribed' ? t('product.notify.already') : t('product.notify.done')),
        onError: (err) =>
          setError(
            err instanceof AppError ? t(`product.notify.errors.${err.code}`) : err instanceof Error ? err.message : t('common.error'),
          ),
      },
    );
  };

  if (done) {
    return (
      <p className="notify-done">
        <IconCheck size={15} />
        {done}
      </p>
    );
  }

  return (
    <form className="notify-form" onSubmit={submit}>
      <p className="t-sm">
        <IconBell size={15} /> {t('product.notify.title')}
      </p>
      <div className="row gap-2">
        <input
          type="email"
          className="input"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('product.notify.placeholder')}
          aria-label={t('product.notify.emailLabel')}
          autoComplete="email"
        />
        <button type="submit" className="btn btn--secondary" disabled={request.isPending}>
          {t('product.notify.submit')}
        </button>
      </div>
      <p className="t-xs t-faint">{t('product.notify.privacy')}</p>
      {error && <p className="field__error">{error}</p>}
    </form>
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
              maxLength={REVIEW_BODY_MAX_LENGTH}
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
