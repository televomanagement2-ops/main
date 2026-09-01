import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../../../store/cartStore';
import { useCartSync } from '../../../hooks/useCartSync';
import { useAuth } from '../../../hooks/useAuth';
import { useAddresses, addressKeys } from '../../../hooks/useAddresses';
import { useShippingMethods } from '../../../hooks/useShippingMethods';
import { supabase } from '../../../lib/supabaseClient';
import { createAddress } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { computeOrderTotals } from '../../../lib/pricing';
import {
  SHIPPING_COUNTRIES,
  isValidPostalCode,
  isStateRequired,
  ADDRESS_MAX_LENGTHS,
} from '../../../../supabase/functions/_shared/address.ts';
import { storeConfig } from '../../../config/storeConfig';
import { Media } from '../../../components/ui/Media';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { IconAlert, IconCheck, IconInfo, IconLock } from '../../../components/ui/icons';
import type { Address, ShippingMethod } from '../../../types';

type CheckoutBody = {
  items: Array<{
    product_id: string;
    quantity: number;
    selected_size?: string | null;
  }>;
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
};

// The country list, the postal patterns and the field length caps live in the
// Edge Function's shared module, because the server is where they are actually
// enforced — this form only mirrors them so the shopper gets the error before
// the round-trip. Two copies meant the client list was the only thing keeping
// out an order for a country the store does not ship to, and hand-written JSON
// walked straight past it.
const COUNTRIES = SHIPPING_COUNTRIES;

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

