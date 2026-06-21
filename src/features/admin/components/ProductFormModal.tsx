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
import { useI18n } from '../../../lib/i18n';
import type { Product } from '../../../types';

interface Props {
  mode: 'create' | 'edit';
  product?: Product;
  onClose: () => void;
}

export function ProductFormModal({ mode, product, onClose }: Props) {
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

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.catalog.form.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1300, display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px',
        background: 'rgba(0,0,0,.55)', overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="card card-padded"
        style={{ width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="heading-2" style={{ marginBottom: 'var(--sp-4)' }}>
          {mode === 'create' ? t('admin.catalog.form.newTitle') : t('admin.catalog.form.editTitle')}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <div className="form-group">
            <label className="label">{t('admin.catalog.form.name')} *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="label">{t('admin.catalog.form.category')} *</label>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('admin.catalog.form.chooseCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
              <input
                className="input"
                placeholder={t('admin.catalog.form.newCategory')}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCreateCategory}
                disabled={!newCategory.trim() || createCategory.isPending}
              >
                {t('admin.catalog.form.createCategory')}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div className="form-group">
              <label className="label">{t('admin.catalog.form.price')} *</label>
              <input className="input" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">{t('admin.catalog.form.stock')}</label>
              <input className="input" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">{t('admin.catalog.form.sku')}</label>
              <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">{t('admin.catalog.form.lowStock')}</label>
              <input className="input" type="number" min={0} value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">{t('admin.catalog.form.weight')}</label>
              <input className="input" type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">{t('admin.catalog.form.description')}</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {t('admin.catalog.form.active')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
              {t('admin.catalog.form.featured')}
            </label>
          </div>

          {/* Existing images (edit mode) */}
          {existingImages.length > 0 && (
            <div className="form-group">
              <label className="label">{t('admin.catalog.form.images')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                {existingImages.map((img) => (
                  <div key={img.id} style={{ width: 96, fontSize: 11, textAlign: 'center' }}>
                    <img src={img.url} alt={img.alt_text ?? ''} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                    {img.is_primary ? (
                      <span style={{ color: 'var(--color-success, #1a8f4c)', fontWeight: 600 }}>{t('admin.catalog.form.primary')}</span>
                    ) : (
                      <button type="button" className="link-btn" onClick={() => product && setPrimary.mutate({ productId: product.id, imageId: img.id })}>
                        {t('admin.catalog.form.setPrimary')}
                      </button>
                    )}
                    <button type="button" className="link-btn" style={{ color: 'var(--color-danger)', display: 'block', margin: '0 auto' }} onClick={() => deleteImage.mutate(img.id)}>
                      {t('admin.catalog.form.remove')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New image upload */}
          <div className="form-group">
            <label className="label">{t('admin.catalog.form.addImages')}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="caption" style={{ marginTop: 4 }}>{files.map((f) => f.name).join(', ')}</p>
            )}
          </div>

          {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
              {t('admin.catalog.form.cancel')}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? t('admin.catalog.form.saving') : t('admin.catalog.form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
