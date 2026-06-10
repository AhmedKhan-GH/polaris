// Public-route policy (lib/permissions/routes) — pure, runtime-free (D4).
//
// `isPublicPath` is the single source of truth for which paths render without an
// authenticated session. The contract is intentionally tiny and uses STRICT
// equality (no prefix matching) so that adding a public route is a deliberate,
// reviewable one-line change rather than an accidental prefix blast radius.

import { describe, expect, it } from 'vitest';

import { isPublicPath } from './routes';

describe('lib/permissions/routes isPublicPath', () => {
  it('treats the landing page and the login page as public', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
  });

  it('treats authenticated app routes as non-public', () => {
    // No self-service registration exists (ADR-0003), so /register is NOT a
    // public route — it is simply not a route.
    expect(isPublicPath('/register')).toBe(false);
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(isPublicPath('/orders')).toBe(false);
  });

  it('does not treat sub-paths or look-alike paths as public', () => {
    // Matching is exact, so neither a child of a public route nor a path that
    // merely contains a public segment is public.
    expect(isPublicPath('/login/x')).toBe(false);
    expect(isPublicPath('/x/login')).toBe(false);
  });
});
