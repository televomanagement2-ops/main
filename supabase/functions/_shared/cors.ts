// ─────────────────────────────────────────────────────────────────────────────
// Shared CORS policy for browser-facing Edge Functions.
//
// FAIL-CLOSED defaults:
//   • ALLOWED_ORIGINS unset  → no browser origin is allowed (loud warning).
//     Local dev: set ALLOWED_ORIGINS=http://localhost:5173
//   • ALLOW_VERCEL_PREVIEWS  → defaults to FALSE; set "true" only while you
//     still test on *.vercel.app preview URLs.
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

if (allowedOrigins.length === 0) {
  console.warn(
    '[cors] ALLOWED_ORIGINS is not set — every browser origin will be REJECTED. ' +
      'Set the ALLOWED_ORIGINS secret (e.g. "https://yourstore.com,https://www.yourstore.com", ' +
      'or "http://localhost:5173" for local dev).',
  );
}

/**
 * Returns the origin to echo in Access-Control-Allow-Origin, or null when the
 * origin is not authorized (in which case NO such header should be emitted).
 */
export function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (allowedOrigins.includes(origin)) return origin;
  if (allowedOrigins.includes('*')) return origin;
  if (allowVercelPreviews) {
    try {
      if (new URL(origin).hostname.endsWith('.vercel.app')) return origin;
    } catch {
      // malformed origin → not authorized
    }
  }
  return null;
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
