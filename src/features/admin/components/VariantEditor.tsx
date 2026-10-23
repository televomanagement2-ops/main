import { useState } from 'react';
import { useI18n } from '../../../lib/i18n';
import { MAX_SIZE_NAME_LENGTH, MAX_SIZE_SKU_LENGTH, SIZE_LABELS, SIZE_PRESETS, parseStock, sizeLabelKey } from '../../../lib/sizes';
import {
  COLOR_LABELS,
  COLOR_PRESETS,
  MAX_COLOR_NAME_LENGTH,
  addColors,
  addSizes,
  axes,
  cellKey,
  cellLabel,
  cellOf,
  cellStock,
  colorLabelKey,
  draftTotal,
  emptyCell,
  fillVariantSkus,
  includedCells,
  moveItem,
  parseAmount,
  removeColor,
  removeSize,
  setForAll,
  suggestVariantSku,
  updateCell,
  validateVariantDraft,
  type CellDraft,
  type VariantDraft,
} from '../../../lib/variants';
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '../../../components/ui/icons';
import type { ColorLabel, SizeLabel } from '../../../types';

interface Props {
  draft: VariantDraft;
  onChange: (draft: VariantDraft) => void;
  /** The product SKU, the base for suggested variant SKUs. */
  productSku: string;
  /** Shown as the price of a variant without a price of its own. */
  productPrice: string;
  lowStockThreshold: number;
  /** Mark each problem — switched on by the first save attempt. */
  showErrors: boolean;
  disabled?: boolean;
}

/**
 * Colours, sizes, and one row per combination with its own SKU, stock and
 * on-sale switch — plus, when asked for, its own price and cost. The product
 * total is not edited here: the database derives it from the variants on
 * sale, and the summary below previews that figure.
 *
 * The helper inputs are plain text inputs on purpose: they sit inside the
 * product <form>, and a number input with min/step constraints would block
 * the whole form's submit over a value that is never saved.
 */
