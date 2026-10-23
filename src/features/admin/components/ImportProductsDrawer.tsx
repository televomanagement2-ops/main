import { useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconDownload } from '../../../components/ui/icons';
import { useImportProducts } from '../../../hooks/useAdminProducts';
import { useI18n } from '../../../lib/i18n';
import { AppError } from '../../../lib/api';
import { dialectForLocale, downloadCsv, parseCsv, toCsv } from '../../../lib/csv';
import { PRODUCT_CSV_COLUMNS, planImport, type ImportPlan } from '../../../lib/productCsv';
import { toast } from '../../../store/toastStore';
import type { Product } from '../../../types';

interface Props {
  products: Product[];
  onClose: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Catalogue import from a spreadsheet: the file is checked here, line by
 * line, before anything is sent; the database then applies it all or nothing.
 */
export function ImportProductsDrawer({ products, onClose }: Props) {
  const { t, tCount, locale } = useI18n();
  const importProducts = useImportProducts();
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [createCategories, setCreateCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = new Set(products.map((p) => p.slug));
  const newCount = plan ? plan.products.filter((p) => !existing.has(String(p.slug))).length : 0;
  const blocked = !plan || plan.products.length === 0 || plan.issues.length > 0;

  const readFile = async (file: File | undefined) => {
    setError(null);
    setPlan(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(t('admin.catalog.import.tooBig'));
      return;
    }
    setFileName(file.name);
    const { rows } = parseCsv(await file.text());
    setPlan(planImport(rows));
  };

  const downloadTemplate = () => {
    const dialect = dialectForLocale(locale);
    const example = (values: Partial<Record<(typeof PRODUCT_CSV_COLUMNS)[number], string>>) =>
      PRODUCT_CSV_COLUMNS.map((c) => values[c] ?? '');
    downloadCsv(
      'catalog-template.csv',
      toCsv(
        [
          [...PRODUCT_CSV_COLUMNS],
          example({ handle: 'linen-shirt', name: 'Linen shirt', category: 'clothing', price: '79', size_label: 'size', color_label: 'color', color: 'White', color_swatch: '#F4F4F0', size: 'M', variant_sku: 'LS-WHITE-M', stock: '5', active: 'yes', images: 'https://example.com/shirt.jpg' }),
          example({ handle: 'linen-shirt', name: 'Linen shirt', category: 'clothing', price: '79', color: 'White', color_swatch: '#F4F4F0', size: 'L', variant_sku: 'LS-WHITE-L', stock: '3', active: 'yes' }),
          example({ handle: 'ceramic-mug', name: 'Ceramic mug', category: 'home', price: '18', compare_at_price: '24', cost_price: '6', product_sku: 'MUG-01', stock: '40', active: 'yes' }),
        ],
        dialect,
      ),
    );
  };

  const runImport = () => {
    if (!plan || blocked) return;
    setError(null);
    importProducts.mutate(
      { products: plan.products, createCategories },
      {
        onSuccess: (result) => {
          toast(t('admin.catalog.import.done', { created: result.created, updated: result.updated }));
          onClose();
        },
        onError: (err) => {
          if (err instanceof AppError && err.code === 'import_row') {
            const index = Number(err.detail) - 1;
            const slug = plan.products[index]?.slug ?? '?';
            setError(t('admin.catalog.import.rowFailed', { handle: String(slug), message: err.message.replace(/^Product \d+ \("[^"]*"\): /, '') }));
          } else {
            setError(err instanceof Error ? err.message : t('common.error'));
          }
        },
      },
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      eyebrow={t('admin.tabs.catalog')}
      title={t('admin.catalog.import.title')}
      closeLabel={t('common.close')}
      footer={
        <div className="row gap-3" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={importProducts.isPending}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn--primary" onClick={runImport} disabled={blocked || importProducts.isPending}>
            {importProducts.isPending ? (
              <>
                <Spinner onAction />
                {t('admin.catalog.import.running')}
              </>
            ) : (
              t('admin.catalog.import.run')
            )}
          </button>
        </div>
      }
    >
      <div className="stack gap-5">
        <p className="t-sm t-muted">{t('admin.catalog.import.intro')}</p>
        <ul className="stack gap-2 t-xs t-faint import-rules">
          <li>{t('admin.catalog.import.ruleHandle')}</li>
          <li>{t('admin.catalog.import.ruleRows')}</li>
          <li>{t('admin.catalog.import.ruleColumns')}</li>
          <li>{t('admin.catalog.import.ruleVariants')}</li>
          <li>{t('admin.catalog.import.ruleStock')}</li>
        </ul>
        <button type="button" className="btn btn--quiet btn--sm" style={{ alignSelf: 'flex-start' }} onClick={downloadTemplate}>
          <IconDownload size={14} />
          {t('admin.catalog.import.template')}
        </button>

        <div className="field">
          <label className="field__label" htmlFor="import-file">{t('admin.catalog.import.file')}</label>
          <input
            id="import-file"
            className="file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
          {fileName && <p className="field__hint">{fileName}</p>}
        </div>

        {plan && (
          <>
            <div className="info-rows">
              <div className="info-row">
                <span>{t('admin.catalog.import.products')}</span>
                <strong>{plan.products.length}</strong>
              </div>
              <div className="info-row">
                <span>{t('admin.catalog.import.newProducts')}</span>
                <strong>{newCount}</strong>
              </div>
              <div className="info-row">
                <span>{t('admin.catalog.import.updatedProducts')}</span>
                <strong>{plan.products.length - newCount}</strong>
              </div>
              <div className="info-row">
                <span>{t('admin.catalog.import.variants')}</span>
                <strong>{plan.variantCount}</strong>
              </div>
            </div>

            {plan.ignoredColumns.length > 0 && (
              <p className="t-xs t-faint">
                {t('admin.catalog.import.ignored', { columns: plan.ignoredColumns.join(', ') })}
              </p>
            )}

            {plan.issues.length > 0 && (
              <div className="notice notice--critical">
                <IconAlert size={15} />
                <div className="notice__body">
                  <p>{tCount('admin.catalog.import.issues', plan.issues.length)}</p>
                  <ul className="import-issues">
                    {plan.issues.slice(0, 50).map((issue, i) => (
                      <li key={i}>
                        {t('admin.catalog.import.line', { line: issue.line })}:{' '}
                        {t(`admin.catalog.import.issue.${issue.message}`, { value: issue.value ?? '' })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <label className="checkbox">
              <input type="checkbox" checked={createCategories} onChange={(e) => setCreateCategories(e.target.checked)} />
              {t('admin.catalog.import.createCategories')}
            </label>
          </>
        )}

        {error && (
          <div className="notice notice--critical">
            <IconAlert size={15} />
            <div className="notice__body">{error}</div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
