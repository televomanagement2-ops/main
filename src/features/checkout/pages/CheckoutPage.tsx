import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BackButton } from '../../../components/ui/BackButton';
import { useCartStore } from '../../../store/cartStore';
import { useAuth } from '../../../hooks/useAuth';
import { useAddresses } from '../../../hooks/useAddresses';
import { useShippingMethods } from '../../../hooks/useShippingMethods';
import { supabase } from '../../../lib/supabaseClient';
import { useI18n } from '../../../lib/i18n';
import { computeOrderTotals } from '../../../lib/pricing';
import type { Address, ShippingMethod } from '../../../types';

type CheckoutBody = {
  items: Array<{
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    image: string | null;
    selected_size?: string | null;
  }>;
  user_id: string;
  success_url: string;
  cancel_url: string;
  shipping_address: {
    full_name: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone?: string | null;
  };
  shipping_method_id: string;
  shipping_method_name: string;
  shipping_cost: number;
};

async function resolveCheckoutError(err: unknown, fallback: string): Promise<string> {
  if (!err || typeof err !== 'object') return fallback;
  if (err instanceof Error && err.message) {
    return err.message;
  }
  const e = err as { message?: string; context?: Response };
  if (e.context instanceof Response) {
    const status = e.context.status;
    try {
      const payload = await e.context.clone().json() as { error?: string };
      if (payload?.error) return `[${status}] ${payload.error}`;
    } catch {
      try {
        const bodyText = (await e.context.clone().text()).trim();
        if (bodyText) return `[${status}] ${bodyText}`;
      } catch { /* no-op */ }
    }
    return `[${status}] ${e.context.statusText || 'Edge Function request failed'}`;
  }
  return e.message || fallback;
}

