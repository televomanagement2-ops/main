import { useMemo, useState } from 'react';
import { RowsSkeleton } from '../../../components/ui/Skeletons';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { StatusDot } from '../../../components/ui/StatusIndicator';
import { Drawer } from '../../../components/ui/Drawer';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconCopy, IconPlus } from '../../../components/ui/icons';
import { useDeleteDiscountCode, useDiscountCodes, useDiscountUsage, useSaveDiscountCode } from '../../../hooks/useDiscounts';
import { useAdminCategories, useAdminProducts } from '../../../hooks/useAdminProducts';
import { AppError, type DiscountCodeInput } from '../../../lib/api';
import { DISCOUNT_CODE_PATTERN, normalizeDiscountCode } from '../../../../supabase/functions/_shared/discounts.ts';
import { parseAmount } from '../../../lib/variants';
import { toast } from '../../../store/toastStore';
import { useI18n } from '../../../lib/i18n';
import type { DiscountCode, DiscountKind, DiscountScope, DiscountUsage } from '../../../types';

type CodeState = 'off' | 'scheduled' | 'expired' | 'exhausted' | 'live';

function codeState(code: DiscountCode, usage: DiscountUsage | undefined, now = Date.now()): CodeState {
  if (!code.is_active) return 'off';
  if (code.starts_at && Date.parse(code.starts_at) > now) return 'scheduled';
  if (code.ends_at && Date.parse(code.ends_at) <= now) return 'expired';
  if (code.usage_limit != null && (usage?.uses ?? 0) >= code.usage_limit) return 'exhausted';
  return 'live';
}

const STATE_TONE: Record<CodeState, 'positive' | 'caution' | 'critical' | 'neutral'> = {
  live: 'positive',
  scheduled: 'caution',
  expired: 'neutral',
  exhausted: 'critical',
  off: 'neutral',
};

