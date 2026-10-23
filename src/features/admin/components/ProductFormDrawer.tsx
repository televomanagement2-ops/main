import { useState } from 'react';
import {
  useAdminCategories,
  useCatalogCosts,
  useCreateCategory,
  useCreateProduct,
  useUpdateAdminProduct,
  useAddProductImages,
  useDeleteProductImage,
  useSetPrimaryImage,
  useSetImageColor,
  useSaveProductVariants,
} from '../../../hooks/useAdminProducts';
import { useSizeGuides } from '../../../hooks/useSizeGuides';
import { useInventoryMovements } from '../../../hooks/useInventory';
import { AppError, fetchProductInventory, StockConflictError, uploadProductImage, type VariantsSaveResult } from '../../../lib/api';
import { parseStock } from '../../../lib/sizes';
import {
  buildSaveConfig,
  draftChanged,
  draftFromProduct,
  draftTotal,
  parseAmount,
  rebaseVariantDraft,
  setColorsEnabled,
  setSizesEnabled,
  validateVariantDraft,
  type VariantDraft,
} from '../../../lib/variants';
import { Drawer } from '../../../components/ui/Drawer';
import { Media } from '../../../components/ui/Media';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconInfo } from '../../../components/ui/icons';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { VariantEditor } from './VariantEditor';
import { MovementList } from './MovementList';
import type { Product } from '../../../types';

interface Props {
  mode: 'create' | 'edit';
  product?: Product;
  onClose: () => void;
}

/**
 * Product editing as a focused workflow rather than a page: clear sections
 * (media, information, pricing, inventory, visibility) separated by rules —
 * no nested cards, no endless single form.
 *
 * Cost prices are not part of the product rows the catalog loads (the API
 * hides them), so the form waits for them before it starts.
 */
export function ProductFormDrawer({ mode, product, onClose }: Props) {
  const { t } = useI18n();
  const costs = useCatalogCosts();

  if (costs.isLoading) {
    return (
      <Drawer
        open
        onClose={onClose}
        wide
        eyebrow={t('admin.tabs.catalog')}
        title={mode === 'create' ? t('admin.catalog.form.newTitle') : t('admin.catalog.form.editTitle')}
        closeLabel={t('common.close')}
      >
        <div className="page-loading"><div className="spinner" /></div>
      </Drawer>
    );
  }

  return (
    <ProductForm
      mode={mode}
      product={product}
      onClose={onClose}
      costs={costs.data ?? { products: {}, variants: {} }}
    />
  );
}

/** What the database holds for this product, as far as the editor knows. */
interface Saved {
  id: string | null;
  /** Neither sizes nor colours: the single stock figure. */
  stock: number;
  variants: VariantDraft;
}

function withCosts(product: Product | undefined, costs: Record<string, number>): Product | undefined {
  if (!product) return product;
  return {
    ...product,
    product_variants: product.product_variants?.map((v) => ({ ...v, cost_price: costs[v.id] ?? null })),
  };
}

/** A save result → the product shape the editor model reads. */
function draftFromResult(result: VariantsSaveResult, base: VariantDraft): VariantDraft {
  return draftFromProduct({
    has_sizes: result.has_sizes,
    has_colors: result.has_colors,
    size_label: base.sizeLabel,
    color_label: base.colorLabel,
    product_colors: result.colors,
    product_variants: result.variants,
  } as Product);
}

const amountText = (value: number | null | undefined) => (value != null ? String(value) : '');

