import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useUiStore } from '../../store/uiStore';
import { useI18n } from '../../lib/i18n';
import { Media } from '../ui/Media';
import { IconArrowRight, IconSearch } from '../ui/icons';

type Row =
  | { kind: 'product'; id: string; title: string; meta: string; price: number; image?: string | null; to: string }
  | { kind: 'category'; id: string; title: string; meta: string; to: string }
  | { kind: 'page'; id: string; title: string; meta: string; to: string };

const DEBOUNCE_MS = 180;

/**
 * Command-style search. Opens on ⌘K / Ctrl K or the header action, searches
 * the live catalogue, and groups results so the overlay reads as an
 * application tool rather than a styled input.
 */
export function SearchOverlay() {
  const { t, formatCurrency } = useI18n();
  const navigate = useNavigate();
  const close = useUiStore((s) => s.close);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);

  const { data, isLoading } = useProducts(
    debounced.length >= 2 ? { search: debounced, pageSize: 6, page: 1 } : { pageSize: 4, page: 1, featured: true }
  );
  const { data: categories = [] } = useCategories();

  const rows = useMemo<Row[]>(() => {
    const products = (data?.data ?? []).map<Row>((p) => ({
      kind: 'product',
      id: p.id,
      title: p.name,
      meta: p.categories?.name ?? '',
      price: p.price,
      image: p.product_images?.find((i) => i.is_primary)?.url ?? p.product_images?.[0]?.url ?? null,
      to: `/products/${p.slug}`,
    }));

    const term = debounced.toLowerCase();
    const cats = (term
      ? categories.filter((c) => c.name.toLowerCase().includes(term))
      : categories.slice(0, 3)
    )
      .slice(0, 4)
      .map<Row>((c) => ({
        kind: 'category',
        id: c.id,
        title: c.name,
        meta: t('search.categoryMeta'),
        to: `/products?category=${c.slug}`,
      }));

    const pages: Row[] = term
      ? []
      : [
          { kind: 'page', id: 'all', title: t('nav.shop'), meta: t('search.pageMeta'), to: '/products' },
          { kind: 'page', id: 'orders', title: t('sidebar.myOrders'), meta: t('search.pageMeta'), to: '/orders' },
          { kind: 'page', id: 'help', title: t('nav.about'), meta: t('search.pageMeta'), to: '/help' },
        ];

    return [...products, ...cats, ...pages];
  }, [data, categories, debounced, t]);

  // A new query resets the highlighted row during render, so the first result
  // is never briefly highlighted from the previous search.
  const [seenQuery, setSeenQuery] = useState(debounced);
  if (debounced !== seenQuery) {
    setSeenQuery(debounced);
    if (cursor !== 0) setCursor(0);
  }

  const go = (row: Row) => {
    navigate(row.to);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[cursor];
      if (row) go(row);
      else if (debounced) {
        navigate(`/products?search=${encodeURIComponent(debounced)}`);
        close();
      }
    } else if (event.key === 'Escape') {
      close();
    }
  };

  const productRows = rows.filter((r) => r.kind === 'product');
  const otherRows = rows.filter((r) => r.kind !== 'product');

  const renderRow = (row: Row) => {
    const index = rows.indexOf(row);
    return (
      <button
        key={`${row.kind}-${row.id}`}
        type="button"
        className={`search-item${index === cursor ? ' is-active' : ''}`}
        onMouseEnter={() => setCursor(index)}
        onClick={() => go(row)}
      >
        {row.kind === 'product' ? (
          <Media src={row.image} alt="" ratio="square" className="thumb" style={{ width: 40, height: 40 }} />
        ) : (
          <span className="search-item__glyph" aria-hidden="true">
            <IconArrowRight size={14} />
          </span>
        )}
        <span style={{ minWidth: 0 }}>
          <span className="search-item__title" style={{ display: 'block' }}>{row.title}</span>
          {row.meta && <span className="search-item__meta">{row.meta}</span>}
        </span>
        {row.kind === 'product' && (
          <span className="search-item__price">{formatCurrency(row.price)}</span>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="overlay" onClick={close} aria-hidden="true" />
      <div className="search-panel" role="dialog" aria-modal="true" aria-label={t('nav.searchProducts')}>
        <div className="search-panel__field">
          <IconSearch size={18} className="t-faint" />
          <input
            ref={inputRef}
            type="text"
            className="search-panel__input"
            placeholder={t('nav.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={t('nav.searchProducts')}
            autoComplete="off"
          />
          {isLoading && <span className="spinner" aria-hidden="true" />}
        </div>

        <div className="search-panel__results">
          {productRows.length > 0 && (
            <>
              <p className="t-label search-group__label">{t('search.products')}</p>
              {productRows.map(renderRow)}
            </>
          )}

          {otherRows.length > 0 && (
            <>
              <p className="t-label search-group__label">{t('search.navigate')}</p>
              {otherRows.map(renderRow)}
            </>
          )}

          {!isLoading && rows.length === 0 && (
            <p className="t-sm t-faint" style={{ padding: 'var(--s-6) var(--s-5)' }}>
              {t('search.noResults', { query: debounced })}
            </p>
          )}
        </div>

        <div className="search-panel__foot">
          <span>{t('search.hintNavigate')}</span>
          <span>{t('search.hintSelect')}</span>
          <span style={{ marginLeft: 'auto' }}>{t('search.hintClose')}</span>
        </div>
      </div>
    </>
  );
}