export function AdminDiscountsPage() {
  const { t, formatCurrency, formatDate } = useI18n();
  const { data: codes = [], isLoading, error } = useDiscountCodes();
  const { data: usage = [] } = useDiscountUsage();
  const save = useSaveDiscountCode();
  const remove = useDeleteDiscountCode();
  const [editing, setEditing] = useState<DiscountCode | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const usageById = useMemo(() => new Map(usage.map((u) => [u.discount_id, u])), [usage]);
  const visible = codes.filter((c) => {
    const term = search.trim().toLowerCase();
    return !term || c.code.toLowerCase().includes(term) || (c.description ?? '').toLowerCase().includes(term);
  });

  const valueText = (code: DiscountCode) =>
    code.kind === 'percent'
      ? `${Number(code.value)}%`
      : code.kind === 'fixed'
        ? formatCurrency(code.value)
        : t('admin.discounts.kind.free_shipping');

  if (isLoading) return <RowsSkeleton rows={6} />;
  if (error) return <ErrorMessage message={t('admin.discounts.loadError')} />;

  return (
    <>
      <header className="admin-page__head">
        <div>
          <p className="t-label">{t('admin.discounts.eyebrow')}</p>
          <h1 className="admin-page__title">{t('admin.discounts.title')}</h1>
          <p className="t-sm t-faint admin-page__desc">{t('admin.discounts.subtitle')}</p>
        </div>
        <div className="admin-page__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing('new')}>
            <IconPlus size={15} />
            {t('admin.discounts.new')}
          </button>
        </div>
      </header>

      <div className="admin-toolbar">
        <input
          type="search"
          className="input input--sm admin-toolbar__search"
          placeholder={t('admin.discounts.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('admin.discounts.search')}
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{t('admin.discounts.emptyTitle')}</p>
          <p className="empty__body">{t('admin.discounts.empty')}</p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 'var(--s-6)' }}>
          <table className="table table--stack">
            <thead>
              <tr>
                <th>{t('admin.discounts.table.code')}</th>
                <th>{t('admin.discounts.table.value')}</th>
                <th>{t('admin.discounts.table.rules')}</th>
                <th className="table__num">{t('admin.discounts.table.uses')}</th>
                <th className="table__num">{t('admin.discounts.table.discounted')}</th>
                <th>{t('admin.discounts.table.status')}</th>
                <th className="table__actions">{t('admin.catalog.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((code) => {
                const u = usageById.get(code.id);
                const state = codeState(code, u);
                const rules = [
                  code.min_subtotal > 0 ? t('admin.discounts.rules.min', { amount: formatCurrency(code.min_subtotal) }) : null,
                  code.applies_to !== 'all'
                    ? t(`admin.discounts.rules.${code.applies_to}`, {
                        count: code.applies_to === 'categories' ? code.category_ids.length : code.product_ids.length,
                      })
                    : null,
                  code.exclude_sale_items ? t('admin.discounts.rules.noSale') : null,
                  code.per_customer_limit ? t('admin.discounts.rules.perCustomer', { count: code.per_customer_limit }) : null,
                  code.ends_at ? t('admin.discounts.rules.until', { date: formatDate(new Date(code.ends_at)) }) : null,
                ].filter(Boolean);
                return (
                  <tr key={code.id}>
                    <td data-col="meta">
                      <p className="table__primary t-mono">{code.code}</p>
                      {code.description && <p className="t-xs t-faint">{code.description}</p>}
                    </td>
                    <td data-col="full">{valueText(code)}</td>
                    <td data-col="full" className="t-xs t-faint">{rules.join(' · ') || t('admin.discounts.rules.none')}</td>
                    <td data-col="end" className="table__num">
                      {u?.uses ?? 0}
                      {code.usage_limit != null && <span className="t-faint"> / {code.usage_limit}</span>}
                    </td>
                    <td data-col="end" className="table__num">{formatCurrency(u?.discount_total ?? 0)}</td>
                    <td data-col="full"><StatusDot tone={STATE_TONE[state]} label={t(`admin.discounts.state.${state}`)} /></td>
                    <td data-col="end" className="table__actions">
                      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(code)}>
                          {t('admin.catalog.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() =>
                            save.mutate(
                              { ...code, is_active: !code.is_active },
                              { onError: (err) => toast(err instanceof Error ? err.message : t('common.error'), 'critical') },
                            )
                          }
                          disabled={save.isPending}
                        >
                          {code.is_active ? t('admin.discounts.deactivate') : t('admin.discounts.activate')}
                        </button>
                        <button
                          type="button"
                          className="btn btn--quiet btn--sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(code.code);
                            toast(t('admin.discounts.copied', { code: code.code }));
                          }}
                          aria-label={t('admin.discounts.copy')}
                          title={t('admin.discounts.copy')}
                        >
                          <IconCopy size={14} />
                        </button>
                        {/* A code any order used is history: switch it off instead. */}
                        {!u && (
                          <button
                            type="button"
                            className="btn btn--quiet btn--sm"
                            onClick={() =>
                              remove.mutate(code.id, {
                                onSuccess: () => toast(t('admin.discounts.deleted', { code: code.code })),
                                onError: (err) =>
                                  toast(
                                    err instanceof AppError && err.code === 'code_used'
                                      ? t('admin.discounts.cannotDelete')
                                      : err instanceof Error
                                        ? err.message
                                        : t('common.error'),
                                    'critical',
                                  ),
                              })
                            }
                            disabled={remove.isPending}
                          >
                            {t('admin.discounts.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <DiscountFormDrawer
          key={editing === 'new' ? 'new' : editing.id}
          code={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const randomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
};

function DiscountFormDrawer({ code, onClose }: { code: DiscountCode | null; onClose: () => void }) {
  const { t } = useI18n();
  const save = useSaveDiscountCode();
  const { data: categories = [] } = useAdminCategories();
  const { data: products = [] } = useAdminProducts();

  const [value, setValueText] = useState(code ? String(code.value) : '10');
  const [form, setForm] = useState({
    code: code?.code ?? '',
    description: code?.description ?? '',
    kind: (code?.kind ?? 'percent') as DiscountKind,
    minSubtotal: code && code.min_subtotal > 0 ? String(code.min_subtotal) : '',
    startsAt: toLocalInput(code?.starts_at ?? null),
    endsAt: toLocalInput(code?.ends_at ?? null),
    usageLimit: code?.usage_limit != null ? String(code.usage_limit) : '',
    perCustomer: code?.per_customer_limit != null ? String(code.per_customer_limit) : '',
    appliesTo: (code?.applies_to ?? 'all') as DiscountScope,
    categoryIds: code?.category_ids ?? [],
    productIds: code?.product_ids ?? [],
    excludeSale: code?.exclude_sale_items ?? false,
    isActive: code?.is_active ?? true,
  });
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: v }));
  const toggleIn = (key: 'categoryIds' | 'productIds', id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeDiscountCode(form.code);
    if (!DISCOUNT_CODE_PATTERN.test(normalized)) return setError(t('admin.discounts.errors.code'));
    const amount = form.kind === 'free_shipping' ? 0 : parseAmount(value);
    if (amount == null || Number.isNaN(amount) || (form.kind !== 'free_shipping' && amount <= 0)) {
      return setError(t('admin.discounts.errors.value'));
    }
    if (form.kind === 'percent' && amount > 100) return setError(t('admin.discounts.errors.percent'));
    const minSubtotal = parseAmount(form.minSubtotal);
    if (Number.isNaN(minSubtotal)) return setError(t('admin.discounts.errors.min'));
    const limit = (raw: string) => (raw.trim() === '' ? null : Math.trunc(Number(raw)));
    const usageLimit = limit(form.usageLimit);
    const perCustomer = limit(form.perCustomer);
    if ((usageLimit != null && !(usageLimit > 0)) || (perCustomer != null && !(perCustomer > 0))) {
      return setError(t('admin.discounts.errors.limit'));
    }
    const startsAt = form.startsAt ? new Date(form.startsAt).toISOString() : null;
    const endsAt = form.endsAt ? new Date(form.endsAt).toISOString() : null;
    if (startsAt && endsAt && endsAt <= startsAt) return setError(t('admin.discounts.errors.window'));
    if (form.appliesTo === 'categories' && form.categoryIds.length === 0) return setError(t('admin.discounts.errors.categories'));
    if (form.appliesTo === 'products' && form.productIds.length === 0) return setError(t('admin.discounts.errors.products'));

    const input: DiscountCodeInput = {
      ...(code ? { id: code.id } : {}),
      code: normalized,
      description: form.description.trim() || null,
      kind: form.kind,
      value: amount,
      min_subtotal: minSubtotal ?? 0,
      starts_at: startsAt,
      ends_at: endsAt,
      usage_limit: usageLimit,
      per_customer_limit: perCustomer,
      applies_to: form.appliesTo,
      category_ids: form.appliesTo === 'categories' ? form.categoryIds : [],
      product_ids: form.appliesTo === 'products' ? form.productIds : [],
      exclude_sale_items: form.excludeSale,
      is_active: form.isActive,
    };
    save.mutate(input, {
      onSuccess: () => {
        toast(code ? t('admin.discounts.saved') : t('admin.discounts.created', { code: normalized }));
        onClose();
      },
      onError: (err) =>
        setError(
          err instanceof AppError && err.code === 'code_taken'
            ? t('admin.discounts.errors.taken', { code: normalized })
            : err instanceof Error
              ? err.message
              : t('common.error'),
        ),
    });
  };

  const matchingProducts = products
    .filter((p) => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    .slice(0, 60);

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      eyebrow={t('admin.discounts.eyebrow')}
      title={code ? t('admin.discounts.editTitle') : t('admin.discounts.newTitle')}
      closeLabel={t('common.close')}
      footer={
        <div className="row gap-3" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="discount-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? <><Spinner onAction />{t('admin.catalog.form.saving')}</> : t('admin.catalog.form.save')}
          </button>
        </div>
      }
    >
      <form id="discount-form" className="form-sections" onSubmit={submit}>
        <section className="form-section">
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="dc-code">{t('admin.discounts.form.code')} *</label>
              <div className="row gap-2">
                <input
                  id="dc-code"
                  className="input t-mono"
                  value={form.code}
                  maxLength={40}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  placeholder="SUMMER10"
                />
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => set('code', randomCode())}>
                  {t('admin.discounts.form.generate')}
                </button>
              </div>
              <p className="field__hint">{t('admin.discounts.form.codeHint')}</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dc-desc">{t('admin.discounts.form.description')}</label>
              <input id="dc-desc" className="input" value={form.description} maxLength={200} onChange={(e) => set('description', e.target.value)} />
              <p className="field__hint">{t('admin.discounts.form.descriptionHint')}</p>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__head"><p className="t-label">{t('admin.discounts.form.valueSection')}</p></div>
          <div className="segmented" role="radiogroup" aria-label={t('admin.discounts.form.kind')}>
            {(['percent', 'fixed', 'free_shipping'] as DiscountKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.kind === kind}
                className={`segmented__item${form.kind === kind ? ' is-active' : ''}`}
                onClick={() => set('kind', kind)}
              >
                {t(`admin.discounts.kind.${kind}`)}
              </button>
            ))}
          </div>
          <div className="form-grid">
            {form.kind !== 'free_shipping' && (
              <div className="field">
                <label className="field__label" htmlFor="dc-value">
                  {form.kind === 'percent' ? t('admin.discounts.form.percent') : t('admin.discounts.form.amount')} *
                </label>
                <input id="dc-value" className="input t-num" inputMode="decimal" value={value} onChange={(e) => setValueText(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label className="field__label" htmlFor="dc-min">{t('admin.discounts.form.minSubtotal')}</label>
              <input id="dc-min" className="input t-num" inputMode="decimal" value={form.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} />
              <p className="field__hint">{t('admin.discounts.form.minSubtotalHint')}</p>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__head"><p className="t-label">{t('admin.discounts.form.scopeSection')}</p></div>
          <div className="segmented" role="radiogroup" aria-label={t('admin.discounts.form.scopeSection')}>
            {(['all', 'categories', 'products'] as DiscountScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                role="radio"
                aria-checked={form.appliesTo === scope}
                className={`segmented__item${form.appliesTo === scope ? ' is-active' : ''}`}
                onClick={() => set('appliesTo', scope)}
              >
                {t(`admin.discounts.scope.${scope}`)}
              </button>
            ))}
          </div>
          {form.appliesTo === 'categories' && (
            <div className="check-list">
              {categories.map((c) => (
                <label key={c.id} className="checkbox">
                  <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleIn('categoryIds', c.id)} />
                  {c.name}
                </label>
              ))}
              <p className="field__hint">{t('admin.discounts.form.categoriesHint')}</p>
            </div>
          )}
          {form.appliesTo === 'products' && (
            <div className="stack gap-3">
              <input
                className="input input--sm"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t('admin.catalog.searchPlaceholder')}
                aria-label={t('admin.catalog.searchLabel')}
              />
              <div className="check-list">
                {matchingProducts.map((p) => (
                  <label key={p.id} className="checkbox">
                    <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleIn('productIds', p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
              <p className="field__hint">{t('admin.discounts.form.productsChosen', { count: form.productIds.length })}</p>
            </div>
          )}
          <label className="checkbox">
            <input type="checkbox" checked={form.excludeSale} onChange={(e) => set('excludeSale', e.target.checked)} />
            {t('admin.discounts.form.excludeSale')}
          </label>
        </section>

        <section className="form-section">
          <div className="form-section__head"><p className="t-label">{t('admin.discounts.form.limitsSection')}</p></div>
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="dc-start">{t('admin.discounts.form.startsAt')}</label>
              <input id="dc-start" type="datetime-local" className="input" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dc-end">{t('admin.discounts.form.endsAt')}</label>
              <input id="dc-end" type="datetime-local" className="input" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dc-limit">{t('admin.discounts.form.usageLimit')}</label>
              <input id="dc-limit" className="input t-num" inputMode="numeric" value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} />
              <p className="field__hint">{t('admin.discounts.form.usageLimitHint')}</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dc-per">{t('admin.discounts.form.perCustomer')}</label>
              <input id="dc-per" className="input t-num" inputMode="numeric" value={form.perCustomer} onChange={(e) => set('perCustomer', e.target.value)} />
            </div>
          </div>
          <div className="info-rows">
            <div className="info-row">
              <span>
                <strong style={{ display: 'block' }}>{t('admin.discounts.form.active')}</strong>
                <span className="t-xs t-faint">{t('admin.discounts.form.activeHint')}</span>
              </span>
              <button
                type="button"
                className={`switch${form.isActive ? ' is-on' : ''}`}
                role="switch"
                aria-checked={form.isActive}
                aria-label={t('admin.discounts.form.active')}
                onClick={() => set('isActive', !form.isActive)}
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="notice notice--critical">
            <IconAlert size={15} />
            <div className="notice__body">{error}</div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