export function VariantEditor({
  draft,
  onChange,
  productSku,
  productPrice,
  lowStockThreshold,
  showErrors,
  disabled,
}: Props) {
  const { t, tCount, formatCurrency } = useI18n();
  const [newSizes, setNewSizes] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newSwatch, setNewSwatch] = useState('#888888');
  const [bulkStock, setBulkStock] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [pricing, setPricing] = useState(() =>
    Object.values(draft.cells).some((c) => c.price.trim() !== '' || c.cost.trim() !== ''),
  );

  const issues = validateVariantDraft(draft);
  const issueOf = (key: string) => (showErrors ? issues.byKey[key] : undefined);
  const total = draftTotal(draft);
  const included = includedCells(draft);
  const hasBackorder = included.some(({ cell }) => (cellStock(cell)?.value ?? 0) < 0);
  const canFillSkus = productSku.trim() !== '' && included.some(({ cell }) => !cell.sku.trim());
  const { colorKeys, sizeKeys } = axes(draft);

  // Enter inside the product form would submit it; in these inputs it means
  // "do this input's action" instead.
  const onEnter = (action: () => void) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  };

  const addCustomColor = () => {
    onChange(addColors(draft, [{ name: newColor, swatch: newSwatch }]));
    setNewColor('');
  };
  const addSizeList = () => {
    onChange(addSizes(draft, newSizes.split(',')));
    setNewSizes('');
  };
  const bulkStockValue = parseStock(bulkStock);
  const bulkPriceValue = parseAmount(bulkPrice);

  const colorName = (key: string | null) => draft.colors.find((c) => c.key === key)?.name.trim() || '—';
  const sizeName = (key: string | null) => draft.sizes.find((s) => s.key === key)?.name.trim() || '—';

  return (
    <div className="size-editor">
      {/* ── Colours ── */}
      {draft.hasColors && (
        <div className="variant-block">
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="color-label">{t('admin.catalog.variants.colorLabelField')}</label>
              <select
                id="color-label"
                className="select"
                value={draft.colorLabel}
                onChange={(event) => onChange({ ...draft, colorLabel: event.target.value as ColorLabel })}
                disabled={disabled}
              >
                {COLOR_LABELS.map((value) => (
                  <option key={value} value={value}>{t(colorLabelKey(value))}</option>
                ))}
              </select>
              <p className="field__hint">{t('admin.catalog.variants.colorLabelHint')}</p>
            </div>
          </div>

          <div className="field">
            <span className="field__label">{t('admin.catalog.variants.colorPresets')}</span>
            <div className="size-presets">
              {COLOR_PRESETS.map((preset) => {
                const name = t(`admin.catalog.variants.colorPreset.${preset.id}`);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="btn btn--secondary btn--sm color-preset"
                    onClick={() => onChange(addColors(draft, [{ name, swatch: preset.hex }]))}
                    disabled={disabled}
                  >
                    <span className="swatch swatch--sm" style={{ background: preset.hex }} aria-hidden="true" />
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="color-new">{t('admin.catalog.variants.addColor')}</label>
            <div className="row gap-2">
              <input
                type="color"
                className="swatch-input"
                value={newSwatch}
                onChange={(event) => setNewSwatch(event.target.value)}
                aria-label={t('admin.catalog.variants.swatchAria', { name: newColor || '—' })}
                disabled={disabled}
              />
              <input
                id="color-new"
                className="input input--sm"
                value={newColor}
                placeholder={t('admin.catalog.variants.addColorPlaceholder')}
                maxLength={MAX_COLOR_NAME_LENGTH}
                onChange={(event) => setNewColor(event.target.value)}
                onKeyDown={onEnter(addCustomColor)}
                disabled={disabled}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={addCustomColor}
                disabled={disabled || !newColor.trim()}
              >
                <IconPlus size={14} />
                {t('admin.catalog.sizes.add')}
              </button>
            </div>
          </div>

          {draft.colors.length === 0 ? (
            <p className="t-sm t-faint">{t('admin.catalog.variants.noColors')}</p>
          ) : (
            <div className="size-table">
              {draft.colors.map((color, index) => {
                const issue = issueOf(color.key);
                const name = color.name.trim() || '—';
                return (
                  <div key={color.key} className={`variant-option${issue ? ' has-error' : ''}`}>
                    <div className="size-row__order">
                      <button
                        type="button"
                        className="size-row__icon"
                        onClick={() => onChange({ ...draft, colors: moveItem(draft.colors, index, -1) })}
                        disabled={disabled || index === 0}
                        aria-label={t('admin.catalog.sizes.moveUp', { size: name })}
                      >
                        <IconChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="size-row__icon"
                        onClick={() => onChange({ ...draft, colors: moveItem(draft.colors, index, 1) })}
                        disabled={disabled || index === draft.colors.length - 1}
                        aria-label={t('admin.catalog.sizes.moveDown', { size: name })}
                      >
                        <IconChevronDown size={14} />
                      </button>
                    </div>
                    <span className="swatch-field">
                      <input
                        type="color"
                        className="swatch-input"
                        value={/^#[0-9a-f]{6}$/i.test(color.swatch) ? color.swatch : '#ffffff'}
                        onChange={(event) =>
                          onChange({
                            ...draft,
                            colors: draft.colors.map((c) => (c.key === color.key ? { ...c, swatch: event.target.value } : c)),
                          })
                        }
                        aria-label={t('admin.catalog.variants.swatchAria', { name })}
                        disabled={disabled}
                      />
                      {color.swatch ? (
                        <button
                          type="button"
                          className="link t-xs"
                          onClick={() =>
                            onChange({
                              ...draft,
                              colors: draft.colors.map((c) => (c.key === color.key ? { ...c, swatch: '' } : c)),
                            })
                          }
                          disabled={disabled}
                        >
                          {t('admin.catalog.variants.noSwatch')}
                        </button>
                      ) : (
                        <span className="t-xs t-faint">{t('admin.catalog.variants.nameOnly')}</span>
                      )}
                    </span>
                    <input
                      className="input input--sm"
                      value={color.name}
                      maxLength={MAX_COLOR_NAME_LENGTH}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          colors: draft.colors.map((c) => (c.key === color.key ? { ...c, name: event.target.value } : c)),
                        })
                      }
                      aria-label={t('admin.catalog.variants.colorNameAria')}
                      aria-invalid={Boolean(issue)}
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      className="size-row__icon size-row__icon--danger"
                      onClick={() => onChange(removeColor(draft, color.key))}
                      aria-label={t('admin.catalog.sizes.remove', { size: name })}
                      disabled={disabled}
                    >
                      <IconTrash size={14} />
                    </button>
                    {issue && <p className="field__error size-row__error">{t(`admin.catalog.variants.errors.${issue}`)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Sizes ── */}
      {draft.hasSizes && (
        <div className="variant-block">
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="size-label">{t('admin.catalog.sizes.labelField')}</label>
              <select
                id="size-label"
                className="select"
                value={draft.sizeLabel}
                onChange={(event) => onChange({ ...draft, sizeLabel: event.target.value as SizeLabel })}
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
                  onClick={() =>
                    onChange(addSizes(draft.sizes.length === 0 ? { ...draft, sizeLabel: preset.label } : draft, preset.sizes))
                  }
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
                onKeyDown={onEnter(addSizeList)}
                disabled={disabled}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={addSizeList}
                disabled={disabled || !newSizes.trim()}
              >
                <IconPlus size={14} />
                {t('admin.catalog.sizes.add')}
              </button>
            </div>
          </div>

          {draft.sizes.length === 0 ? (
            <p className="t-sm t-faint">{t('admin.catalog.sizes.empty')}</p>
          ) : (
            <div className="variant-sizes">
              {draft.sizes.map((size, index) => {
                const issue = issueOf(size.key);
                const name = size.name.trim() || '—';
                return (
                  <div key={size.key} className={`variant-size${issue ? ' has-error' : ''}`}>
                    <button
                      type="button"
                      className="size-row__icon"
                      onClick={() => onChange({ ...draft, sizes: moveItem(draft.sizes, index, -1) })}
                      disabled={disabled || index === 0}
                      aria-label={t('admin.catalog.sizes.moveUp', { size: name })}
                    >
                      <IconChevronUp size={14} />
                    </button>
                    <input
                      className="input input--sm"
                      value={size.name}
                      maxLength={MAX_SIZE_NAME_LENGTH}
                      onChange={(event) =>
                        onChange({
                          ...draft,
                          sizes: draft.sizes.map((s) => (s.key === size.key ? { ...s, name: event.target.value } : s)),
                        })
                      }
                      aria-label={t('admin.catalog.sizes.sizeAria')}
                      aria-invalid={Boolean(issue)}
                      disabled={disabled}
                    />
                    <button
                      type="button"
                      className="size-row__icon"
                      onClick={() => onChange({ ...draft, sizes: moveItem(draft.sizes, index, 1) })}
                      disabled={disabled || index === draft.sizes.length - 1}
                      aria-label={t('admin.catalog.sizes.moveDown', { size: name })}
                    >
                      <IconChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="size-row__icon size-row__icon--danger"
                      onClick={() => onChange(removeSize(draft, size.key))}
                      aria-label={t('admin.catalog.sizes.remove', { size: name })}
                      disabled={disabled}
                    >
                      <IconTrash size={14} />
                    </button>
                    {issue && <p className="field__error">{t(`admin.catalog.variants.errors.${issue}`)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── One row per combination ── */}
      {colorKeys.length > 0 && sizeKeys.length > 0 && (
        <div className="variant-block">
          <div className="row row--between gap-3 row--wrap">
            <span className="field__label" style={{ marginBottom: 0 }}>{t('admin.catalog.variants.matrixTitle')}</span>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={pricing}
                onChange={(event) => setPricing(event.target.checked)}
                disabled={disabled}
              />
              {t('admin.catalog.variants.pricingToggle')}
            </label>
          </div>

          <div className={`size-table variant-table${pricing ? ' variant-table--pricing' : ''}`}>
            <div className="variant-row variant-row--head" aria-hidden="true">
              <span>{draft.hasSizes ? t(sizeLabelKey(draft.sizeLabel)) : t(colorLabelKey(draft.colorLabel))}</span>
              <span>{t('admin.catalog.sizes.colSku')}</span>
              {pricing && <span>{t('admin.catalog.variants.colPrice')}</span>}
              {pricing && <span>{t('admin.catalog.variants.colCost')}</span>}
              <span>{t('admin.catalog.sizes.colStock')}</span>
              <span>{t('admin.catalog.sizes.colOnSale')}</span>
            </div>

            {colorKeys.map((colorKey) => {
              const color = draft.colors.find((c) => c.key === colorKey);
              const colorCells = sizeKeys.map((sizeKey) => cellOf(draft, colorKey, sizeKey));
              const anyOn = colorCells.some((cell) => cell?.isActive);
              return (
                <div key={colorKey ?? 'none'} className="variant-group">
                  {draft.hasColors && draft.hasSizes && (
                    <div className="variant-group__head">
                      <span className="row gap-2">
                        {color?.swatch && <span className="swatch swatch--sm" style={{ background: color.swatch }} aria-hidden="true" />}
                        <strong>{colorName(colorKey)}</strong>
                      </span>
                      <label className="checkbox t-xs">
                        <input
                          type="checkbox"
                          checked={anyOn}
                          onChange={(event) => onChange(setForAll(draft, { isActive: event.target.checked }, colorKey))}
                          disabled={disabled}
                        />
                        {t('admin.catalog.variants.colorOnSale')}
                      </label>
                    </div>
                  )}

                  {sizeKeys.map((sizeKey) => {
                    const key = cellKey(colorKey, sizeKey);
                    const cell: CellDraft | undefined = cellOf(draft, colorKey, sizeKey);
                    const offered = Boolean(cell && (cell.id || cell.isActive));
                    const shown = cell ?? { ...emptyCell(), isActive: false };
                    const issue = issueOf(key);
                    const label = draft.hasSizes ? sizeName(sizeKey) : colorName(colorKey);
                    const fullLabel = cellLabel(draft, colorKey, sizeKey) || label;
                    const stock = cellStock(shown);
                    const tone =
                      !shown.isActive || stock === null
                        ? ''
                        : stock.value <= 0
                          ? ' is-out'
                          : stock.value <= lowStockThreshold
                            ? ' is-low'
                            : '';
                    const update = (patch: Partial<CellDraft>) => onChange(updateCell(draft, colorKey, sizeKey, patch));

                    return (
                      <div
                        key={key}
                        className={`variant-row${shown.isActive ? '' : ' is-off'}${issue ? ' has-error' : ''}`}
                      >
                        <span className="variant-row__label">
                          {!draft.hasSizes && color?.swatch && (
                            <span className="swatch swatch--sm" style={{ background: color.swatch }} aria-hidden="true" />
                          )}
                          {label}
                        </span>
                        <input
                          className="input input--sm t-mono variant-row__sku"
                          value={shown.sku}
                          placeholder={
                            suggestVariantSku(
                              productSku,
                              draft.hasColors ? colorName(colorKey) : null,
                              draft.hasSizes ? sizeName(sizeKey) : null,
                            ) ?? ''
                          }
                          maxLength={MAX_SIZE_SKU_LENGTH}
                          onChange={(event) => update({ sku: event.target.value, ...(offered ? {} : { isActive: true }) })}
                          aria-label={t('admin.catalog.sizes.skuAria', { size: fullLabel })}
                          aria-invalid={issue === 'skuTooLong' || issue === 'skuDuplicate'}
                          disabled={disabled}
                        />
                        {pricing && (
                          <input
                            className="input input--sm t-num variant-row__price"
                            inputMode="decimal"
                            value={shown.price}
                            placeholder={productPrice || '—'}
                            onChange={(event) => update({ price: event.target.value, ...(offered ? {} : { isActive: true }) })}
                            aria-label={t('admin.catalog.variants.priceAria', { variant: fullLabel })}
                            aria-invalid={issue === 'price'}
                            disabled={disabled}
                          />
                        )}
                        {pricing && (
                          <input
                            className="input input--sm t-num variant-row__cost"
                            inputMode="decimal"
                            value={shown.cost}
                            placeholder="—"
                            onChange={(event) => update({ cost: event.target.value, ...(offered ? {} : { isActive: true }) })}
                            aria-label={t('admin.catalog.variants.costAria', { variant: fullLabel })}
                            aria-invalid={issue === 'cost'}
                            disabled={disabled}
                          />
                        )}
                        <input
                          className={`input input--sm size-row__stock variant-row__stock${tone}`}
                          inputMode="numeric"
                          value={shown.stock}
                          onChange={(event) => update({ stock: event.target.value, ...(offered ? {} : { isActive: true }) })}
                          aria-label={t('admin.catalog.sizes.stockAria', { size: fullLabel })}
                          aria-invalid={issue === 'stock'}
                          disabled={disabled}
                        />
                        <label className="checkbox variant-row__toggle">
                          <input
                            type="checkbox"
                            checked={shown.isActive}
                            onChange={(event) => update({ isActive: event.target.checked })}
                            aria-label={t('admin.catalog.sizes.onSaleAria', { size: fullLabel })}
                            disabled={disabled}
                          />
                        </label>
                        {issue && <p className="field__error size-row__error">{t(`admin.catalog.variants.errors.${issue}`)}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="size-bulk">
            <label className="t-xs t-faint" htmlFor="variant-bulk-stock">{t('admin.catalog.variants.setAllStock')}</label>
            <input
              id="variant-bulk-stock"
              className="input input--sm size-bulk__input"
              inputMode="numeric"
              value={bulkStock}
              onChange={(event) => setBulkStock(event.target.value)}
              onKeyDown={onEnter(() => {
                if (bulkStockValue === null) return;
                onChange(setForAll(draft, { stock: String(bulkStockValue) }));
                setBulkStock('');
              })}
              disabled={disabled}
            />
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                if (bulkStockValue === null) return;
                onChange(setForAll(draft, { stock: String(bulkStockValue) }));
                setBulkStock('');
              }}
              disabled={disabled || bulkStockValue === null}
            >
              {t('admin.catalog.sizes.setAllApply')}
            </button>
            {pricing && (
              <>
                <label className="t-xs t-faint" htmlFor="variant-bulk-price">{t('admin.catalog.variants.setAllPrice')}</label>
                <input
                  id="variant-bulk-price"
                  className="input input--sm size-bulk__input"
                  inputMode="decimal"
                  value={bulkPrice}
                  onChange={(event) => setBulkPrice(event.target.value)}
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    if (Number.isNaN(bulkPriceValue)) return;
                    onChange(setForAll(draft, { price: bulkPriceValue == null ? '' : String(bulkPriceValue) }));
                    setBulkPrice('');
                  }}
                  disabled={disabled || Number.isNaN(bulkPriceValue)}
                >
                  {t('admin.catalog.sizes.setAllApply')}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn--quiet btn--sm size-bulk__skus"
              onClick={() => onChange(fillVariantSkus(draft, productSku))}
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
                {tCount('admin.catalog.variants.count', included.filter(({ cell }) => cell.isActive).length)} ·{' '}
                {tCount('admin.catalog.sizes.units', total)}
              </span>
            </p>
            <p className="field__hint">
              {t('admin.catalog.sizes.totalHint')}
              {hasBackorder && <> {t('admin.catalog.sizes.backorderHint')}</>}
              {pricing && productPrice && <> {t('admin.catalog.variants.priceHint', { price: formatCurrency(Number(productPrice) || 0) })}</>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
