/**
 * The exact set of paths that render WITHOUT an authenticated session. Strict
 * equality only — a path is public if and only if it is one of these literals.
 */
const PUBLIC_PATHS = new Set<string>(['/', '/login']);

/**
 * Whether `pathname` is a public route (no session required).
 *
 * Matching is STRICT equality, never prefix-based: `/login` is public but
 * `/login/x` and `/x/login` are not. This keeps the public surface a small,
 * explicit allow-list so widening it is always a deliberate edit here.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

// NOTE: a richer route authorization predicate (`canAccessRoute`) deliberately
// does NOT live here yet — per-route/role policy is scoped to F9/F11. This
// module is the minimal public-vs-authed gate the proxy (D8) needs and nothing
// more.
