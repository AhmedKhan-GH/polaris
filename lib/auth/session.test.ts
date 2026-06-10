// @vitest-environment node
//
// getSessionUser contract (lib/auth/session) — THE single identity resolver.
// Runs in the `node` environment because the unit is server-side: it builds the
// request-scoped Supabase client and reads the authenticated user.
//
// `@/lib/supabase/server` is mocked via `vi.hoisted` so the cycles assert the
// resolver's wiring WITHOUT a real Supabase project or a Next request context.
// `supabaseWith(user, role)` returns a minimal fake client: `auth.getUser`
// resolves to the given user, and `from(...).select().eq().single()` resolves to
// the given profile role (or null when absent). `from` is a `vi.fn` so we can
// assert it is/ isn't called and with what table.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: fake.getServerSupabase,
}));

import { getSessionUser } from './session';

/** A minimal Supabase client stub: a given auth user and a given profile role. */
function supabaseWith(user: unknown, role?: string) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: role ? { role } : null }),
        }),
      }),
    })),
  };
}

beforeEach(() => {
  fake.getServerSupabase.mockReset();
});

describe('lib/auth getSessionUser', () => {
  it('returns null and never touches profiles when there is no user', async () => {
    const client = supabaseWith(null);
    fake.getServerSupabase.mockResolvedValue(client);

    await expect(getSessionUser()).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('wraps the profile role in an array and reads from profiles', async () => {
    const client = supabaseWith({ id: 'u1', email: 'a@b.com' }, 'owner');
    fake.getServerSupabase.mockResolvedValue(client);

    await expect(getSessionUser()).resolves.toEqual({
      userId: 'u1',
      email: 'a@b.com',
      roles: ['owner'],
    });
    expect(client.from).toHaveBeenCalledWith('profiles');
  });

  it('yields empty roles when the user has no profile row', async () => {
    const client = supabaseWith({ id: 'u1', email: 'a@b.com' });
    fake.getServerSupabase.mockResolvedValue(client);

    await expect(getSessionUser()).resolves.toEqual({
      userId: 'u1',
      email: 'a@b.com',
      roles: [],
    });
  });

  it('normalizes a missing email to null', async () => {
    const client = supabaseWith({ id: 'u1', email: undefined }, 'owner');
    fake.getServerSupabase.mockResolvedValue(client);

    const result = await getSessionUser();
    expect(result?.email).toBeNull();
  });
});
