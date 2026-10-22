import { useState } from 'react';
import { useI18n } from '../../../lib/i18n';
import {
  MAX_SIZE_NAME_LENGTH,
  MAX_SIZE_SKU_LENGTH,
  SIZE_LABELS,
  SIZE_PRESETS,
  appendSizes,
  draftStock,
  draftsTotal,
  fillEmptySkus,
  moveDraft,
  parseStock,
  setAllStock,
  sizeLabelKey,
  suggestSku,
  validateDrafts,
  type SizeDraft,
  type SizePreset,
} from '../../../lib/sizes';
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '../../../components/ui/icons';
import type { SizeLabel } from '../../../types';

interface Props {
  drafts: SizeDraft[];
  onChange: (drafts: SizeDraft[]) => void;
  label: SizeLabel;
  onLabelChange: (label: SizeLabel) => void;
  /** The product SKU, the base for suggested size SKUs. */
  productSku: string;
  lowStockThreshold: number;
  /** Mark each row's problem — switched on by the first save attempt. */
  showErrors: boolean;
  disabled?: boolean;
}

/**
 * The size list of a sized product: one row per size with its own SKU, stock
 * and on-sale switch. Rows are ordered as the storefront shows them. The
 * product total is not edited here — the database derives it from the sizes
 * on sale, and the summary below previews that figure.
 *
 * The helper inputs (new size, set-all) are plain text inputs on purpose: they
 * sit inside the product <form>, and a number input with min/step constraints
 * would block the whole form's submit over a value that is never saved.
 */
