// @vitest-environment node
//
// Browser Supabase client contract (lib/supabase/browser). The unit under test
// is a module-scope singleton, so each cycle resets the module registry and
// re-mocks its collaborators with `vi.doMock` before the dynamic `import`. That
// lets the "same instance across calls" cycle observe the singleton WITHIN one
// module load, while keeping cycles isolated from one another.
//
// Mocks:
//   - `@supabase/ssr` -> `createBrowserClient` returns a fresh sentinel per call
//                        so identity equality actually proves caching (not just
//                        a constant return); we also capture its arguments.
//   - `@/lib/env`     -> the two NEXT_PUBLIC_* values the factory must forward.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('@supabase/ssr');
  vi.doUnmock('@/lib/env');
});

beforeEach(() => {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    },
  }));
});

describe('lib/supabase getSupabaseClient', () => {
  it('returns the same instance and constructs the client only once', async () => {
    const createBrowserClient = vi.fn<
      (url: string, key: string, options?: unknown) => { id: number }
    >(() => ({ id: Math.random() }));
    vi.doMock('@supabase/ssr', () => ({ createBrowserClient }));

    const { getSupabaseClient } = await import('./browser');
    const first = getSupabaseClient();
    const second = getSupabaseClient();

    expect(first).toBe(second);
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });

  it('constructs with the env URL/key and realtime eventsPerSecond: 10', async () => {
    const createBrowserClient = vi.fn<
      (url: string, key: string, options?: unknown) => object
    >(() => ({}));
    vi.doMock('@supabase/ssr', () => ({ createBrowserClient }));

    const { getSupabaseClient } = await import('./browser');
    getSupabaseClient();

    const [url, key, options] = createBrowserClient.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:54321');
    expect(key).toBe('anon-key');
    expect(options).toMatchObject({ realtime: { params: { eventsPerSecond: 10 } } });
  });
});