async function invokeCheckoutSession(
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

function AddressChoice({
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
      className={`choice${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="choice__radio" aria-hidden="true">
        <span className="choice__dot" />
      </span>
      <span className="choice__body">
        <span className="choice__title">{address.full_name}</span>
        <span className="choice__line" style={{ display: 'block' }}>
          {address.line1}{address.line2 ? `, ${address.line2}` : ''}
        </span>
        <span className="choice__line" style={{ display: 'block' }}>
          {/* state is empty for countries that do not use one (see
              STATE_REQUIRED_COUNTRIES) — filter rather than render a stray comma. */}
          {[address.city, address.state].filter(Boolean).join(', ')} {address.postal_code} · {address.country}
        </span>
      </span>
      {address.is_default && <Badge>{defaultLabel}</Badge>}
    </button>
  );
}

function ShippingChoice({
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
      className={`choice${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="choice__radio" aria-hidden="true">
        <span className="choice__dot" />
      </span>
      <span className="choice__body">
        <span className="choice__title">{method.name}</span>
        {method.description && <span className="choice__line" style={{ display: 'block' }}>{method.description}</span>}
        {days && <span className="t-xs t-faint" style={{ display: 'block' }}>{estimatedLabel}: {days}</span>}
      </span>
      <span className="choice__price">{method.price === 0 ? freeLabel : formatCurrency(method.price)}</span>
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
  saveAddress: string;
  invalidPostalCode: string;
  placeholders: {
    fullName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
  };
};

type NewAddressValue = Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_default'>;

function NewAddressForm({
  onSaved,
  labels,
}: {
  onSaved: (addr: NewAddressValue, saveForLater: boolean) => void;
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
  const [saveForLater, setSaveForLater] = useState(true);
  const [postalError, setPostalError] = useState(false);

  const stateRequired = isStateRequired(form.country);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPostalCode(form.country, form.postal_code)) {
      setPostalError(true);
      return;
    }
    setPostalError(false);
    onSaved({
      full_name: form.full_name,
      line1: form.line1,
      line2: form.line2 || null,
      city: form.city,
      state: form.state,
      postal_code: form.postal_code.trim(),
      country: form.country,
      phone: form.phone || null,
    }, saveForLater);
  };

  return (
    <form onSubmit={handleSubmit} className="stack gap-4" style={{ marginTop: 'var(--s-5)' }}>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field__label" htmlFor="ck-name">{labels.fullName} *</label>
          <input
            id="ck-name"
            className="input"
            required
            value={form.full_name}
            onChange={set('full_name')}
            placeholder={labels.placeholders.fullName}
            maxLength={ADDRESS_MAX_LENGTHS.full_name}
            autoComplete="name"
          />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field__label" htmlFor="ck-line1">{labels.addressLine1} *</label>
          <input
            id="ck-line1"
            className="input"
            required
            value={form.line1}
            onChange={set('line1')}
            placeholder={labels.placeholders.addressLine1}
            maxLength={ADDRESS_MAX_LENGTHS.line1}
            autoComplete="address-line1"
          />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field__label" htmlFor="ck-line2">{labels.addressLine2}</label>
          <input
            id="ck-line2"
            className="input"
            value={form.line2}
            onChange={set('line2')}
            placeholder={labels.placeholders.addressLine2}
            maxLength={ADDRESS_MAX_LENGTHS.line2}
            autoComplete="address-line2"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ck-city">{labels.city} *</label>
          <input
            id="ck-city"
            className="input"
            required
            value={form.city}
            onChange={set('city')}
            placeholder={labels.placeholders.city}
            maxLength={ADDRESS_MAX_LENGTHS.city}
            autoComplete="address-level2"
          />
        </div>
        <div className="field">
          {/* Required only where the administrative area is real and the carrier
              uses it (US/CA/AU). Germany and the UK have no such field, so
              demanding one made the shopper invent a value; Italy and Spain do
              use a province, so it stays available rather than hidden. */}
          <label className="field__label" htmlFor="ck-state">
            {labels.state}{stateRequired ? ' *' : ''}
          </label>
          <input
            id="ck-state"
            className="input"
            required={stateRequired}
            value={form.state}
            onChange={set('state')}
            placeholder={labels.placeholders.state}
            maxLength={ADDRESS_MAX_LENGTHS.state}
            autoComplete="address-level1"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ck-postal">{labels.postalCode} *</label>
          <input
            id="ck-postal"
            className="input"
            required
            value={form.postal_code}
            onChange={set('postal_code')}
            placeholder={labels.placeholders.postalCode}
            maxLength={ADDRESS_MAX_LENGTHS.postal_code}
            autoComplete="postal-code"
          />
          {postalError && <p className="field__error">{labels.invalidPostalCode}</p>}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ck-country">{labels.country} *</label>
          <select
            id="ck-country"
            className="select"
            required
            value={form.country}
            onChange={set('country')}
            autoComplete="country"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field__label" htmlFor="ck-phone">{labels.phone}</label>
          <input
            id="ck-phone"
            className="input"
            value={form.phone}
            onChange={set('phone')}
            placeholder={labels.placeholders.phone}
            type="tel"
            maxLength={ADDRESS_MAX_LENGTHS.phone}
            autoComplete="tel"
          />
        </div>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={saveForLater}
          onChange={(e) => setSaveForLater(e.target.checked)}
        />
        {labels.saveAddress}
      </label>

      <button type="submit" className="btn btn--secondary btn--sm" style={{ alignSelf: 'flex-start' }}>
        {labels.useThisAddress}
      </button>
    </form>
  );
}

export function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const cartSync = useCartSync();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: savedAddresses = [], isLoading: addressesLoading } = useAddresses(user?.id);
  const { data: shippingMethods = [], isLoading: shippingLoading } = useShippingMethods();
  const { t, tCount, formatCurrency } = useI18n();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new' | null>(null);
  const [newAddress, setNewAddress] = useState<NewAddressValue | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const defaultAddress = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];
  const effectiveAddressId = selectedAddressId ?? (defaultAddress?.id ?? 'new');

  const resolvedAddress: Address | null =
    effectiveAddressId === 'new'
      ? null
      : (savedAddresses.find((a) => a.id === effectiveAddressId) ?? null);

  // The destination country decides which shipping methods exist and whether an
  // import-duties notice belongs on the page.
  const activeCountry =
    (effectiveAddressId === 'new' ? newAddress?.country : resolvedAddress?.country) ?? null;

  // A method with `countries: null` is offered everywhere (migration 017).
  // Before an address is picked there is nothing to filter against, so the full
  // list is shown for information — the pay button is already held back by
  // shippingAddressReady until an address exists.
  const availableMethods = useMemo(
    () =>
      activeCountry
        ? shippingMethods.filter((m) => !m.countries || m.countries.includes(activeCountry))
        : shippingMethods,
    [shippingMethods, activeCountry]
  );

  // Resolving against the FILTERED list is what handles a country change: if the
  // method the shopper picked is no longer offered, the selection falls back to
  // the first valid one instead of quietly keeping a method the server will
  // reject.
  const selectedMethod = availableMethods.find((m) => m.id === selectedMethodId)
    ?? availableMethods[0]
    ?? null;

  // Only a real misconfiguration (a country in SHIPPING_COUNTRIES with no method
  // covering it) reaches this, but it has to stop the order rather than send a
  // request the Edge Function will refuse.
  const noShippingAvailable = activeCountry !== null && availableMethods.length === 0;
  const showDutiesNotice = activeCountry !== null && activeCountry !== storeConfig.countryCode;

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shippingCost = selectedMethod?.price ?? 0;
  const { tax, total } = computeOrderTotals(subtotal, shippingCost);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

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
    saveAddress: t('checkout.saveAddress'),
    invalidPostalCode: t('checkout.invalidPostalCode'),
    placeholders: {
      fullName: t('checkout.fullNamePlaceholder'),
      addressLine1: t('checkout.addressLine1Placeholder'),
      addressLine2: t('checkout.addressLine2Placeholder'),
      city: t('checkout.cityPlaceholder'),
      state: t('checkout.statePlaceholder'),
      postalCode: t('checkout.postalCodePlaceholder'),
      phone: t('checkout.phonePlaceholder'),
    },
  };

  const handleNewAddress = (addr: NewAddressValue, saveForLater: boolean) => {
    setNewAddress(addr);

    // Persist for next time (best-effort — checkout proceeds regardless).
    if (saveForLater && user) {
      createAddress({
        ...addr,
        user_id: user.id,
        is_default: savedAddresses.length === 0,
      })
        .then((created) => {
          queryClient.invalidateQueries({ queryKey: addressKeys.all });
          setSelectedAddressId(created.id);
          setNewAddress(null);
        })
        .catch((err) => {
          console.error('Saving address failed (checkout continues):', err);
        });
    }
  };

  const shippingAddressReady = effectiveAddressId === 'new' ? newAddress !== null : resolvedAddress !== null;

  const handleCheckout = async () => {
    if (!user || items.length === 0) return;

    const shippingAddr = effectiveAddressId === 'new' ? newAddress : resolvedAddress;
    if (!shippingAddr) {
      setError(t('checkout.selectAddressError'));
      return;
    }
    if (noShippingAvailable) {
      setError(t('checkout.noShippingToCountry'));
      return;
    }
    if (!selectedMethod && availableMethods.length > 0) {
      setError(t('checkout.selectShippingError'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // The Supabase client refreshes tokens automatically; getSession() is
      // enough (an explicit refreshSession() here raced the client's own
      // refresh cycle and could sign the user out).
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(t('checkout.sessionExpired'));
      }
      const accessToken = sessionData.session.access_token;

      const chosenMethod = selectedMethod ?? { id: '', name: t('checkout.standard'), price: 0 };

      // Prices, names, images and redirect URLs are all resolved server-side —
      // the client only identifies what to buy and where to ship it.
      const body: CheckoutBody = {
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          selected_size: i.selectedSize ?? null,
        })),
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
      };

      const data = await invokeCheckoutSession(accessToken, body);
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
    <div className="page">
      <header className="account-head">
        <div className="account-head__title">
          <p className="t-label">{t('checkout.securePayment')}</p>
          <h1 className="t-h1" style={{ marginTop: 'var(--s-3)' }}>{t('checkout.title')}</h1>
        </div>
        <div className="account-head__actions">
          <Link to="/cart" className="btn btn--quiet">{t('checkout.backToCart')}</Link>
        </div>
      </header>

      {cartSync.changed && (
        <div className="notice notice--caution" style={{ marginBottom: 'var(--s-8)' }}>
          <IconInfo size={16} />
          <div className="notice__body">{t('cart.pricesUpdated')}</div>
          <button type="button" className="btn btn--quiet btn--sm" onClick={cartSync.dismiss}>
            {t('cart.dismiss')}
          </button>
        </div>
      )}

      <div className="checkout-layout">
        <div className="checkout-layout__main">
          {/* ── 01 · Shipping address ── */}
          <section className="checkout-step">
            <div className="checkout-step__head">
              <span className="checkout-step__num">01</span>
              <h2 className="t-h3">{t('checkout.shippingAddress')}</h2>
            </div>

            {addressesLoading ? (
              <p className="t-sm t-faint">{t('checkout.loadingAddresses')}</p>
            ) : (
              <div className="stack gap-2">
                {savedAddresses.map((addr) => (
                  <AddressChoice
                    key={addr.id}
                    address={addr}
                    selected={effectiveAddressId === addr.id}
                    onSelect={() => setSelectedAddressId(addr.id)}
                    defaultLabel={t('checkout.defaultBadge')}
                  />
                ))}
                <button
                  type="button"
                  className={`choice${effectiveAddressId === 'new' ? ' is-selected' : ''}`}
                  onClick={() => setSelectedAddressId('new')}
                  aria-pressed={effectiveAddressId === 'new'}
                >
                  <span className="choice__radio" aria-hidden="true">
                    <span className="choice__dot" />
                  </span>
                  <span className="choice__body">
                    <span className="choice__title">
                      {savedAddresses.length === 0
                        ? t('checkout.enterShippingAddress')
                        : t('checkout.useDifferentAddress')}
                    </span>
                  </span>
                </button>
              </div>
            )}

            {effectiveAddressId === 'new' && (
              <div>
                <NewAddressForm onSaved={handleNewAddress} labels={addressLabels} />
                {newAddress && (
                  <p className="status status--positive" style={{ marginTop: 'var(--s-3)' }}>
                    {t('checkout.addressReady')}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── 02 · Shipping method ── */}
          <section className="checkout-step">
            <div className="checkout-step__head">
              <span className="checkout-step__num">02</span>
              <h2 className="t-h3">{t('checkout.shippingMethod')}</h2>
            </div>

            {shippingLoading ? (
              <p className="t-sm t-faint">{t('checkout.loadingShipping')}</p>
            ) : noShippingAvailable ? (
              <div className="notice notice--critical">
                <IconAlert size={16} />
                <div className="notice__body">{t('checkout.noShippingToCountry')}</div>
              </div>
            ) : (
              <div className="stack gap-2">
                {availableMethods.map((method) => (
                  <ShippingChoice
                    key={method.id}
                    method={method}
                    selected={selectedMethod?.id === method.id}
                    onSelect={() => setSelectedMethodId(method.id)}
                    estimatedLabel={t('checkout.estimated')}
                    freeLabel={t('common.free')}
                    formatCurrency={formatCurrency}
                    formatDays={formatDays}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── 03 · Review ── */}
          <section className="checkout-step">
            <div className="checkout-step__head">
              <span className="checkout-step__num">03</span>
              <h2 className="t-h3">{t('checkout.orderReview')}</h2>
              <span className="t-xs t-faint">{tCount('orders.items', itemCount)}</span>
            </div>

            <div>
              {items.map((item) => {
                const image =
                  item.product.product_images?.find((i) => i.is_primary)?.url ??
                  item.product.product_images?.[0]?.url ??
                  null;
                return (
                  <div key={`${item.product.id}-${item.selectedSize ?? ''}`} className="mini-line">
                    <div className="mini-line__media">
                      <Media src={image} alt="" ratio="square" />
                      <span className="mini-line__qty">{item.quantity}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t-sm" style={{ color: 'var(--ink)' }}>{item.product.name}</p>
                      {item.selectedSize && (
                        <p className="t-xs t-faint">{t('cart.size')}: {item.selectedSize}</p>
                      )}
                      <p className="t-xs t-faint">
                        {formatCurrency(item.product.price)} {t('cart.each')}
                      </p>
                    </div>
                    <p className="t-sm t-num" style={{ color: 'var(--ink)' }}>
                      {formatCurrency(item.product.price * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="checkout-layout__aside" aria-label={t('checkout.orderSummary')}>
          <p className="t-label" style={{ marginBottom: 'var(--s-5)' }}>{t('checkout.orderSummary')}</p>

          <div className="summary">
            <div className="summary__row">
              <span>{t('cart.subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary__row">
              <span>
                {t('checkout.shippingWithMethod', { method: selectedMethod?.name ?? t('checkout.standard') })}
              </span>
              <span className={shippingCost === 0 ? 'summary__free' : undefined}>
                {shippingCost === 0 ? t('common.free') : formatCurrency(shippingCost)}
              </span>
            </div>
            {tax > 0 && (
              <div className="summary__row">
                <span>{t('cart.tax')}</span>
                <span>{formatCurrency(tax)}</span>
              </div>
            )}
            <div className="summary__row summary__row--total">
              <span>{t('cart.total')}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {error && (
            <div className="notice notice--critical" style={{ marginTop: 'var(--s-5)' }}>
              <IconAlert size={16} />
              <div className="notice__body">{error}</div>
            </div>
          )}

          {!shippingAddressReady && (
            <p className="t-xs" style={{ color: 'var(--caution)', marginTop: 'var(--s-5)' }}>
              {t('checkout.completeAddressWarning')}
            </p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isLoading || !shippingAddressReady || noShippingAvailable}
            className="btn btn--primary btn--lg btn--block"
            style={{ marginTop: 'var(--s-6)' }}
          >
            {isLoading ? (
              <>
                <Spinner onAction />
                {t('checkout.redirectingPayment')}
              </>
            ) : (
              t('checkout.payWithStripe', { amount: formatCurrency(total) })
            )}
          </button>

          <p
            className="t-xs t-faint row gap-2"
            style={{ justifyContent: 'center', marginTop: 'var(--s-4)' }}
          >
            <IconLock size={13} />
            {t('checkout.securedByStripe')}
          </p>

          <ul className="stack gap-2" style={{ marginTop: 'var(--s-6)' }}>
            {[t('checkout.assurance1'), t('checkout.assurance2')].map((line) => (
              <li key={line} className="t-xs t-faint row gap-2" style={{ alignItems: 'flex-start' }}>
                <IconCheck size={13} />
                <span>{line}</span>
              </li>
            ))}
            {/* Cross-border only. Duties are collected by the carrier on
                delivery, so a buyer who was never told treats the bill as a
                surprise charge from the store. */}
            {showDutiesNotice && (
              <li className="t-xs t-faint row gap-2" style={{ alignItems: 'flex-start' }}>
                <IconInfo size={13} />
                <span>{t('checkout.dutiesNotice')}</span>
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
