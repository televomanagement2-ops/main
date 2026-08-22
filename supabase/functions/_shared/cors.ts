// ─────────────────────────────────────────────────────────────────────────────
// Shared CORS policy for browser-facing Edge Functions.
//
// FAIL-CLOSED defaults:
//   • ALLOWED_ORIGINS unset  → no browser origin is allowed (loud warning).
//     Local dev: set ALLOWED_ORIGINS=http://localhost:5173
//   • ALLOW_VERCEL_PREVIEWS  → defaults to FALSE; set "true" only while you
//     still test on *.vercel.app preview URLs. It additionally REQUIRES
//     VERCEL_PREVIEW_PREFIX (see below) — ".vercel.app" alone is not a trust
//     boundary, since anyone can deploy a free project on that domain.
//   • VERCEL_PREVIEW_PREFIX  → your project's preview hostname prefix, e.g.
//     "my-store" to allow "my-store-git-branch-acme.vercel.app". Without it,
//     preview origins are rejected even when ALLOW_VERCEL_PREVIEWS=true.
//
// An explicit "*" entry in ALLOWED_ORIGINS opts into allowing any origin; the
// concrete request origin is echoed back (never a literal "*"), so callers can
// always rely on resolveAllowedOrigin() returning a usable absolute origin.
// ─────────────────────────────────────────────────────────────────────────────

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowVercelPreviews =
  (Deno.env.get('ALLOW_VERCEL_PREVIEWS') ?? 'false').toLowerCase() === 'true';

const vercelPreviewPrefix = (Deno.env.get('VERCEL_PREVIEW_PREFIX') ?? '').trim();

if (allowedOrigins.length === 0) {
  console.warn(
    '[cors] ALLOWED_ORIGINS is not set — every browser origin will be REJECTED. ' +
      'Set the ALLOWED_ORIGINS secret (e.g. "https://yourstore.com,https://www.yourstore.com", ' +
      'or "http://localhost:5173" for local dev).',
  );
}

if (allowedOrigins.includes('*')) {
  console.warn(
    '[cors] ALLOWED_ORIGINS contains "*" — EVERY origin is allowed, including ' +
      'attacker-controlled sites. Replace it with your real domain(s) before going live.',
  );
}

if (allowVercelPreviews && !vercelPreviewPrefix) {
  console.warn(
    '[cors] ALLOW_VERCEL_PREVIEWS=true but VERCEL_PREVIEW_PREFIX is not set — ' +
      'preview origins will be REJECTED. Matching every *.vercel.app host would ' +
      'trust any project deployed on that domain, so a prefix is required. Set ' +
      'VERCEL_PREVIEW_PREFIX to your project name (the part before "-git-" / "-<hash>").',
  );
}

/** Is this a preview deployment of THIS project (not just any *.vercel.app)? */
function isOwnVercelPreview(origin: string): boolean {
  if (!allowVercelPreviews || !vercelPreviewPrefix) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;
    if (!hostname.endsWith('.vercel.app')) return false;
    // Guard against "eviltotally-<prefix>.vercel.app": the prefix must start
    // the hostname, and be followed by a separator rather than more name.
    if (hostname === `${vercelPreviewPrefix}.vercel.app`) return true;
    return hostname.startsWith(`${vercelPreviewPrefix}-`);
  } catch {
    return false; // malformed origin → not authorized
  }
}

/**
 * Returns the origin to echo in Access-Control-Allow-Origin, or null when the
 * origin is not authorized (in which case NO such header should be emitted).
 */
export function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (allowedOrigins.includes(origin)) return origin;
  if (allowedOrigins.includes('*')) return origin;
  if (isOwnVercelPreview(origin)) return origin;
  return null;
}

/**
 * True when the request carries a browser Origin that is NOT authorized, so
 * the handler should fail closed with a 403 instead of doing the work and
 * merely omitting the CORS header.
 *
 * A request with NO Origin header is not rejected: that is a server-to-server
 * or CLI caller, which is still authenticated by its bearer token. Only
 * browsers attach Origin, and only browsers are subject to CORS.
 */
export function isForbiddenOrigin(origin: string | null): boolean {
  return origin !== null && resolveAllowedOrigin(origin) === null;
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(origin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  // Only emit Allow-Origin when the origin is authorized; never echo a different
  // origin (that would break the request with a misleading CORS error).
  if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
  return headers;
}
