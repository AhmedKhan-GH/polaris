// @vitest-environment node
//
// Server Supabase client contract (lib/supabase/server). Runs in the `node`
// environment because this is the server-side factory, built on the async
// `cookies()` request API from next/headers.
//
// All collaborators are mocked via `vi.hoisted` so the cycles assert wiring
// WITHOUT a real Supabase project or a Next request context:
//   - `@supabase/ssr`  -> `createServerClient` returns a sentinel we identify by
//                         reference; we also capture its call arguments.
//   - `next/headers`   -> `cookies()` resolves to a fake store whose `getAll`
//                         and `set` we observe (and, in one cycle, make throw).
//   - `@/lib/env`      -> the two NEXT_PUBLIC_* values the factory must forward.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const SENTINEL = { __brand: 'supabase-server-client' } as const;

type ServerOptions = {
  cookies: {
    getAll: () => unknown;
    setAll: (
      toSet: { name: string; value: string; options?: unknown }[],
    ) => void;
  };
};

const fake = vi.hoisted(() => {
  const getAll = vi.fn(() => [{ name: 'sb', value: 'tok' }]);
  const set = vi.fn<(name: string, value: string, options?: unknown) => void>();
  return {
    createServerClient: vi.fn<
      (url: string, key: string, options: ServerOptions) => typeof SENTINEL
    >(() => SENTINEL),
    store: { getAll, set },
  };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: fake.createServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: async () => fake.store,
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

import { getServerSupabase } from './server';

/** The cookie option object handed to the (mocked) createServerClient. */
function lastCookieOption(): ServerOptions['cookies'] {
  const call = fake.createServerClient.mock.calls.at(-1);
  if (!call) throw new Error('createServerClient was not called');
  return call[2].cookies;
}

beforeEach(() => {
  fake.createServerClient.mockClear();
  fake.store.getAll.mockClear();
  // Reset (not just clear) so a per-cycle throwing implementation does not leak
  // into the next cycle.
  fake.store.set.mockReset();
});

describe('lib/supabase getServerSupabase', () => {
  it('builds the client once from the env URL and anon key and returns it', async () => {
    const client = await getServerSupabase();

    expect(fake.createServerClient).toHaveBeenCalledTimes(1);
    const [url, key] = fake.createServerClient.mock.calls[0];
    expect(url).toContain('54321');
    expect(key).toBe('anon-key');
    expect(client).toBe(SENTINEL);
  });

  it('delegates getAll to the cookie store', async () => {
    await getServerSupabase();
    const result = lastCookieOption().getAll();
    expect(fake.store.getAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ name: 'sb', value: 'tok' }]);
  });

  it('setAll writes each cookie to the store as (name, value, options)', async () => {
    await getServerSupabase();
    lastCookieOption().setAll([
      { name: 'a', value: '1', options: { path: '/' } },
      { name: 'b', value: '2', options: { path: '/x' } },
    ]);
    expect(fake.store.set).toHaveBeenCalledTimes(2);
    expect(fake.store.set).toHaveBeenNthCalledWith(1, 'a', '1', { path: '/' });
    expect(fake.store.set).toHaveBeenNthCalledWith(2, 'b', '2', { path: '/x' });
  });

  it('setAll swallows the store throwing (Server Component write)', async () => {
    fake.store.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action');
    });
    await getServerSupabase();
    const { setAll } = lastCookieOption();
    expect(() => setAll([{ name: 'a', value: '1', options: {} }])).not.toThrow();
  });
});
