import { useState } from 'react';
import { useSetVariantStock } from '../../../hooks/useAdminProducts';
import { StockConflictError, type VariantStockChange } from '../../../lib/api';
import { parseStock, sellableSizes } from '../../../lib/sizes';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import type { Product } from '../../../types';

interface Props {
  product: Product;
  onClose: () => void;
}

/**
 * Quick restock of a sized product from the catalog list: one stock field per
 * size on sale, nothing else. Renaming, reordering and switching sizes on or
 * off belong to the product editor.
 *
 * Each changed figure is sent with the one it replaces (the `product` row the
 * list last loaded). If an order moved it in between, nothing is written; the
 * list refetches and the next save is checked against the fresh figure.
 */
export function SizeStockPanel({ product, onClose }: Props) {
  const { t } = useI18n();
  const setVariantStock = useSetVariantStock();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const sizes = sellableSizes(product);

  const edited = (id: string, current: number) => {
    const raw = drafts[id];
    return raw != null && raw.trim() !== String(current);
  };
  const invalid = sizes.some((v) => edited(v.id, v.stock_qty) && parseStock(drafts[v.id]) === null);
  const changes: VariantStockChange[] = sizes.flatMap((v) => {
    if (!edited(v.id, v.stock_qty)) return [];
    const value = parseStock(drafts[v.id]);
    return value === null ? [] : [{ id: v.id, stock_qty: value, expected_stock_qty: v.stock_qty }];
  });

  const save = () => {
    if (changes.length === 0 || invalid) return;
    setVariantStock.mutate(changes, {
      onSuccess: () => {
        setDrafts({});
        toast(t('admin.catalog.sizes.stockSaved', { name: product.name }));
      },
      onError: (err) =>
        toast(
          err instanceof StockConflictError
            ? t('admin.catalog.stockConflict', { name: product.name })
            : err instanceof Error
              ? err.message
              : t('common.error'),
          'critical'
        ),
    });
  };

  if (sizes.length === 0) {
    return <p className="t-xs t-faint">{t('admin.catalog.sizes.noneOnSale')}</p>;
  }

  return (
    <div className="size-quick">
      <div className="size-quick__fields">
        {sizes.map((variant) => {
          const value = drafts[variant.id] ?? String(variant.stock_qty);
          const bad = edited(variant.id, variant.stock_qty) && parseStock(value) === null;
          const tone =
            variant.stock_qty <= 0 ? ' is-out' : variant.stock_qty <= product.low_stock_threshold ? ' is-low' : '';
          const inputId = `quick-stock-${variant.id}`;
          return (
            <div key={variant.id} className="size-quick__field">
              <label className="size-quick__label" htmlFor={inputId}>{variant.size}</label>
              <input
                id={inputId}
                className={`input input--sm size-row__stock${tone}`}
                inputMode="numeric"
                value={value}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [variant.id]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') save();
                }}
                aria-label={t('admin.catalog.sizes.stockAria', { size: variant.size })}
                aria-invalid={bad}
                disabled={setVariantStock.isPending}
              />
            </div>
          );
        })}
      </div>

      <div className="row gap-2">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={changes.length === 0 || invalid || setVariantStock.isPending}
        >
          {t('admin.catalog.sizes.saveStock')}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
          {t('admin.catalog.sizes.closeStock')}
        </button>
      </div>

      {invalid && <p className="field__error">{t('admin.catalog.sizes.errors.stock')}</p>}
    </div>
  );
}
