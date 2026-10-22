import { useState } from 'react';
import {
  useAdminCategories,
  useCreateCategory,
  useCreateProduct,
  useUpdateAdminProduct,
  useAddProductImages,
  useDeleteProductImage,
  useSetPrimaryImage,
  useSetProductInventory,
} from '../../../hooks/useAdminProducts';
import { fetchProductInventory, StockConflictError, uploadProductImage } from '../../../lib/api';
import {
  buildVariantPayload,
  draftsFromVariants,
  draftsTotal,
  parseStock,
  rebaseDrafts,
  sizeListChanged,
  validateDrafts,
  type SizeDraft,
} from '../../../lib/sizes';
import { Drawer } from '../../../components/ui/Drawer';
import { Media } from '../../../components/ui/Media';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconInfo } from '../../../components/ui/icons';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import { SizeEditor } from './SizeEditor';
import type { Product, SizeLabel } from '../../../types';

interface Props {
  mode: 'create' | 'edit';
  product?: Product;
  onClose: () => void;
}

/**
 * What the database holds for this product, as far as the editor knows. It is
 * replaced after every step that succeeds, so a retry after a partial failure
 * neither creates the product twice nor re-applies a stock change.
 */
interface Saved {
  id: string | null;
  hasSizes: boolean;
  sizeLabel: SizeLabel;
  stock: number;
  sizes: SizeDraft[];
}

/**
 * Product editing as a focused workflow rather than a page: clear sections
 * (media, information, pricing, inventory, visibility) separated by rules —
 * no nested cards, no endless single form.
 */