async function invokeCheckoutSessionWithFallback(
  accessToken: string,
  body: CheckoutBody,
): Promise<{ url: string }> {
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  let payload: { url?: string; error?: string } | null = null;
  try {
    payload = (await res.json()) as { url?: string; error?: string };
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Checkout function failed with status ${res.status}.`);
  }
  if (!payload?.url) throw new Error('No checkout URL returned by function.');
  return { url: payload.url };
}

function AddressCard({
  address,
  selected,
  onSelect,
  defaultLabel,
}: {
  address: Address;
  selected: boolean;
  onSelect: () => void;
  defaultLabel: string;
}) {
  return (
    <button
      type="button"
      className={`address-card${selected ? ' address-card--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="address-card__radio" aria-hidden="true">
        <div className={`address-card__dot${selected ? ' address-card__dot--active' : ''}`} />
      </div>
      <div className="address-card__body">
        <p className="address-card__name">{address.full_name}</p>
        <p className="address-card__line">{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
        <p className="address-card__line">{address.city}, {address.state} {address.postal_code}</p>
        <p className="address-card__line">{address.country}</p>
      </div>
      {address.is_default && (
        <span className="badge badge-accent" style={{ marginLeft: 'auto', flexShrink: 0 }}>{defaultLabel}</span>
      )}
    </button>
  );
}

function ShippingMethodCard({
  method,
  selected,
  onSelect,
  estimatedLabel,
  freeLabel,
  formatCurrency,
  formatDays,
}: {
  method: ShippingMethod;
  selected: boolean;
  onSelect: () => void;
  estimatedLabel: string;
  freeLabel: string;
  formatCurrency: (value: number) => string;
  formatDays: (min: number | null, max: number | null) => string | null;
}) {
  const days = formatDays(method.estimated_days_min ?? null, method.estimated_days_max ?? null);

  return (
    <button
      type="button"
      className={`shipping-card${selected ? ' shipping-card--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="address-card__radio" aria-hidden="true">
        <div className={`address-card__dot${selected ? ' address-card__dot--active' : ''}`} />
      </div>
      <div style={{ flex: 1 }}>
        <p className="shipping-card__name">{method.name}</p>
        {method.description && (
          <p className="shipping-card__desc">{method.description}</p>
        )}
        {days && <p className="shipping-card__days">{estimatedLabel}: {days}</p>}
      </div>
      <span className="shipping-card__price">
        {method.price === 0 ? freeLabel : formatCurrency(method.price)}
      </span>
    </button>
  );
}

type AddressFormLabels = {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  useThisAddress: string;
  placeholders: {
    fullName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
};

function NewAddressForm({
  onSaved,
  labels,
}: {
  onSaved: (addr: Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_default'>) => void;
  labels: AddressFormLabels;
}) {
  const [form, setForm] = useState({
    full_name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    phone: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaved({
      full_name: form.full_name,
      line1: form.line1,
      line2: form.line2 || null,
      city: form.city,
      state: form.state,
      postal_code: form.postal_code,
      country: form.country,
      phone: form.phone || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="new-address-form">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="label">{labels.fullName} *</label>
          <input
            className="input"
            required
            value={form.full_name}
            onChange={set('full_name')}
            placeholder={labels.placeholders.fullName}
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="label">{labels.addressLine1} *</label>
          <input
            className="input"
            required
            value={form.line1}
            onChange={set('line1')}
            placeholder={labels.placeholders.addressLine1}
          />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="label">{labels.addressLine2}</label>
          <input
            className="input"
            value={form.line2}
            onChange={set('line2')}
            placeholder={labels.placeholders.addressLine2}
          />
        </div>
        <div className="form-group">
          <label className="label">{labels.city} *</label>
          <input
            className="input"
            required
            value={form.city}
            onChange={set('city')}
            placeholder={labels.placeholders.city}
          />
        </div>
        <div className="form-group">
          <label className="label">{labels.state} *</label>
          <input
            className="input"
            required
            value={form.state}
            onChange={set('state')}
            placeholder={labels.placeholders.state}
          />
        </div>
        <div className="form-group">
          <label className="label">{labels.postalCode} *</label>
          <input
            className="input"
            required
            value={form.postal_code}
            onChange={set('postal_code')}
            placeholder={labels.placeholders.postalCode}
          />
        </div>
        <div className="form-group">
          <label className="label">{labels.country} *</label>
          <input
            className="input"
            required
            value={form.country}
            onChange={set('country')}
            placeholder={labels.placeholders.country}
          />
        </div>
        <div className="form-group">
          <label className="label">{labels.phone}</label>
          <input
            className="input"
            value={form.phone}
            onChange={set('phone')}
            placeholder={labels.placeholders.phone}
            type="tel"
          />
        </div>
      </div>
      <button type="submit" className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--sp-3)' }}>
        {labels.useThisAddress}
      </button>
    </form>
  );
}

export function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const { user } = useAuth();
  const { data: savedAddresses = [], isLoading: addressesLoading } = useAddresses(user?.id);
  const { data: shippingMethods = [], isLoading: shippingLoading } = useShippingMethods();
  const { t, tCount, formatCurrency } = useI18n();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null);
  const [newAddress, setNewAddress] = useState<Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_default'> | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const defaultAddress = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];
  const effectiveAddressId = selectedAddressId ?? (defaultAddress?.id ?? 'new');

  const resolvedAddress: Address | null =
    effectiveAddressId === 'new'
      ? null
      : (savedAddresses.find((a) => a.id === effectiveAddressId) ?? null);

  const selectedMethod = shippingMethods.find((m) => m.id === selectedMethodId)
    ?? shippingMethods[0]
    ?? null;

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shippingCost = selectedMethod?.price ?? 0;
  const { tax, total } = computeOrderTotals(subtotal, shippingCost);

  const formatDays = (min: number | null, max: number | null) => {
    if (min == null || max == null) return null;
    if (min === max) return tCount('checkout.days', min);
    return t('checkout.daysRange', { min, max });
  };

  const addressLabels: AddressFormLabels = {
    fullName: t('checkout.fullName'),
    addressLine1: t('checkout.addressLine1'),
    addressLine2: t('checkout.addressLine2'),
    city: t('checkout.city'),
    state: t('checkout.state'),
    postalCode: t('checkout.postalCode'),
    country: t('checkout.country'),
    phone: t('checkout.phone'),
    useThisAddress: t('checkout.useThisAddress'),
    placeholders: {
      fullName: t('checkout.fullNamePlaceholder'),
      addressLine1: t('checkout.addressLine1Placeholder'),
      addressLine2: t('checkout.addressLine2Placeholder'),
      city: t('checkout.cityPlaceholder'),
      state: t('checkout.statePlaceholder'),
      postalCode: t('checkout.postalCodePlaceholder'),
      country: t('checkout.countryPlaceholder'),
      phone: t('checkout.phonePlaceholder'),
    },
  };

  const shippingAddressReady = effectiveAddressId === 'new' ? newAddress !== null : resolvedAddress !== null;

  const handleCheckout = async () => {
    if (!user || items.length === 0) return;

    const shippingAddr = effectiveAddressId === 'new' ? newAddress : resolvedAddress;
    if (!shippingAddr) {
      setError(t('checkout.selectAddressError'));
      return;
    }
    if (!selectedMethod && shippingMethods.length > 0) {
      setError(t('checkout.selectShippingError'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error(t('checkout.sessionExpired'));
      }
      const accessToken = refreshed.session.access_token;

      const { data: authCheck, error: authCheckError } = await supabase.auth.getUser(accessToken);
      if (authCheckError || !authCheck?.user) {
        throw new Error(t('checkout.sessionInvalid'));
      }

      const chosenMethod = selectedMethod ?? { id: '', name: t('checkout.standard'), price: 0 };

      const body: CheckoutBody = {
        items: items.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
          image: i.product.product_images?.[0]?.url ?? null,
          selected_size: i.selectedSize ?? null,
        })),
        user_id: user.id,
        success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/checkout/cancel`,
        shipping_address: {
          full_name: shippingAddr.full_name,
          line1: shippingAddr.line1,
          line2: shippingAddr.line2,
          city: shippingAddr.city,
          state: shippingAddr.state,
          postal_code: shippingAddr.postal_code,
          country: shippingAddr.country,
          phone: shippingAddr.phone,
        },
        shipping_method_id: chosenMethod.id,
        shipping_method_name: chosenMethod.name,
        shipping_cost: chosenMethod.price,
      };

      const data = await invokeCheckoutSessionWithFallback(accessToken, body);
      window.location.href = data.url;
    } catch (err) {
      setError(await resolveCheckoutError(err, t('common.error')));
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-20)' }}>
      <BackButton to="/cart" label={t('checkout.backToCart')} />
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <span className="section-eyebrow">{t('checkout.securePayment')}</span>
        <h1 className="heading-1" style={{ marginBottom: 0 }}>{t('checkout.title')}</h1>
      </div>

      <div className="checkout-layout">
        <div className="checkout-main">
          {/* ── Address section ── */}
          <section className="checkout-section">
            <h2 className="checkout-section-title">{t('checkout.shippingAddress')}</h2>

            {addressesLoading ? (
              <div style={{ padding: 'var(--sp-4)', color: 'var(--color-text-3)', fontSize: 14 }}>
                {t('checkout.loadingAddresses')}
              </div>
            ) : (
              <div className="address-list">
                {savedAddresses.map((addr) => (
                  <AddressCard
                    key={addr.id}
                    address={addr}
                    selected={effectiveAddressId === addr.id}
                    onSelect={() => setSelectedAddressId(addr.id)}
                    defaultLabel={t('checkout.defaultBadge')}
                  />
                ))}
                <button
                  type="button"
                  className={`address-card address-card--new${effectiveAddressId === 'new' ? ' address-card--selected' : ''}`}
                  onClick={() => setSelectedAddressId('new')}
                >
                  <div className="address-card__radio" aria-hidden="true">
                    <div className={`address-card__dot${effectiveAddressId === 'new' ? ' address-card__dot--active' : ''}`} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {savedAddresses.length === 0
                      ? t('checkout.enterShippingAddress')
                      : `+ ${t('checkout.useDifferentAddress')}`}
                  </span>
                </button>
              </div>
            )}

            {effectiveAddressId === 'new' && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <NewAddressForm onSaved={(addr) => setNewAddress(addr)} labels={addressLabels} />
                {newAddress && (
                  <p style={{ fontSize: 13, color: 'var(--color-success)', marginTop: 8 }}>
                    ✓ {t('checkout.addressReady')}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Shipping method section ── */}
          <section className="checkout-section" style={{ marginTop: 'var(--sp-8)' }}>
            <h2 className="checkout-section-title">{t('checkout.shippingMethod')}</h2>

            {shippingLoading ? (
              <div style={{ padding: 'var(--sp-4)', color: 'var(--color-text-3)', fontSize: 14 }}>
                {t('checkout.loadingShipping')}
              </div>
            ) : (
              <div className="shipping-list">
                {shippingMethods.map((method) => {
                  const isSelected = (selectedMethodId ?? shippingMethods[0]?.id) === method.id;
                  return (
                    <ShippingMethodCard
                      key={method.id}
                      method={method}
                      selected={isSelected}
                      onSelect={() => setSelectedMethodId(method.id)}
                      estimatedLabel={t('checkout.estimated')}
                      freeLabel={t('common.free')}
                      formatCurrency={formatCurrency}
                      formatDays={formatDays}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Order review ── */}
          <section className="checkout-section" style={{ marginTop: 'var(--sp-8)' }}>
            <h2 className="checkout-section-title">{t('checkout.orderReview')}</h2>
            {items.map((item) => (
              <div key={`${item.product.id}-${item.selectedSize ?? ''}`} className="checkout-item">
                <div className="checkout-item__img-wrap">
                  {item.product.product_images?.[0]?.url ? (
                    <img
                      src={item.product.product_images[0].url}
                      alt={item.product.name}
                      className="checkout-item__img"
                    />
                  ) : (
                    <div className="checkout-item__img-placeholder" />
                  )}
                  <span className="checkout-item__qty">{item.quantity}</span>
                </div>
                <div className="checkout-item__info">
                  <p className="checkout-item__name">{item.product.name}</p>
                  {item.selectedSize && (
                    <p className="checkout-item__unit" style={{ color: 'var(--color-text-2)' }}>
                      {t('cart.size')}: {item.selectedSize}
                    </p>
                  )}
                  <p className="checkout-item__unit">{formatCurrency(item.product.price)} {t('cart.each')}</p>
                </div>
                <p className="checkout-item__total">
                  {formatCurrency(item.product.price * item.quantity)}
                </p>
              </div>
            ))}
          </section>
        </div>

        <aside className="order-summary">
          <h2 className="order-summary__title">{t('checkout.orderSummary')}</h2>

          <div className="summary-line">
            <span>{t('cart.subtotal')}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="summary-line">
            <span>
              {t('checkout.shippingWithMethod', {
                method: selectedMethod?.name ?? t('checkout.standard'),
              })}
            </span>
            <span className={shippingCost === 0 ? 'summary-line--free' : ''}>
              {shippingCost === 0 ? t('common.free') : formatCurrency(shippingCost)}
            </span>
          </div>
          {tax > 0 && (
            <div className="summary-line">
              <span>{t('cart.tax')}</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="summary-line summary-line--total">
            <span>{t('cart.total')}</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 'var(--sp-4)' }}>
              {error}
            </div>
          )}

          {!shippingAddressReady && (
            <p style={{ fontSize: 12.5, color: 'var(--color-warning)', marginTop: 'var(--sp-4)', lineHeight: 1.5 }}>
              {t('checkout.completeAddressWarning')}
            </p>
          )}

          <button
            onClick={handleCheckout}
            disabled={isLoading || !shippingAddressReady}
            className="btn btn-primary btn-lg btn-full"
            style={{ marginTop: 'var(--sp-5)' }}
          >
            {isLoading ? (
              <><span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} /> {t('checkout.redirectingPayment')}</>
            ) : (
              <>{t('checkout.payWithStripe', { amount: formatCurrency(total) })}</>
            )}
          </button>

          <p style={{ fontSize: 12, color: 'var(--color-text-3)', textAlign: 'center', marginTop: 'var(--sp-3)' }}>
            {t('checkout.securedByStripe')}
          </p>
        </aside>
      </div>
    </div>
  );
}
