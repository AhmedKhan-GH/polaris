// @vitest-environment node
//
// Proxy (root proxy.ts) — session refresh + the public-vs-authed gate (D8).
//
// Runs in the `node` environment: the proxy builds a request-scoped Supabase
// client and operates on real `NextRequest`/`NextResponse` objects, which are
// Web/Node primitives (no jsdom). Collaborators are mocked via `vi.hoisted`:
//   - `@supabase/ssr` -> `createServerClient` returns a stub whose
//                        `auth.getUser` we drive per cycle and whose cookie
//                        option object we can invoke (to exercise setAll).
//   - `@/lib/env`     -> the two NEXT_PUBLIC_* values the proxy forwards.
//
// `getUserResult` is the value the next `getUser()` call resolves to; each test
// sets it before invoking the proxy. The proxy MUST refresh the session on
// EVERY matched request, so we assert `getUser` call counts directly.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type GetUserResult = {
  data: { user: { id: string } | null };
  error: { code?: string; message?: string } | null;
};

const fake = vi.hoisted(() => {
  const getUser =
    vi.fn<() => Promise<GetUserResult>>();
  return {
    getUser,
    createServerClient: vi.fn(() => ({ auth: { getUser } })),
  };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: fake.createServerClient,
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

import { proxy } from './proxy';

/** A `getUser` result with no authenticated user and no error. */
const NO_USER: GetUserResult = { data: { user: null }, error: null };
/** A `getUser` result with an authenticated user. */
const WITH_USER: GetUserResult = { data: { user: { id: 'u1' } }, error: null };

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

beforeEach(() => {
  fake.getUser.mockReset();
  fake.createServerClient.mockClear();
});

describe('proxy: session refresh', () => {
  it('refreshes the session (calls getUser once) on a public path', async () => {
    fake.getUser.mockResolvedValue(NO_USER);
    await proxy(req('/'));
    expect(fake.getUser).toHaveBeenCalledTimes(1);
  });

  it('refreshes the session (calls getUser once) on a protected path', async () => {
    fake.getUser.mockResolvedValue(WITH_USER);
    await proxy(req('/dashboard'));
    expect(fake.getUser).toHaveBeenCalledTimes(1);
  });
});

describe('proxy: public-vs-authed gate', () => {
  it('does NOT redirect on a public path even with no user', async () => {
    fake.getUser.mockResolvedValue(NO_USER);
    const res = await proxy(req('/'));
    // A redirect would be a 3xx with a `location` header; assert neither.
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects an unauthenticated visitor of a protected path to /login', async () => {
    fake.getUser.mockResolvedValue(NO_USER);
    const res = await proxy(req('/dashboard'));
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toMatch(/\/login$/);
  });

  it('clears sb-* cookies when the refresh token is gone', async () => {
    fake.getUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'refresh_token_not_found', message: 'gone' },
    });
    const request = req('/dashboard');
    request.cookies.set('sb-access-token', 'stale-access');
    request.cookies.set('sb-refresh-token', 'stale-refresh');

    const res = await proxy(request);

    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toMatch(/\/login$/);
    // Deletion = a Set-Cookie with an empty value and a past (epoch) expiry.
    const cleared = res.headers.getSetCookie();
    for (const name of ['sb-access-token', 'sb-refresh-token']) {
      const header = cleared.find((c) => c.startsWith(`${name}=`));
      expect(header, `expected ${name} to be cleared`).toBeDefined();
      expect(header).toMatch(/Expires=Thu, 01 Jan 1970/);
    }
  });

  it('passes an authenticated visitor of a protected path through', async () => {
    fake.getUser.mockResolvedValue(WITH_USER);
    const res = await proxy(req('/dashboard'));
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('location')).toBeNull();
  });
});
