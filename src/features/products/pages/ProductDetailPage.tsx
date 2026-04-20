import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '../../../hooks/useProducts';
import { useReviews, useSubmitReview } from '../../../hooks/useReviews';
import { useCartStore } from '../../../store/cartStore';
import { useAuth } from '../../../hooks/useAuth';
import { Spinner } from '../../../components/ui/Spinner';
import type { ProductImage, ProductVariant } from '../../../types';

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = readonly ? value : (hovered || value);
  return (
    <div
      className="star-rating"
      aria-label={`${value} out of 5 stars`}
      style={{ display: 'flex', gap: 2, cursor: readonly ? 'default' : 'pointer' }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={n <= display ? '#F5A623' : 'none'}
          stroke={n <= display ? '#F5A623' : 'var(--gray-300)'}
          strokeWidth="1.5"
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          onClick={() => !readonly && onChange?.(n)}
          style={{ flexShrink: 0 }}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useReviews(productId);
  const { mutate: submit, isPending, error: submitError } = useSubmitReview(productId);

  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
  };

  return (
    <section className="reviews-section" aria-label="Customer reviews">
      <div className="reviews-header">
        <div>
          <h2 className="heading-2" style={{ marginBottom: 4 }}>
            Customer reviews
          </h2>
          {reviews.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StarRating value={Math.round(avgRating)} readonly />
              <span style={{ fontSize: 14, color: 'var(--color-text-2)' }}>
                {avgRating} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="review-form">
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            {submitted ? 'Review updated — thank you!' : 'Write a review'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>Your rating:</span>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <textarea
            className="review-textarea"
            placeholder="Share your thoughts about this product…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          {submitError && (
            <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 6 }}>
              {(submitError as Error).message}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
            disabled={isPending}
          >
            {isPending ? 'Submitting…' : 'Publish review'}
          </button>
        </form>
      ) : (
        <div className="review-login-prompt">
          <Link to="/login" className="link-btn">Sign in</Link>
          <span style={{ color: 'var(--color-text-3)', fontSize: 14 }}> to leave a review.</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ paddingTop: 24, display: 'flex', justifyContent: 'center' }}>
          <Spinner size="md" />
        </div>
      ) : reviews.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-text-3)', paddingTop: 16 }}>
          No reviews yet — be the first!
        </p>
      ) : (
        <div className="reviews-list">
          {reviews.map((r) => {
            const author = r.profiles?.full_name || r.profiles?.email || 'Anonymous';
            return (
              <div key={r.id} className="review-card">
                <div className="review-card__head">
                  <div className="review-card__author">
                    <div className="review-card__avatar">
                      {author.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="review-card__name">{author}</p>
                      <p className="review-card__date">
                        {new Date(r.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <StarRating value={r.rating} readonly />
                </div>
                {r.body && <p className="review-card__body">{r.body}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, error } = useProduct(slug ?? '');
  const addItem = useCartStore((s) => s.addItem);

  const [activeImage, setActiveImage] = useState<ProductImage | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);

  if (isLoading) {
    return <div className="page-loading"><Spinner size="lg" /></div>;
  }

  if (error || !product) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-32) var(--sp-8)', textAlign: 'center' }}>
        <p style={{ fontSize: 44, lineHeight: 1 }}>🔍</p>
        <h1 className="heading-1">Product not found</h1>
        <p className="body" style={{ maxWidth: 360 }}>
          This product may have been removed or the link is incorrect.
        </p>
        <Link to="/products" className="btn btn-primary btn-lg" style={{ marginTop: 'var(--sp-2)' }}>
          Back to products
        </Link>
      </div>
    );
  }

  const isClothing = product.categories?.slug === 'clothing';
  const variants: ProductVariant[] = product.product_variants
    ? [...product.product_variants].sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const hasVariants = variants.length > 0;

  const allImages = product.product_images ?? [];
  const primaryImage = allImages.find((i) => i.is_primary) ?? allImages[0];
  const displayImage = activeImage ?? primaryImage;
  const thumbImages = allImages.filter((i) => i.id !== displayImage?.id);

  const isOutOfStock = product.stock_quantity === 0;
  const isLowStock = !isOutOfStock && product.stock_quantity <= product.low_stock_threshold;

  const handleAddToCart = () => {
    if (isClothing && hasVariants && !selectedSize) {
      setSizeError(true);
      return;
    }
    addItem(product, quantity, selectedSize);
    setAddedFeedback(true);
    setSizeError(false);
    setTimeout(() => setAddedFeedback(false), 2500);
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setSizeError(false);
  };

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-20)' }}>
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to="/products">Products</Link>
        {product.categories && (
          <>
            <span className="breadcrumb-sep">›</span>
            <Link to={`/products?category=${product.categories.slug}`}>
              {product.categories.name}
            </Link>
          </>
        )}
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--color-text-2)' }}>{product.name}</span>
      </nav>

      <div className="product-detail">
        {/* ── Gallery ── */}
        <div className="gallery">
          <div className="gallery__main">
            <img
              src={displayImage?.url ?? 'https://placehold.co/800x800/f5f5f7/aeaeb2?text=No+image'}
              alt={displayImage?.alt_text ?? product.name}
            />
          </div>
          {allImages.length > 1 && (
            <div className="gallery__thumbs">
              {[primaryImage, ...thumbImages].filter(Boolean).map((img) => (
                <button
                  key={img!.id}
                  className={`gallery__thumb${displayImage?.id === img!.id ? ' gallery__thumb--active' : ''}`}
                  onClick={() => setActiveImage(img!)}
                  aria-label={img!.alt_text ?? 'Product image'}
                >
                  <img src={img!.url} alt={img!.alt_text ?? ''} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="product-info">
          <div className="product-info__eyebrow">
            {product.categories && (
              <Link
                to={`/products?category=${product.categories.slug}`}
                className="product-info__category"
              >
                {product.categories.name}
              </Link>
            )}
            {product.sku && (
              <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
                SKU {product.sku}
              </span>
            )}
          </div>

          <h1 className="product-info__name">{product.name}</h1>

          <div className="product-info__pricing">
            <span className="product-info__price">${product.price.toFixed(2)}</span>
          </div>

          {product.description && (
            <p className="product-info__description">{product.description}</p>
          )}

          <div className="product-info__divider" />

          {/* Size selector for clothing */}
          {isClothing && hasVariants && (
            <div className="size-selector">
              <div className="size-selector__label">
                Size
                {selectedSize && <span className="size-selector__chosen"> — {selectedSize}</span>}
              </div>
              <div className="size-selector__grid">
                {variants.map((v) => {
                  const outOfSize = v.stock_qty === 0;
                  return (
                    <button
                      key={v.id}
                      className={`size-btn${selectedSize === v.size ? ' size-btn--active' : ''}${outOfSize ? ' size-btn--out' : ''}`}
                      onClick={() => !outOfSize && handleSizeSelect(v.size)}
                      disabled={outOfSize}
                      aria-pressed={selectedSize === v.size}
                      title={outOfSize ? 'Out of stock' : v.size}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
              {sizeError && (
                <p className="size-error">Please select a size before adding to cart.</p>
              )}
            </div>
          )}

          {/* Stock indicator */}
          {isOutOfStock ? (
            <span className="stock-status stock-status--out">Out of stock</span>
          ) : isLowStock ? (
            <span className="stock-status stock-status--low">
              Only {product.stock_quantity} left in stock
            </span>
          ) : (
            <span className="stock-status stock-status--in">In stock</span>
          )}

          {/* Actions */}
          {!isOutOfStock && (
            <div className="product-info__actions">
              <div className="qty-control" aria-label="Quantity">
                <button
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >−</button>
                <span className="qty-value" aria-live="polite">{quantity}</span>
                <button
                  className="qty-btn"
                  onClick={() => setQuantity((q) => Math.min(q + 1, product.stock_quantity))}
                  disabled={quantity >= product.stock_quantity}
                  aria-label="Increase quantity"
                >+</button>
              </div>

              <button
                onClick={handleAddToCart}
                className={`btn btn-lg${addedFeedback ? ' btn-secondary' : ' btn-primary'}`}
                style={{ flex: 1 }}
              >
                {addedFeedback ? '✓ Added to cart' : 'Add to cart'}
              </button>
            </div>
          )}

          {isOutOfStock && (
            <button disabled className="btn btn-secondary btn-lg btn-full">
              Out of stock
            </button>
          )}

          {product.weight_grams && (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginTop: 'var(--sp-2)' }}>
              Weight: {product.weight_grams}g
            </p>
          )}
        </div>
      </div>

      {/* ── Reviews ── */}
      <div className="product-info__divider" style={{ margin: 'var(--sp-16) 0 var(--sp-10)' }} />
      <ReviewsSection productId={product.id} />
    </div>
  );
}
