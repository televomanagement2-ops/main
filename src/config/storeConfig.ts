// ─────────────────────────────────────────────────────────────────────────────
// STORE CONFIGURATION — single place the store operator (licensee) fills in.
//
// Replace each [PLACEHOLDER] value below with your real business details before
// going live. These values are injected into the Terms of Service, Privacy
// Policy, and Cookie Policy (all languages) automatically — you only edit them
// here, once.
//
// Until a value is filled in, the corresponding [PLACEHOLDER] is shown verbatim
// in the legal pages so it is obvious what still needs completing.
// ─────────────────────────────────────────────────────────────────────────────

export const storeConfig = {
  /** Public store / brand name shown to customers. */
  storeName: 'AURUM',

  /** Two-letter country code shown in the footer (operator's location). */
  countryCode: 'US',
  /** Country name shown in the footer (operator's location). */
  countryName: 'United States',

  /** Registered legal name of the seller (the entity on invoices/contracts). */
  sellerLegalName: '[SELLER_LEGAL_NAME]',
  /** Entity type, e.g. "LLC", "Inc.", "Ltd", "Sole Proprietor". */
  sellerEntityType: '[SELLER_ENTITY_TYPE]',
  /** Full registered business address. */
  businessAddress: '[BUSINESS_ADDRESS]',

  // Customer-facing contact. Generic placeholders (example.com / 555) — replace
  // before launch. They render cleanly on the demo while signaling "fill me".
  /** General customer-facing contact email (orders, returns, support). */
  contactEmail: 'support@example.com',
  /** Support phone number. */
  supportPhone: '+1 (555) 123-4567',
  /** Privacy / data-protection contact email. */
  privacyEmail: 'privacy@example.com',

  /** U.S. state whose law governs the Terms (e.g. "Delaware", "California"). */
  governingState: '[GOVERNING_STATE]',
  /** Arbitration provider for U.S. disputes (e.g. "the American Arbitration Association"). */
  arbitrationBody: '[ARBITRATION_BODY]',
  /** Return window in days for the voluntary US returns policy (e.g. "30"). */
  returnWindow: '[RETURN_WINDOW]',

  /** EU responsible person for product safety (GPSR) — required to sell to EU. */
  euResponsiblePerson: '[EU_RESPONSIBLE_PERSON]',
  /** Contact for the EU responsible person. */
  euResponsibleContact: '[EU_RESPONSIBLE_CONTACT]',
  /** GDPR Art. 27 EU/UK representative, if appointed. */
  euRepresentative: '[EU_REPRESENTATIVE]',
} as const;

// Map every legal placeholder token to its configured value.
const legalPlaceholders: Record<string, string> = {
  '[SELLER_LEGAL_NAME]': storeConfig.sellerLegalName,
  '[SELLER_ENTITY_TYPE]': storeConfig.sellerEntityType,
  '[BUSINESS_ADDRESS]': storeConfig.businessAddress,
  '[CONTACT_EMAIL]': storeConfig.contactEmail,
  '[SUPPORT_PHONE]': storeConfig.supportPhone,
  '[PRIVACY_EMAIL]': storeConfig.privacyEmail,
  '[GOVERNING_STATE]': storeConfig.governingState,
  '[ARBITRATION_BODY]': storeConfig.arbitrationBody,
  '[RETURN_WINDOW]': storeConfig.returnWindow,
  '[EU_RESPONSIBLE_PERSON]': storeConfig.euResponsiblePerson,
  '[EU_RESPONSIBLE_CONTACT]': storeConfig.euResponsibleContact,
  '[EU_REPRESENTATIVE]': storeConfig.euRepresentative,
};

/**
 * Replace [PLACEHOLDER] tokens in legal text with values from storeConfig.
 * Unknown tokens are left untouched so nothing is silently dropped.
 */
export function fillPlaceholders(text: string): string {
  return text.replace(/\[[A-Z0-9_]+\]/g, (token) => legalPlaceholders[token] ?? token);
}

/** True if any legal/identity value still contains an unfilled [PLACEHOLDER]. */
export function hasUnfilledPlaceholders(): boolean {
  return Object.values(legalPlaceholders).some((v) => /\[[A-Z0-9_]+\]/.test(v));
}