function ProductForm({
  mode,
  product,
  onClose,
  costs,
}: Props & { costs: { products: Record<string, number>; variants: Record<string, number> } }) {
  const { t, tCount, formatCurrency } = useI18n();
  const { data: categories = [] } = useAdminCategories();
  const { data: guides = [] } = useSizeGuides();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateAdminProduct();
  const saveVariants = useSaveProductVariants();
  const addImages = useAddProductImages();
  const deleteImage = useDeleteProductImage();
  const setPrimary = useSetPrimaryImage();
  const setImageColor = useSetImageColor();

  const initialProduct = withCosts(product, costs.variants);

  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '');
  const [compareAt, setCompareAt] = useState(amountText(product?.compare_at_price));
  const [cost, setCost] = useState(amountText(product ? costs.products[product.id] : null));
  const [stock, setStock] = useState(product?.stock_quantity != null ? String(product.stock_quantity) : '0');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [lowStock, setLowStock] = useState(String(product?.low_stock_threshold ?? 5));
  const [weight, setWeight] = useState(product?.weight_grams != null ? String(product.weight_grams) : '');
  const [sizeGuideId, setSizeGuideId] = useState(product?.size_guide_id ?? '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);

  const [variants, setVariants] = useState<VariantDraft>(() => draftFromProduct(initialProduct));
  const [showVariantErrors, setShowVariantErrors] = useState(false);

  const [saved, setSaved] = useState<Saved>(() => ({
    id: product?.id ?? null,
    stock: product?.stock_quantity ?? 0,
    variants: draftFromProduct(initialProduct),
  }));

  // Which colour each existing photo shows (colour draft key, or '' for all).
  const existingImages = product?.product_images ?? [];
  const [imageColors, setImageColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(existingImages.map((img) => [img.id, img.color_id ?? ''])),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [uploadColor, setUploadColor] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowStockThreshold = Math.max(0, Math.trunc(Number(lowStock) || 0));
  const hasVariants = variants.hasSizes || variants.hasColors;
  const savedHasVariants = saved.variants.hasSizes || saved.variants.hasColors;

  const priceValue = parseAmount(price);
  const compareValue = parseAmount(compareAt);
  const costValue = parseAmount(cost);
  const margin =
    priceValue != null && !Number.isNaN(priceValue) && priceValue > 0 && costValue != null && !Number.isNaN(costValue)
      ? { profit: priceValue - costValue, percent: ((priceValue - costValue) / priceValue) * 100 }
      : null;
  const markdown =
    priceValue != null && compareValue != null && !Number.isNaN(priceValue) && !Number.isNaN(compareValue) && compareValue > priceValue
      ? Math.round(((compareValue - priceValue) / compareValue) * 100)
      : null;

  const category = categories.find((c) => c.id === categoryId);
  const inheritedGuide = guides.find((g) => g.id === category?.size_guide_id)
    ?? guides.find((g) => g.id === categories.find((c) => c.id === category?.parent_id)?.size_guide_id);

  // The single stock figure of a product without variants. Left untouched it
  // is valid whatever it holds — a negative figure is the backorder depth the
  // order trigger wrote, not an input error; an edited figure must be 0 or more.
  const singleStock = (): number | null => (stock.trim() === String(saved.stock) ? saved.stock : parseStock(stock));

  const toggleSizes = () => {
    if (hasVariants && !variants.hasColors && variants.hasSizes && savedHasVariants) setStock(String(draftTotal(variants)));
    setVariants((d) => setSizesEnabled(d, !d.hasSizes));
    setShowVariantErrors(false);
  };
  const toggleColors = () => {
    if (hasVariants && variants.hasColors && !variants.hasSizes && savedHasVariants) setStock(String(draftTotal(variants)));
    setVariants((d) => setColorsEnabled(d, !d.hasColors));
    setShowVariantErrors(false);
  };

  const colorOptions = variants.hasColors ? variants.colors.filter((c) => c.name.trim()) : [];

  const handleCreateCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    try {
      const cat = await createCategory.mutateAsync(trimmed);
      setCategoryId(cat.id);
      setNewCategory('');
      toast(t('admin.catalog.form.categoryCreated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.form.error'));
    }
  };

  /**
   * Another writer (usually a paid order) moved a stock figure after this
   * editor loaded it, and the database refused to overwrite it. Adopt the
   * current figures and say which one moved; the admin saves again knowingly.
   */
  const recoverFromConflict = async (err: StockConflictError, productId: string) => {
    try {
      const fresh = await fetchProductInventory(productId);
      const freshVariants = fresh.product_variants.map((v) => ({ ...v, cost_price: costs.variants[v.id] ?? null }));
      setVariants((d) => rebaseVariantDraft(d, freshVariants));
      setSaved((prev) => ({
        ...prev,
        stock: fresh.stock_quantity,
        variants: rebaseVariantDraft(prev.variants, freshVariants),
      }));

      const moved = err.variantId ? fresh.product_variants.find((v) => v.id === err.variantId) : undefined;
      const colorOf = (id: string | null) => variants.colors.find((c) => c.id === id)?.name;
      setError(
        moved
          ? t('admin.catalog.sizes.conflict', {
              size: [colorOf(moved.color_id), moved.size].filter(Boolean).join(' / '),
              now: moved.stock_qty,
            })
          : t('admin.catalog.sizes.conflictGeneric', { now: fresh.stock_quantity }),
      );
    } catch {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError(t('admin.catalog.form.nameRequired')); return; }
    if (!categoryId) { setError(t('admin.catalog.form.categoryRequired')); return; }
    if (priceValue == null || Number.isNaN(priceValue)) { setError(t('admin.catalog.form.priceInvalid')); return; }
    if (Number.isNaN(compareValue) || Number.isNaN(costValue)) { setError(t('admin.catalog.form.amountInvalid')); return; }

    const stockValue = hasVariants ? null : singleStock();
    if (!hasVariants && stockValue === null) {
      setError(t('admin.catalog.sizes.errors.stock'));
      return;
    }
    if (hasVariants) {
      setShowVariantErrors(true);
      const { first } = validateVariantDraft(variants);
      if (first) { setError(t(`admin.catalog.variants.errors.${first}`)); return; }
    }

    setBusy(true);
    let current = saved;
    try {
      // Stock is deliberately not among these fields: it only moves through
      // the variants call below, which refuses to overwrite a figure that an
      // order changed while this drawer was open.
      const fields = {
        name: name.trim(),
        category_id: categoryId,
        price: priceValue,
        compare_at_price: compareValue,
        cost_price: costValue,
        description: description.trim() || null,
        sku: sku.trim() || null,
        low_stock_threshold: lowStockThreshold,
        weight_grams: weight.trim() ? Math.max(0, Math.trunc(Number(weight))) : null,
        size_guide_id: sizeGuideId || null,
        is_active: isActive,
        is_featured: isFeatured,
      };

      if (!current.id) {
        const created = await createProduct.mutateAsync({ ...fields, stock_quantity: hasVariants ? 0 : stockValue ?? 0 });
        current = { id: created.id, stock: created.stock_quantity, variants: draftFromProduct(created) };
        setSaved(current);
      } else {
        await updateProduct.mutateAsync({ productId: current.id, updates: fields });
      }
      const productId = current.id as string;

      // Variants and stock — only when something about them changed, so
      // editing a name never rewrites the variant list under a concurrent order.
      const currentHasVariants = current.variants.hasSizes || current.variants.hasColors;
      const variantsChanged =
        hasVariants !== currentHasVariants
        || (hasVariants && (draftChanged(variants, current.variants)
          || variants.sizeLabel !== current.variants.sizeLabel
          || variants.colorLabel !== current.variants.colorLabel))
        || (!hasVariants && stockValue !== current.stock);

      let colorIds: Record<string, string> = Object.fromEntries(
        variants.colors.filter((c) => c.id).map((c) => [c.key, c.id as string]),
      );
      let archived = 0;
      if (variantsChanged) {
        const result = await saveVariants.mutateAsync({
          productId,
          config: hasVariants
            ? buildSaveConfig(variants)
            : {
                has_sizes: false,
                has_colors: false,
                size_label: variants.sizeLabel,
                color_label: variants.colorLabel,
                stock_quantity: stockValue,
                // The optimistic check only applies to a figure the admin
                // edited directly; switching variants off sets a fresh total.
                expected_stock: !currentHasVariants ? current.stock : null,
              },
        });
        archived = result.archived;
        colorIds = { ...colorIds, ...result.color_ids };
        const next = draftFromResult(result, variants);
        current = { id: productId, stock: result.stock_quantity, variants: next };
        setSaved(current);
        setVariants(next);
        setStock(String(result.stock_quantity));
      }

      // Photos per colour. A colour created by this save only has an id now.
      const resolveColor = (key: string) => (key ? colorIds[key] ?? null : null);
      for (const img of existingImages) {
        const wanted = resolveColor(imageColors[img.id] ?? '');
        if (wanted !== (img.color_id ?? null)) {
          await setImageColor.mutateAsync({ imageId: img.id, colorId: wanted });
        }
      }

      if (files.length > 0) {
        const hadImages = existingImages.length > 0;
        const urls = await Promise.all(files.map((f) => uploadProductImage(f)));
        await addImages.mutateAsync({
          productId,
          images: urls.map((url, i) => ({
            url,
            // First uploaded image becomes primary only if the product has none yet.
            is_primary: !hadImages && i === 0,
            sort_order: existingImages.length + i,
            color_id: resolveColor(uploadColor),
          })),
        });
      }

      toast(mode === 'create' ? t('admin.catalog.form.created') : t('admin.catalog.form.saved'));
      if (archived > 0) toast(tCount('admin.catalog.variants.archived', archived));
      onClose();
    } catch (err) {
      if (err instanceof StockConflictError && current.id) {
        await recoverFromConflict(err, current.id);
      } else if (err instanceof AppError && err.code === 'sku_taken') {
        setError(t('admin.catalog.variants.skuTaken', { sku: err.detail ?? '' }));
      } else {
        setError(err instanceof Error ? err.message : t('admin.catalog.form.error'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      eyebrow={t('admin.tabs.catalog')}
      title={mode === 'create' ? t('admin.catalog.form.newTitle') : t('admin.catalog.form.editTitle')}
      closeLabel={t('common.close')}
      footer={
        <div className="row gap-3" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
            {t('admin.catalog.form.cancel')}
          </button>
          <button type="submit" form="product-form" className="btn btn--primary" disabled={busy}>
            {busy ? (
              <>
                <Spinner onAction />
                {t('admin.catalog.form.saving')}
              </>
            ) : (
              t('admin.catalog.form.save')
            )}
          </button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="form-sections">
        {/* ── Media ── */}
        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.catalog.form.mediaSection')}</p>
            <p className="t-xs t-faint">
              {t('admin.catalog.form.mediaHint')}
              {variants.hasColors && <> {t('admin.catalog.variants.photoHint')}</>}
            </p>
          </div>

          {existingImages.length > 0 && (
            <div className="media-manager">
              {existingImages.map((img) => (
                <div key={img.id} className="media-manager__item">
                  <Media src={img.url} alt={img.alt_text ?? ''} ratio="square" />
                  {img.is_primary ? (
                    <span className="media-manager__primary">{t('admin.catalog.form.primary')}</span>
                  ) : (
                    <button
                      type="button"
                      className="media-manager__action"
                      onClick={() => product && setPrimary.mutate({ productId: product.id, imageId: img.id })}
                    >
                      {t('admin.catalog.form.setPrimary')}
                    </button>
                  )}
                  {variants.hasColors && (
                    <select
                      className="select select--sm media-manager__color"
                      value={imageColors[img.id] ?? ''}
                      onChange={(e) => setImageColors((prev) => ({ ...prev, [img.id]: e.target.value }))}
                      aria-label={t('admin.catalog.variants.photoColorAria')}
                      disabled={busy}
                    >
                      <option value="">{t('admin.catalog.variants.allColors')}</option>
                      {colorOptions.map((c) => (
                        <option key={c.key} value={c.key}>{c.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="media-manager__action media-manager__action--danger"
                    onClick={() => deleteImage.mutate(img.id)}
                  >
                    {t('admin.catalog.form.remove')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="product-images">{t('admin.catalog.form.addImages')}</label>
              <input
                id="product-images"
                className="file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && <p className="field__hint">{files.map((f) => f.name).join(', ')}</p>}
            </div>
            {variants.hasColors && (
              <div className="field">
                <label className="field__label" htmlFor="upload-color">{t('admin.catalog.variants.uploadColor')}</label>
                <select
                  id="upload-color"
                  className="select"
                  value={uploadColor}
                  onChange={(e) => setUploadColor(e.target.value)}
                >
                  <option value="">{t('admin.catalog.variants.allColors')}</option>
                  {colorOptions.map((c) => (
                    <option key={c.key} value={c.key}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* ── Core information ── */}
        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.catalog.form.infoSection')}</p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="product-name">{t('admin.catalog.form.name')} *</label>
            <input
              id="product-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="product-category">{t('admin.catalog.form.category')} *</label>
            <select
              id="product-category"
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t('admin.catalog.form.chooseCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="row gap-2" style={{ marginTop: 'var(--s-2)' }}>
              <input
                className="input input--sm"
                placeholder={t('admin.catalog.form.newCategory')}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                aria-label={t('admin.catalog.form.newCategory')}
              />
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleCreateCategory}
                disabled={!newCategory.trim() || createCategory.isPending}
              >
                {t('admin.catalog.form.createCategory')}
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="product-description">{t('admin.catalog.form.description')}</label>
            <textarea
              id="product-description"
              className="textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="product-guide">{t('admin.catalog.form.sizeGuide')}</label>
            <select
              id="product-guide"
              className="select"
              value={sizeGuideId}
              onChange={(e) => setSizeGuideId(e.target.value)}
            >
              <option value="">
                {inheritedGuide
                  ? t('admin.catalog.form.sizeGuideInherit', { name: inheritedGuide.name })
                  : t('admin.catalog.form.sizeGuideNone')}
              </option>
              {guides.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="field__hint">{t('admin.catalog.form.sizeGuideHint')}</p>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.catalog.form.pricingSection')}</p>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="product-price">{t('admin.catalog.form.price')} *</label>
              <input
                id="product-price"
                className="input t-num"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="product-compare">{t('admin.catalog.form.compareAt')}</label>
              <input
                id="product-compare"
                className="input t-num"
                inputMode="decimal"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
              />
              <p className="field__hint">
                {markdown != null
                  ? t('admin.catalog.form.compareAtActive', { percent: markdown })
                  : t('admin.catalog.form.compareAtHint')}
              </p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="product-cost">{t('admin.catalog.form.cost')}</label>
              <input
                id="product-cost"
                className="input t-num"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
              <p className="field__hint">
                {margin
                  ? t('admin.catalog.form.margin', {
                      percent: margin.percent.toFixed(1),
                      profit: formatCurrency(margin.profit),
                    })
                  : t('admin.catalog.form.costHint')}
              </p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="product-sku">{t('admin.catalog.form.sku')}</label>
              <input
                id="product-sku"
                className="input t-mono"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ── Inventory ── */}
        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.catalog.form.inventorySection')}</p>
          </div>

          <div className="info-rows">
            <div className="info-row">
              <span>
                <strong style={{ display: 'block' }}>{t('admin.catalog.sizes.toggle')}</strong>
                <span className="t-xs t-faint">{t('admin.catalog.sizes.toggleHint')}</span>
              </span>
              <button
                type="button"
                className={`switch${variants.hasSizes ? ' is-on' : ''}`}
                role="switch"
                aria-checked={variants.hasSizes}
                aria-label={t('admin.catalog.sizes.toggle')}
                onClick={toggleSizes}
                disabled={busy}
              />
            </div>
            <div className="info-row">
              <span>
                <strong style={{ display: 'block' }}>{t('admin.catalog.variants.colorToggle')}</strong>
                <span className="t-xs t-faint">{t('admin.catalog.variants.colorToggleHint')}</span>
              </span>
              <button
                type="button"
                className={`switch${variants.hasColors ? ' is-on' : ''}`}
                role="switch"
                aria-checked={variants.hasColors}
                aria-label={t('admin.catalog.variants.colorToggle')}
                onClick={toggleColors}
                disabled={busy}
              />
            </div>
          </div>

          {hasVariants ? (
            <>
              {savedHasVariants
                && (saved.variants.hasColors !== variants.hasColors || saved.variants.hasSizes !== variants.hasSizes) && (
                <div className="notice notice--caution">
                  <IconInfo size={15} />
                  <div className="notice__body">{t('admin.catalog.variants.shapeNotice')}</div>
                </div>
              )}
              <VariantEditor
                draft={variants}
                onChange={setVariants}
                productSku={sku}
                productPrice={price}
                lowStockThreshold={lowStockThreshold}
                showErrors={showVariantErrors}
                disabled={busy}
              />
            </>
          ) : (
            <>
              {savedHasVariants && (
                <div className="notice notice--caution">
                  <IconInfo size={15} />
                  <div className="notice__body">{t('admin.catalog.sizes.offNotice')}</div>
                </div>
              )}
              <div className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="product-stock">{t('admin.catalog.form.stock')}</label>
                  {/* No min: an oversold product shows its negative backorder
                      depth here, and a min would block saving any other field. */}
                  <input
                    id="product-stock"
                    className="input"
                    inputMode="numeric"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="product-low">{t('admin.catalog.form.lowStock')}</label>
              <input
                id="product-low"
                className="input"
                type="number"
                min={0}
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value)}
              />
              <p className="field__hint">
                {t('admin.catalog.form.lowStockHint')}
                {hasVariants && <> {t('admin.catalog.sizes.lowStockHint')}</>}
              </p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="product-weight">{t('admin.catalog.form.weight')}</label>
              <input
                id="product-weight"
                className="input"
                type="number"
                min={0}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          {saved.id && (
            <div className="field">
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowHistory((v) => !v)}
                aria-expanded={showHistory}
              >
                {showHistory ? t('admin.catalog.form.hideHistory') : t('admin.catalog.form.showHistory')}
              </button>
              {showHistory && <ProductHistory productId={saved.id} />}
            </div>
          )}
        </section>

        {/* ── Visibility ── */}
        <section className="form-section">
          <div className="form-section__head">
            <p className="t-label">{t('admin.catalog.form.visibilitySection')}</p>
          </div>
          <div className="info-rows">
            <div className="info-row">
              <span>
                <strong style={{ display: 'block' }}>{t('admin.catalog.form.active')}</strong>
                <span className="t-xs t-faint">{t('admin.catalog.form.activeHint')}</span>
              </span>
              <button
                type="button"
                className={`switch${isActive ? ' is-on' : ''}`}
                role="switch"
                aria-checked={isActive}
                aria-label={t('admin.catalog.form.active')}
                onClick={() => setIsActive((v) => !v)}
              />
            </div>
            <div className="info-row">
              <span>
                <strong style={{ display: 'block' }}>{t('admin.catalog.form.featured')}</strong>
                <span className="t-xs t-faint">{t('admin.catalog.form.featuredHint')}</span>
              </span>
              <button
                type="button"
                className={`switch${isFeatured ? ' is-on' : ''}`}
                role="switch"
                aria-checked={isFeatured}
                aria-label={t('admin.catalog.form.featured')}
                onClick={() => setIsFeatured((v) => !v)}
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="notice notice--critical" style={{ marginTop: 'var(--s-5)' }}>
            <IconAlert size={15} />
            <div className="notice__body">{error}</div>
          </div>
        )}
      </form>
    </Drawer>
  );
}

/** The latest stock movements of one product. */
function ProductHistory({ productId }: { productId: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useInventoryMovements({ productId, page: 1 });
  if (isLoading) return <p className="t-xs t-faint">{t('common.loading')}</p>;
  const rows = data?.data ?? [];
  if (rows.length === 0) return <p className="t-xs t-faint">{t('admin.inventory.movements.empty')}</p>;
  return <MovementList movements={rows.slice(0, 20)} compact />;
}
