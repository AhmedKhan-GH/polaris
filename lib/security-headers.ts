// Security response headers attached to every route by next.config.ts. This is
// the single source of truth for the app's HTTP hardening; nothing else sets
// these. Each entry is the `{ key, value }` shape Next's `headers()` expects.
//
// The CSP is deliberately *Report-Only* for now: realtime support (added later)
// needs `connect-src wss://`, and we don't want to break the app while the
// allow-list is still settling. Report-Only lets the browser report violations
// without blocking them. At deploy we flip this to an enforcing
// `Content-Security-Policy` with a per-request nonce (dropping 'unsafe-inline'
// /'unsafe-eval'). HSTS is inert over plain http (browsers ignore it on
// non-secure origins), so it's safe to ship now and have it take effect once
// served over https.
export const securityHeaders: { key: string; value: string }[] = [
  // Belt-and-suspenders with CSP `frame-ancestors 'none'`; older browsers honor
  // this even where they ignore CSP framing controls.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Disable MIME sniffing — the only valid value.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Send the full URL only for same-origin navigations; just the origin when
  // crossing to another site, and nothing when downgrading https→http.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force https for 2 years, including subdomains; opt into the preload list.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Deny powerful device APIs we never use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Report-Only (see file header). 'unsafe-inline'/'unsafe-eval' are tolerated
  // for now and removed when we move to nonces at enforce time.
  {
    key: 'Content-Security-Policy-Report-Only',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; " +
      "font-src 'self'; connect-src 'self'; object-src 'none'; " +
      "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  },
];
