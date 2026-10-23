import { useState } from 'react';
import { useSetVariantStock } from '../../../hooks/useAdminProducts';
import { StockConflictError, type VariantStockChange } from '../../../lib/api';
import { parseStock } from '../../../lib/sizes';
import { sellableColors, sellableVariants, variantLabel } from '../../../lib/variants';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import type { Product, ProductVariant } from '../../../types';

interface Props {
  product: Product;
  onClose: () => void;
}

/**
 * Quick restock of a product with variants from the catalog list: one stock
 * field per variant on sale (grouped by colour), and an optional note for the
 * inventory log — a delivery note number, a recount. Renaming, reordering and
 * switching variants on or off belong to the product editor.
 *
 * Each changed figure is sent with the one it replaces (the `product` row the
 * list last loaded). If an order moved it in between, nothing is written; the
 * list refetches and the next save is checked against the fresh figure.
 */
export function VariantStockPanel({ product, onClose }: Props) {
  const { t } = useI18n();
  const setVariantStock = useSetVariantStock();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const variants = sellableVariants(product);
  const groups: { key: string; title: string | null; swatch: string | null; variants: ProductVariant[] }[] = product.has_colors
    ? sellableColors(product).map((color) => ({
        key: color.id,
        title: color.name,
        swatch: color.swatch,
        variants: variants.filter((v) => v.color_id === color.id),
      }))
    : [{ key: 'all', title: null, swatch: null, variants }];

  const edited = (id: string, current: number) => {
    const raw = drafts[id];
    return raw != null && raw.trim() !== String(current);
  };
  const invalid = variants.some((v) => edited(v.id, v.stock_qty) && parseStock(drafts[v.id]) === null);
  const changes: VariantStockChange[] = variants.flatMap((v) => {
    if (!edited(v.id, v.stock_qty)) return [];
    const value = parseStock(drafts[v.id]);
    return value === null ? [] : [{ id: v.id, stock_qty: value, expected_stock_qty: v.stock_qty }];
  });

  const save = () => {
    if (changes.length === 0 || invalid) return;
    setVariantStock.mutate(
      { changes, note },
      {
        onSuccess: () => {
          setDrafts({});
          setNote('');
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
      }
    );
  };

  if (variants.length === 0) {
    return <p className="t-xs t-faint">{t('admin.catalog.variants.noneOnSale')}</p>;
  }

  return (
    <div className="size-quick">
      {groups.map((group) => (
        <div key={group.key} className="size-quick__group">
          {group.title && (
            <p className="size-quick__title">
              {group.swatch && <span className="swatch swatch--sm" style={{ background: group.swatch }} aria-hidden="true" />}
              {group.title}
            </p>
          )}
          <div className="size-quick__fields">
            {group.variants.map((variant) => {
              const value = drafts[variant.id] ?? String(variant.stock_qty);
              const bad = edited(variant.id, variant.stock_qty) && parseStock(value) === null;
              const tone =
                variant.stock_qty <= 0 ? ' is-out' : variant.stock_qty <= product.low_stock_threshold ? ' is-low' : '';
              const inputId = `quick-stock-${variant.id}`;
              const label = variant.size ?? variantLabel(product, variant);
              return (
                <div key={variant.id} className="size-quick__field">
                  <label className="size-quick__label" htmlFor={inputId}>{label}</label>
                  <input
                    id={inputId}
                    className={`input input--sm size-row__stock${tone}`}
                    inputMode="numeric"
                    value={value}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [variant.id]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') save();
                    }}
                    aria-label={t('admin.catalog.sizes.stockAria', { size: variantLabel(product, variant) })}
                    aria-invalid={bad}
                    disabled={setVariantStock.isPending}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="row gap-2 row--wrap">
        <input
          className="input input--sm"
          style={{ maxWidth: 280 }}
          value={note}
          maxLength={500}
          placeholder={t('admin.catalog.variants.notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          aria-label={t('admin.catalog.variants.noteAria')}
          disabled={setVariantStock.isPending}
        />
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