export function SizeEditor({
  drafts,
  onChange,
  label,
  onLabelChange,
  productSku,
  lowStockThreshold,
  showErrors,
  disabled,
}: Props) {
  const { t, tCount } = useI18n();
  const [newSizes, setNewSizes] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  const issues = validateDrafts(drafts);
  const total = draftsTotal(drafts);
  const hasBackorder = drafts.some((d) => (draftStock(d)?.value ?? 0) < 0);
  const canFillSkus = productSku.trim() !== '' && drafts.some((d) => !d.sku.trim());

  const update = (key: string, patch: Partial<SizeDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const applyPreset = (preset: SizePreset) => {
    // A preset that starts the list also says what the sizes are.
    if (drafts.length === 0) onLabelChange(preset.label);
    onChange(appendSizes(drafts, preset.sizes));
  };

  // "S, M, L" adds three sizes at once.
  const addSizes = () => {
    onChange(appendSizes(drafts, newSizes.split(',')));
    setNewSizes('');
  };

  const bulkValue = parseStock(bulkStock);
  const applyBulk = () => {
    if (bulkValue === null) return;
    onChange(setAllStock(drafts, bulkValue));
    setBulkStock('');
  };

  // Enter inside the product form would submit it; in these two inputs it
  // means "do this input's action" instead.
  const onEnter = (action: () => void) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="size-editor">
      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="size-label">{t('admin.catalog.sizes.labelField')}</label>
          <select
            id="size-label"
            className="select"
            value={label}
            onChange={(event) => onLabelChange(event.target.value as SizeLabel)}
            disabled={disabled}
          >
            {SIZE_LABELS.map((value) => (
              <option key={value} value={value}>{t(sizeLabelKey(value))}</option>
            ))}
          </select>
          <p className="field__hint">{t('admin.catalog.sizes.labelHint')}</p>
        </div>
      </div>

      <div className="field">
        <span className="field__label">{t('admin.catalog.sizes.presets')}</span>
        <div className="size-presets">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => applyPreset(preset)}
              disabled={disabled}
            >
              {t(`admin.catalog.sizes.preset.${preset.id}`)}
            </button>
          ))}
        </div>
        <p className="field__hint">{t('admin.catalog.sizes.presetHint')}</p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="size-new">{t('admin.catalog.sizes.addLabel')}</label>
        <div className="row gap-2">
          <input
            id="size-new"
            className="input input--sm"
            value={newSizes}
            placeholder={t('admin.catalog.sizes.addPlaceholder')}
            maxLength={200}
            onChange={(event) => setNewSizes(event.target.value)}
            onKeyDown={onEnter(addSizes)}
            disabled={disabled}
          />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={addSizes}
            disabled={disabled || !newSizes.trim()}
          >
            <IconPlus size={14} />
            {t('admin.catalog.sizes.add')}
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="t-sm t-faint">{t('admin.catalog.sizes.empty')}</p>
      ) : (
        <>
          <div className="size-table">
            <div className="size-row size-row--head" aria-hidden="true">
              <span>{t('admin.catalog.sizes.colOrder')}</span>
              <span>{t('admin.catalog.sizes.colSize')}</span>
              <span>{t('admin.catalog.sizes.colSku')}</span>
              <span>{t('admin.catalog.sizes.colStock')}</span>
              <span>{t('admin.catalog.sizes.colOnSale')}</span>
              <span />
            </div>

            {drafts.map((draft, index) => {
              const issue = showErrors ? issues.byKey[draft.key] : undefined;
              const stock = draftStock(draft);
              const name = draft.size.trim() || '—';
              const tone =
                !draft.isActive || stock === null
                  ? ''
                  : stock.value <= 0
                    ? ' is-out'
                    : stock.value <= lowStockThreshold
                      ? ' is-low'
                      : '';

              return (
                <div
                  key={draft.key}
                  className={`size-row${draft.isActive ? '' : ' is-off'}${issue ? ' has-error' : ''}`}
                >
                  <div className="size-row__order">
                    <button
                      type="button"
                      className="size-row__icon"
                      onClick={() => onChange(moveDraft(drafts, index, -1))}
                      disabled={disabled || index === 0}
                      aria-label={t('admin.catalog.sizes.moveUp', { size: name })}
                    >
                      <IconChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="size-row__icon"
                      onClick={() => onChange(moveDraft(drafts, index, 1))}
                      disabled={disabled || index === drafts.length - 1}
                      aria-label={t('admin.catalog.sizes.moveDown', { size: name })}
                    >
                      <IconChevronDown size={14} />
                    </button>
                  </div>

                  <input
                    className="input input--sm size-row__size"
                    value={draft.size}
                    maxLength={MAX_SIZE_NAME_LENGTH}
                    onChange={(event) => update(draft.key, { size: event.target.value })}
                    aria-label={t('admin.catalog.sizes.sizeAria')}
                    aria-invalid={issue === 'empty' || issue === 'tooLong' || issue === 'duplicate'}
                    disabled={disabled}
                  />

                  <input
                    className="input input--sm t-mono size-row__sku"
                    value={draft.sku}
                    placeholder={suggestSku(productSku, draft.size) ?? ''}
                    maxLength={MAX_SIZE_SKU_LENGTH}
                    onChange={(event) => update(draft.key, { sku: event.target.value })}
                    aria-label={t('admin.catalog.sizes.skuAria', { size: name })}
                    aria-invalid={issue === 'skuTooLong' || issue === 'skuDuplicate'}
                    disabled={disabled}
                  />

                  <input
                    className={`input input--sm size-row__stock${tone}`}
                    inputMode="numeric"
                    value={draft.stock}
                    onChange={(event) => update(draft.key, { stock: event.target.value })}
                    aria-label={t('admin.catalog.sizes.stockAria', { size: name })}
                    aria-invalid={issue === 'stock'}
                    disabled={disabled}
                  />

                  <label className="checkbox size-row__toggle">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(event) => update(draft.key, { isActive: event.target.checked })}
                      aria-label={t('admin.catalog.sizes.onSaleAria', { size: name })}
                      disabled={disabled}
                    />
                  </label>

                  <button
                    type="button"
                    className="size-row__icon size-row__icon--danger size-row__remove"
                    onClick={() => onChange(drafts.filter((d) => d.key !== draft.key))}
                    aria-label={t('admin.catalog.sizes.remove', { size: name })}
                    disabled={disabled}
                  >
                    <IconTrash size={14} />
                  </button>

                  {issue && (
                    <p className="field__error size-row__error">{t(`admin.catalog.sizes.errors.${issue}`)}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="size-bulk">
            <label className="t-xs t-faint" htmlFor="size-bulk">{t('admin.catalog.sizes.setAllLabel')}</label>
            <input
              id="size-bulk"
              className="input input--sm size-bulk__input"
              inputMode="numeric"
              value={bulkStock}
              onChange={(event) => setBulkStock(event.target.value)}
              onKeyDown={onEnter(applyBulk)}
              disabled={disabled}
            />
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={applyBulk}
              disabled={disabled || bulkValue === null}
            >
              {t('admin.catalog.sizes.setAllApply')}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--sm size-bulk__skus"
              onClick={() => onChange(fillEmptySkus(drafts, productSku))}
              disabled={disabled || !canFillSkus}
              title={productSku.trim() ? undefined : t('admin.catalog.sizes.fillSkusHint')}
            >
              {t('admin.catalog.sizes.fillSkus')}
            </button>
          </div>

          <div className="size-summary">
            <span className="field__label">{t('admin.catalog.sizes.total')}</span>
            <p className="size-summary__value">
              <span className="t-num">{total}</span>
              <span className="t-xs t-faint">
                {tCount('admin.catalog.sizes.count', drafts.length)} · {tCount('admin.catalog.sizes.units', total)}
              </span>
            </p>
            <p className="field__hint">
              {t('admin.catalog.sizes.totalHint')}
              {hasBackorder && <> {t('admin.catalog.sizes.backorderHint')}</>}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