export function ProductFormDrawer({ mode, product, onClose }: Props) {
  const { t, tCount } = useI18n();
  const { data: categories = [] } = useAdminCategories();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateAdminProduct();
  const setInventory = useSetProductInventory();
  const addImages = useAddProductImages();
  const deleteImage = useDeleteProductImage();
  const setPrimary = useSetPrimaryImage();

  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '');
  const [stock, setStock] = useState(product?.stock_quantity != null ? String(product.stock_quantity) : '0');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [lowStock, setLowStock] = useState(String(product?.low_stock_threshold ?? 5));
  const [weight, setWeight] = useState(product?.weight_grams != null ? String(product.weight_grams) : '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);

  const [hasSizes, setHasSizes] = useState(product?.has_sizes ?? false);
  const [sizeLabel, setSizeLabel] = useState<SizeLabel>(product?.size_label ?? 'size');
  const [sizeDrafts, setSizeDrafts] = useState<SizeDraft[]>(() => draftsFromVariants(product?.product_variants));
  const [showSizeErrors, setShowSizeErrors] = useState(false);

  const [saved, setSaved] = useState<Saved>(() => ({
    id: product?.id ?? null,
    hasSizes: product?.has_sizes ?? false,
    sizeLabel: product?.size_label ?? 'size',
    stock: product?.stock_quantity ?? 0,
    sizes: draftsFromVariants(product?.product_variants),
  }));

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingImages = product?.product_images ?? [];
  const lowStockThreshold = Math.max(0, Math.trunc(Number(lowStock) || 0));

  // The single stock figure of an unsized product. Left untouched it is valid
  // whatever it holds — a negative figure is the backorder depth the order
  // trigger wrote, not an input error; an edited figure must be 0 or more.
  const unsizedStock = (): number | null =>
    stock.trim() === String(saved.stock) ? saved.stock : parseStock(stock);

  const toggleSizes = () => {
    // Sizes → one figure: start from what the sizes add up to. (An unsized
    // product being tried with sizes keeps its own figure in `stock`.)
    if (hasSizes && saved.hasSizes) setStock(String(draftsTotal(sizeDrafts)));
    setHasSizes(!hasSizes);
    setShowSizeErrors(false);
  };

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
      const freshSizes = draftsFromVariants(fresh.product_variants);
      setSizeDrafts((drafts) => rebaseDrafts(drafts, fresh.product_variants));
      setSaved((prev) => ({ ...prev, stock: fresh.stock_quantity, sizes: freshSizes }));

      const moved = err.size ? fresh.product_variants.find((v) => v.size === err.size) : undefined;
      setError(
        moved
          ? t('admin.catalog.sizes.conflict', { size: moved.size, now: moved.stock_qty })
          : t('admin.catalog.sizes.conflictGeneric', { now: fresh.stock_quantity })
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

    const stockValue = hasSizes ? null : unsizedStock();
    if (!hasSizes && stockValue === null) {
      setError(t('admin.catalog.sizes.errors.stock'));
      return;
    }
    if (hasSizes) {
      setShowSizeErrors(true);
      if (sizeDrafts.length === 0) { setError(t('admin.catalog.sizes.errors.none')); return; }
      const { first } = validateDrafts(sizeDrafts);
      if (first) { setError(t(`admin.catalog.sizes.errors.${first}`)); return; }
    }

    setBusy(true);
    let current = saved;
    try {
      // Stock is deliberately not among these fields: it only moves through
      // the inventory call below, which refuses to overwrite a figure that an
      // order changed while this drawer was open.
      const fields = {
        name: name.trim(),
        category_id: categoryId,
        price: Number(price) || 0,
        description: description.trim() || null,
        sku: sku.trim() || null,
        low_stock_threshold: lowStockThreshold,
        weight_grams: weight.trim() ? Math.max(0, Math.trunc(Number(weight))) : null,
        is_active: isActive,
        is_featured: isFeatured,
      };

      if (!current.id) {
        const created = await createProduct.mutateAsync({
          ...fields,
          stock_quantity: hasSizes ? 0 : stockValue ?? 0,
        });
        current = {
          id: created.id,
          hasSizes: created.has_sizes,
          sizeLabel: created.size_label,
          stock: created.stock_quantity,
          sizes: [],
        };
        setSaved(current);
      } else {
        await updateProduct.mutateAsync({ productId: current.id, updates: fields });
      }
      const productId = current.id as string;

      // Sizes and stock — only when something about them changed, so editing
      // a name never rewrites the size list underneath a concurrent order.
      const inventoryChanged =
        hasSizes !== current.hasSizes
        || (hasSizes && (sizeLabel !== current.sizeLabel || sizeListChanged(sizeDrafts, current.sizes)))
        || (!hasSizes && stockValue !== current.stock);

      let archived = 0;
      if (inventoryChanged) {
        const result = await setInventory.mutateAsync({
          productId,
          hasSizes,
          sizeLabel,
          variants: hasSizes ? buildVariantPayload(sizeDrafts) : [],
          stockQuantity: hasSizes ? undefined : stockValue ?? undefined,
          // The optimistic check only applies to a figure the admin edited
          // directly; switching sizes off sets a fresh total.
          expectedStock: !hasSizes && !current.hasSizes ? current.stock : null,
        });
        archived = result.archived;
        const resultSizes = draftsFromVariants(result.variants);
        current = {
          id: productId,
          hasSizes: result.has_sizes,
          sizeLabel: result.size_label,
          stock: result.stock_quantity,
          sizes: resultSizes,
        };
        setSaved(current);
        setSizeDrafts(resultSizes);
        setStock(String(result.stock_quantity));
      }

      // Upload any newly selected images and attach them.
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
          })),
        });
      }

      toast(mode === 'create' ? t('admin.catalog.form.created') : t('admin.catalog.form.saved'));
      if (archived > 0) toast(tCount('admin.catalog.sizes.archived', archived));
      onClose();
    } catch (err) {
      if (err instanceof StockConflictError && current.id) {
        await recoverFromConflict(err, current.id);
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
            <p className="t-xs t-faint">{t('admin.catalog.form.mediaHint')}</p>
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
            {files.length > 0 && (
              <p className="field__hint">{files.map((f) => f.name).join(', ')}</p>
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
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="product-sku">{t('admin.catalog.form.sku')}</label>
              <input
                id="product-sku"
                className="input"
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
                className={`switch${hasSizes ? ' is-on' : ''}`}
                role="switch"
                aria-checked={hasSizes}
                aria-label={t('admin.catalog.sizes.toggle')}
                onClick={toggleSizes}
                disabled={busy}
              />
            </div>
          </div>

          {hasSizes ? (
            <SizeEditor
              drafts={sizeDrafts}
              onChange={setSizeDrafts}
              label={sizeLabel}
              onLabelChange={setSizeLabel}
              productSku={sku}
              lowStockThreshold={lowStockThreshold}
              showErrors={showSizeErrors}
              disabled={busy}
            />
          ) : (
            <>
              {saved.hasSizes && (
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
                {hasSizes && <> {t('admin.catalog.sizes.lowStockHint')}</>}
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
