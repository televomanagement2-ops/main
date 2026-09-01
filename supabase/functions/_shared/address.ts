// ─────────────────────────────────────────────────────────────────────────────
// Shipping address: the single definition of which countries the store ships
// to, what a postal code looks like there, and what a stored address may
// contain.
//
// This file is imported by BOTH the create-checkout-session Edge Function
// (Deno) and the checkout form (Vite/React). That is deliberate: when the two
// had their own copies, the client-side list was the only thing standing
// between the store and an order for a country it does not ship to — and the
// client is never the trust boundary. Anyone can POST hand-written JSON to the
// function. Keep this file free of Deno and browser APIs so both runtimes can
// load it.
//
// The caps below are mirrored by CHECK constraints in migration 016; if you
// change one, change the other.
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 3166-1 alpha-2 codes the store ships to. Extend as you enable more. */
export const SHIPPING_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
] as const;

export type ShippingCountryCode = (typeof SHIPPING_COUNTRIES)[number]['code'];

const SHIPPING_COUNTRY_CODES: readonly string[] = SHIPPING_COUNTRIES.map((c) => c.code);

/**
 * Countries whose addresses carry an administrative area the customer actually
 * knows and the carrier actually uses. Everywhere else `state` stays accepted
 * but optional.
 *
 * Requiring it globally made a German or British shopper invent a value in the
 * one place in the funnel where friction is most expensive. It is not simply
 * hidden elsewhere, because Italy and Spain do use a province (the `it`
 * translation of this field is literally "Provincia", placeholder "MI") — some
 * shoppers will fill it in, and dropping the field would throw that away.
 */
export const STATE_REQUIRED_COUNTRIES: readonly string[] = ['US', 'CA', 'AU'];

export function isStateRequired(country: string): boolean {
  return STATE_REQUIRED_COUNTRIES.includes(country.trim().toUpperCase());
}

export const POSTAL_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/i,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/i,
  AU: /^\d{4}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
};

export function isValidPostalCode(country: string, postalCode: string): boolean {
  const pattern = POSTAL_PATTERNS[country.toUpperCase()];
  if (!pattern) return postalCode.trim().length > 0;
  return pattern.test(postalCode.trim());
}

/** Per-field caps, mirrored by addresses_field_length_check in migration 016. */
export const ADDRESS_MAX_LENGTHS = {
  full_name: 120,
  line1: 200,
  line2: 200,
  city: 100,
  state: 100,
  postal_code: 20,
  phone: 32,
} as const;

export interface SanitizedAddress {
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string | null;
}

export type AddressValidation =
  | { ok: true; address: SanitizedAddress }
  | { ok: false; code: string; message: string };

/**
 * Strip C0/C1 control characters and trim.
 *
 * Control characters have no place in an address and do have a place in
 * header-injection and broken-CSV-export tricks. They are stripped rather than
 * rejected: a stray carriage return from a paste should not fail a checkout.
 * Written as a codepoint scan rather than a regex so the range stays readable
 * and cannot be mangled by an editor that eats literal control bytes.
 */
function clean(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20) continue;              // C0: NUL … US (includes CR/LF/TAB)
    if (code >= 0x7f && code <= 0x9f) continue; // DEL + C1
    out += ch;
  }
  return out.trim();
}

/**
 * Validate and normalise a client-supplied shipping address.
 *
 * Returns ONLY the eight known keys, so anything else the caller attached is
 * dropped instead of being persisted into the orders.shipping_address JSONB.
 * Values must be strings: coercing an object with String() would turn it into
 * the string "[object Object]", which passes every check below and reaches the
 * warehouse as a real address.
 */
export function sanitizeAddress(raw: unknown): AddressValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      code: 'VALIDATION_INVALID_SHIPPING_ADDRESS',
      message: 'shipping_address must be an object.',
    };
  }

  const src = raw as Record<string, unknown>;

  // The country is resolved BEFORE the presence check, because it is what
  // decides whether `state` is a required field at all. A country that is
  // absent or not a string deliberately falls through to the presence check
  // below, which names it alongside everything else that is missing — that is
  // the actionable error, and it is the message the caller already expects.
  const rawCountry = src.country;
  const country = typeof rawCountry === 'string' ? clean(rawCountry).toUpperCase() : '';
  if (country && !SHIPPING_COUNTRY_CODES.includes(country)) {
    return {
      ok: false,
      code: 'VALIDATION_COUNTRY_NOT_SUPPORTED',
      message: `The store does not ship to "${country}".`,
    };
  }

  const required = isStateRequired(country)
    ? (['full_name', 'line1', 'city', 'state', 'postal_code', 'country'] as const)
    : (['full_name', 'line1', 'city', 'postal_code', 'country'] as const);

  // Presence next, so a half-filled form still gets the "which fields" message
  // it used to get rather than a type complaint about the first empty one.
  const missing = (required as readonly string[]).filter((f) => {
    const v = src[f];
    return typeof v !== 'string' || clean(v).length === 0;
  });
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'VALIDATION_MISSING_SHIPPING_ADDRESS_FIELDS',
      message: `Missing or invalid shipping address fields: ${missing.join(', ')}`,
    };
  }

  // `false` distinguishes "present but not a string" (reject) from "absent"
  // (store NULL), which a plain `string | null` return could not express.
  const optional = (key: 'line2' | 'phone' | 'state'): string | null | false => {
    const v = src[key];
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string') return false;
    const cleaned = clean(v);
    return cleaned.length === 0 ? null : cleaned;
  };

  const line2 = optional('line2');
  const phone = optional('phone');
  // Where a state is not required it is still validated like any other optional
  // field: absent is fine, a non-string is not. Where it IS required the
  // presence check above already proved it is a non-empty string.
  const state = optional('state');
  if (line2 === false || phone === false || state === false) {
    return {
      ok: false,
      code: 'VALIDATION_INVALID_SHIPPING_ADDRESS',
      message: 'shipping_address line2, phone and state must be strings.',
    };
  }

  const address: SanitizedAddress = {
    full_name: clean(src.full_name as string),
    line1: clean(src.line1 as string),
    line2,
    city: clean(src.city as string),
    // Empty string rather than null: addresses.state is NOT NULL, and keeping
    // the type as `string` means neither the column nor the Address type has to
    // change. Display code filters the empty value out.
    state: state ?? '',
    postal_code: clean(src.postal_code as string),
    country,
    phone,
  };

  for (const [field, max] of Object.entries(ADDRESS_MAX_LENGTHS)) {
    const value = address[field as keyof typeof ADDRESS_MAX_LENGTHS];
    if (typeof value === 'string' && value.length > max) {
      return {
        ok: false,
        code: 'VALIDATION_SHIPPING_ADDRESS_TOO_LONG',
        message: `shipping_address.${field} exceeds ${max} characters.`,
      };
    }
  }

  if (!isValidPostalCode(address.country, address.postal_code)) {
    return {
      ok: false,
      code: 'VALIDATION_INVALID_POSTAL_CODE',
      message: `"${address.postal_code}" is not a valid postal code for ${address.country}.`,
    };
  }

  return { ok: true, address };
}
