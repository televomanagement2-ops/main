import { useState } from 'react';
import {
  useAdminCategories,
  useCreateCategory,
  useCreateProduct,
  useUpdateAdminProduct,
  useAddProductImages,
  useDeleteProductImage,
  useSetPrimaryImage,
} from '../../../hooks/useAdminProducts';
import { uploadProductImage } from '../../../lib/api';
import { Drawer } from '../../../components/ui/Drawer';
import { Media } from '../../../components/ui/Media';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert } from '../../../components/ui/icons';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
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
 */
export function ProductFormDrawer({ mode, product, onClose }: Props) {
  const { t } = useI18n();
  const { data: categories = [] } = useAdminCategories();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateAdminProduct();
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

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingImages = product?.product_images ?? [];

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError(t('admin.catalog.form.nameRequired')); return; }
    if (!categoryId) { setError(t('admin.catalog.form.categoryRequired')); return; }

    setBusy(true);
    try {
      const fields = {
        name: name.trim(),
        category_id: categoryId,
        price: Number(price) || 0,
        description: description.trim() || null,
        sku: sku.trim() || null,
        stock_quantity: Math.max(0, Math.trunc(Number(stock) || 0)),
        low_stock_threshold: Math.max(0, Math.trunc(Number(lowStock) || 0)),
        weight_grams: weight.trim() ? Math.max(0, Math.trunc(Number(weight))) : null,
        is_active: isActive,
        is_featured: isFeatured,
      };

      let productId = product?.id;
      const hadImages = existingImages.length > 0;

      if (mode === 'create') {
        const created = await createProduct.mutateAsync(fields);
        productId = created.id;
      } else if (productId) {
        await updateProduct.mutateAsync({ productId, updates: fields });
      }

      // Upload any newly selected images and attach them.
      if (productId && files.length > 0) {
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.form.error'));
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
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="product-stock">{t('admin.catalog.form.stock')}</label>
              <input
                id="product-stock"
                className="input"
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
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
              <p className="field__hint">{t('admin.catalog.form.lowStockHint')}</p>
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
